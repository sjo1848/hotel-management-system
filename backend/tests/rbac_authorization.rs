use axum::body::Body;
use axum::body::to_bytes;
use axum::extract::ConnectInfo;
use axum::http::{header, Method, Request, StatusCode};
use hms_backend::app_state::AppState;
use hms_backend::application::{
    analytics_service::AnalyticsService, audit_service::AuditService, auth_service::AuthService,
    billing_service::BillingService, booking_service::BookingService,
    cash_closure_service::CashClosureService, guest_service::GuestService,
    housekeeping_service::HousekeepingService, hotel_service::HotelService,
    reporting_service::ReportingService, room_service::RoomService,
};
use hms_backend::config::AppConfig;
use hms_backend::domain::repositories::{
    AuditRepository, BookingRepository, CashClosureRepository, ExtraChargeRepository,
    GuestRepository, HotelRepository, InvoiceRepository, RefreshTokenRepository, RoomRepository,
    UserRepository,
};
use hms_backend::infrastructure::repository::{
    postgres::PostgresRoomRepository, postgres_audit::PostgresAuditRepository,
    postgres_booking::PostgresBookingRepository, postgres_cash_closure::PostgresCashClosureRepository,
    postgres_extra_charge::PostgresExtraChargeRepository, postgres_guest::PostgresGuestRepository,
    postgres_hotel::PostgresHotelRepository, postgres_invoice::PostgresInvoiceRepository,
    postgres_refresh_token::PostgresRefreshTokenRepository, postgres_user::PostgresUserRepository,
};
use hms_backend::infrastructure::web::jwt::{encode_token, Claims};
use hms_backend::infrastructure::web::passwords::hash_password;
use hms_backend::infrastructure::web::routes::create_router;
use std::net::SocketAddr;
use std::sync::Arc;
use tower::ServiceExt;
use uuid::Uuid;

#[sqlx::test]
async fn rbac_capability_matrix_enforced(pool: sqlx::PgPool) {
    let hotel_id = Uuid::new_v4();
    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_id)
        .bind("Hotel RBAC QA")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();

    let admin_id = insert_user(&pool, hotel_id, "admin_rbac", "admin").await;
    let ops_id = insert_user(&pool, hotel_id, "ops_rbac", "ops").await;
    let reception_id = insert_user(&pool, hotel_id, "reception_rbac", "receptionist").await;
    let hk_id = insert_user(&pool, hotel_id, "housekeeping_rbac", "housekeeping").await;

    let config = AppConfig::from_env();
    let app = create_router(build_state(pool.clone(), config.clone()));

    let admin_token = make_token(&config.jwt_secret, admin_id, hotel_id, "admin");
    let ops_token = make_token(&config.jwt_secret, ops_id, hotel_id, "ops");
    let reception_token = make_token(
        &config.jwt_secret,
        reception_id,
        hotel_id,
        "receptionist",
    );
    let hk_token = make_token(&config.jwt_secret, hk_id, hotel_id, "housekeeping");

    // Admin can read users.
    assert_status(
        &app,
        Method::GET,
        "/api/v1/users",
        &admin_token,
        None,
        false,
        StatusCode::OK,
    )
    .await;

    // Ops cannot read users.
    assert_status(
        &app,
        Method::GET,
        "/api/v1/users",
        &ops_token,
        None,
        false,
        StatusCode::FORBIDDEN,
    )
    .await;

    // Ops can read bookings.
    assert_status(
        &app,
        Method::GET,
        "/api/v1/bookings",
        &ops_token,
        None,
        false,
        StatusCode::OK,
    )
    .await;

    // Housekeeping can access housekeeping queue.
    assert_status(
        &app,
        Method::GET,
        "/api/v1/housekeeping/dirty",
        &hk_token,
        None,
        false,
        StatusCode::OK,
    )
    .await;

    // Reception cannot access housekeeping queue.
    assert_status(
        &app,
        Method::GET,
        "/api/v1/housekeeping/dirty",
        &reception_token,
        None,
        false,
        StatusCode::FORBIDDEN,
    )
    .await;

    // Reception can create guests.
    assert_status(
        &app,
        Method::POST,
        "/api/v1/guests",
        &reception_token,
        Some(format!(
            r#"{{"full_name":"Guest A","email":"guest-a-{}@example.com","phone":"123"}}"#,
            Uuid::new_v4()
        )),
        true,
        StatusCode::OK,
    )
    .await;

    // Housekeeping cannot create guests.
    assert_status(
        &app,
        Method::POST,
        "/api/v1/guests",
        &hk_token,
        Some(format!(
            r#"{{"full_name":"Guest B","email":"guest-b-{}@example.com","phone":"123"}}"#,
            Uuid::new_v4()
        )),
        true,
        StatusCode::FORBIDDEN,
    )
    .await;

    // Ops can close cash.
    assert_status(
        &app,
        Method::POST,
        "/api/v1/billing/close-cash",
        &ops_token,
        Some(r#"{"notes":"qa closure"}"#.to_string()),
        true,
        StatusCode::OK,
    )
    .await;

    // Reception cannot close cash.
    assert_status(
        &app,
        Method::POST,
        "/api/v1/billing/close-cash",
        &reception_token,
        Some(r#"{"notes":"qa denied"}"#.to_string()),
        true,
        StatusCode::FORBIDDEN,
    )
    .await;
}

async fn insert_user(pool: &sqlx::PgPool, hotel_id: Uuid, username: &str, role: &str) -> Uuid {
    let id = Uuid::new_v4();
    let password_hash = hash_password("password123").unwrap();
    sqlx::query(
        "INSERT INTO users (id, hotel_id, username, password_hash, role) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(id)
    .bind(hotel_id)
    .bind(username)
    .bind(password_hash)
    .bind(role)
    .execute(pool)
    .await
    .unwrap();
    id
}

fn make_token(secret: &str, user_id: Uuid, hotel_id: Uuid, role: &str) -> String {
    let claims = Claims {
        sub: user_id.to_string(),
        hotel_id: hotel_id.to_string(),
        role: role.to_string(),
        exp: 2_000_000_000,
    };
    encode_token(&claims, secret).unwrap()
}

fn build_state(pool: sqlx::PgPool, config: AppConfig) -> Arc<AppState> {
    let room_repo = Arc::new(PostgresRoomRepository::new(pool.clone())) as Arc<dyn RoomRepository>;
    let booking_repo =
        Arc::new(PostgresBookingRepository::new(pool.clone())) as Arc<dyn BookingRepository>;
    let guest_repo =
        Arc::new(PostgresGuestRepository::new(pool.clone())) as Arc<dyn GuestRepository>;
    let user_repo = Arc::new(PostgresUserRepository::new(pool.clone())) as Arc<dyn UserRepository>;
    let refresh_repo = Arc::new(PostgresRefreshTokenRepository::new(pool.clone()))
        as Arc<dyn RefreshTokenRepository>;
    let audit_repo =
        Arc::new(PostgresAuditRepository::new(pool.clone())) as Arc<dyn AuditRepository>;
    let extra_charge_repo = Arc::new(PostgresExtraChargeRepository::new(pool.clone()))
        as Arc<dyn ExtraChargeRepository>;
    let cash_closure_repo = Arc::new(PostgresCashClosureRepository::new(pool.clone()))
        as Arc<dyn CashClosureRepository>;
    let invoice_repo =
        Arc::new(PostgresInvoiceRepository::new(pool.clone())) as Arc<dyn InvoiceRepository>;
    let hotel_repo = Arc::new(PostgresHotelRepository::new(pool.clone())) as Arc<dyn HotelRepository>;

    let audit_service = Arc::new(AuditService::new(audit_repo.clone()));
    let room_service = Arc::new(RoomService::new(room_repo.clone()));
    let booking_service = Arc::new(BookingService::new(
        booking_repo.clone(),
        room_repo.clone(),
        guest_repo.clone(),
        room_service.clone(),
        audit_service.clone(),
        invoice_repo.clone(),
    ));
    let analytics_service = Arc::new(AnalyticsService::new(booking_repo.clone()));
    let reporting_service = Arc::new(ReportingService::new(booking_repo.clone()));
    let guest_service = Arc::new(GuestService::new(guest_repo.clone()));
    let hotel_service = Arc::new(HotelService::new(hotel_repo.clone()));
    let billing_service = Arc::new(BillingService::new(
        extra_charge_repo.clone(),
        booking_repo.clone(),
    ));
    let cash_closure_service = Arc::new(CashClosureService::new(
        cash_closure_repo.clone(),
        invoice_repo.clone(),
    ));
    let housekeeping_service = Arc::new(HousekeepingService::new(
        room_repo.clone(),
        room_service.clone(),
        audit_service.clone(),
    ));
    let auth_service = Arc::new(AuthService::new(
        user_repo.clone(),
        refresh_repo.clone(),
        config.access_ttl_minutes,
        config.refresh_ttl_days,
    ));

    Arc::new(AppState {
        room_repo,
        hotel_repo,
        booking_service,
        analytics_service,
        reporting_service,
        guest_service,
        room_service,
        hotel_service,
        billing_service,
        cash_closure_service,
        housekeeping_service,
        audit_service,
        guest_repo,
        user_repo,
        refresh_repo,
        audit_repo,
        extra_charge_repo,
        cash_closure_repo,
        invoice_repo,
        auth_service,
        config,
    })
}

async fn assert_status(
    app: &axum::Router,
    method: Method,
    path: &str,
    token: &str,
    body: Option<String>,
    with_csrf: bool,
    expected: StatusCode,
) {
    let method_for_error = method.clone();
    let mut builder = Request::builder()
        .method(method)
        .uri(path)
        .header(header::AUTHORIZATION, format!("Bearer {}", token));

    if with_csrf {
        builder = builder
            .header(header::COOKIE, "csrf_token=test-token")
            .header("x-csrf-token", "test-token");
    }

    let mut request = if let Some(payload) = body {
        builder
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(payload))
            .unwrap()
    } else {
        builder.body(Body::empty()).unwrap()
    };
    request
        .extensions_mut()
        .insert(SocketAddr::from(([127, 0, 0, 1], 40000)));
    request.extensions_mut().insert(ConnectInfo(SocketAddr::from((
        [127, 0, 0, 1],
        40000,
    ))));

    let response = app.clone().oneshot(request).await.unwrap();
    let status = response.status();
    if status != expected {
        let body_bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body_text = String::from_utf8_lossy(&body_bytes);
        panic!(
            "unexpected status for {} {}: got {}, expected {}, body={}",
            method_for_error, path, status, expected, body_text
        );
    }
}
