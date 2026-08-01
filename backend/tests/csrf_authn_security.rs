use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::{header, Method, Request, StatusCode};
use hms_backend::app_state::AppState;
use hms_backend::application::{
    analytics_service::AnalyticsService, audit_service::AuditService, auth_service::AuthService,
    billing_service::BillingService, booking_service::BookingService,
    booking_transaction_service::BookingTransactionService,
    cash_closure_service::CashClosureService, front_desk_service::FrontDeskService,
    guest_service::GuestService, hotel_service::HotelService,
    housekeeping_service::HousekeepingService, invoice_service::InvoiceService,
    maintenance_service::MaintenanceService, reporting_service::ReportingService,
    room_hold_service::RoomHoldService, room_service::RoomService, user_service::UserService,
};
use hms_backend::config::AppConfig;
use hms_backend::domain::repositories::{
    AuditRepository, BookingRepository, BookingTransactionRepository, CashClosureRepository,
    ExtraChargeRepository, GuestRepository, HotelRepository, InvoiceRepository,
    MaintenanceCaseRepository, PaymentEntryRepository, RefreshTokenRepository, RoomHoldRepository,
    RoomRepository, UserRepository,
};
use hms_backend::domain::security::{PasswordHasher, TokenSigner};
use hms_backend::infrastructure::repository::{
    postgres::PostgresRoomRepository, postgres_audit::PostgresAuditRepository,
    postgres_booking::PostgresBookingRepository,
    postgres_booking_transaction::PostgresBookingTransactionRepository,
    postgres_cash_closure::PostgresCashClosureRepository,
    postgres_extra_charge::PostgresExtraChargeRepository, postgres_guest::PostgresGuestRepository,
    postgres_hotel::PostgresHotelRepository, postgres_invoice::PostgresInvoiceRepository,
    postgres_maintenance_case::PostgresMaintenanceCaseRepository,
    postgres_payment_entry::PostgresPaymentEntryRepository,
    postgres_refresh_token::PostgresRefreshTokenRepository,
    postgres_room_hold::PostgresRoomHoldRepository, postgres_user::PostgresUserRepository,
};
use hms_backend::infrastructure::web::jwt::JwtTokenSigner;
use hms_backend::infrastructure::web::passwords::{hash_password, ArgonPasswordHasher};
use hms_backend::infrastructure::web::routes::create_router;
use std::net::SocketAddr;
use std::sync::Arc;
use tower::ServiceExt;
use uuid::Uuid;

#[sqlx::test]
async fn csrf_and_authn_contract_is_enforced(pool: sqlx::PgPool) {
    let hotel_id = Uuid::new_v4();
    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_id)
        .bind("Hotel Security QA")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();

    let username = "security_admin";
    let password = "password123";
    insert_user(&pool, hotel_id, username, password, "admin").await;

    let config = AppConfig::from_env();
    let app = create_router(build_state(pool, config));

    // Login does not require CSRF token (session bootstrap endpoint).
    let login_body = format!(
        r#"{{"hotel_id":"{}","username":"{}","password":"{}"}}"#,
        hotel_id, username, password
    );
    let login_response = send_request(
        &app,
        Method::POST,
        "/api/v1/auth/login",
        Some(login_body),
        None,
        None,
    )
    .await;
    assert_eq!(login_response.status(), StatusCode::OK);
    assert_eq!(
        login_response
            .headers()
            .get("x-api-version")
            .and_then(|v| v.to_str().ok()),
        Some("v1")
    );

    let login_cookies = collect_set_cookie_values(&login_response);
    let refresh_token = extract_cookie_value(&login_cookies, "refresh_token").unwrap();
    let csrf_token = extract_cookie_value(&login_cookies, "csrf_token").unwrap();
    let refresh_cookie = format!("refresh_token={}; csrf_token={}", refresh_token, csrf_token);

    // Refresh without CSRF must fail.
    let refresh_no_csrf = send_request(
        &app,
        Method::POST,
        "/api/v1/auth/refresh",
        None,
        Some(format!("refresh_token={}", refresh_token)),
        None,
    )
    .await;
    assert_eq!(refresh_no_csrf.status(), StatusCode::BAD_REQUEST);

    // Refresh with invalid CSRF must fail.
    let refresh_bad_csrf = send_request(
        &app,
        Method::POST,
        "/api/v1/auth/refresh",
        None,
        Some(refresh_cookie.clone()),
        Some("invalid-token"),
    )
    .await;
    assert_eq!(refresh_bad_csrf.status(), StatusCode::BAD_REQUEST);

    // Refresh with valid CSRF must pass.
    let refresh_ok = send_request(
        &app,
        Method::POST,
        "/api/v1/auth/refresh",
        None,
        Some(refresh_cookie),
        Some(&csrf_token),
    )
    .await;
    assert_eq!(refresh_ok.status(), StatusCode::OK);
    let rotated_cookies = collect_set_cookie_values(&refresh_ok);
    let rotated_csrf = extract_cookie_value(&rotated_cookies, "csrf_token").unwrap();

    // Replay del refresh token anterior debe fallar (token revocado tras rotación).
    let refresh_replay = send_request(
        &app,
        Method::POST,
        "/api/v1/auth/refresh",
        None,
        Some(format!(
            "refresh_token={}; csrf_token={}",
            refresh_token, rotated_csrf
        )),
        Some(&rotated_csrf),
    )
    .await;
    assert_eq!(refresh_replay.status(), StatusCode::UNAUTHORIZED);

    // Protected endpoint without token must return 401.
    let users_no_auth = send_request(&app, Method::GET, "/api/v1/users", None, None, None).await;
    assert_eq!(users_no_auth.status(), StatusCode::UNAUTHORIZED);

    // New login for logout checks with a fresh refresh token.
    let second_login = send_request(
        &app,
        Method::POST,
        "/api/v1/auth/login",
        Some(format!(
            r#"{{"hotel_id":"{}","username":"{}","password":"{}"}}"#,
            hotel_id, username, password
        )),
        None,
        None,
    )
    .await;
    assert_eq!(second_login.status(), StatusCode::OK);
    let second_cookies = collect_set_cookie_values(&second_login);
    let second_refresh = extract_cookie_value(&second_cookies, "refresh_token").unwrap();
    let second_csrf = extract_cookie_value(&second_cookies, "csrf_token").unwrap();

    // Logout without CSRF must fail.
    let logout_no_csrf = send_request(
        &app,
        Method::POST,
        "/api/v1/auth/logout",
        None,
        Some(format!("refresh_token={}", second_refresh)),
        None,
    )
    .await;
    assert_eq!(logout_no_csrf.status(), StatusCode::BAD_REQUEST);

    // Logout with valid CSRF must pass.
    let logout_ok = send_request(
        &app,
        Method::POST,
        "/api/v1/auth/logout",
        None,
        Some(format!(
            "refresh_token={}; csrf_token={}",
            second_refresh, second_csrf
        )),
        Some(&second_csrf),
    )
    .await;
    assert_eq!(logout_ok.status(), StatusCode::OK);
}

async fn insert_user(
    pool: &sqlx::PgPool,
    hotel_id: Uuid,
    username: &str,
    password: &str,
    role: &str,
) {
    let id = Uuid::new_v4();
    let password_hash = hash_password(password).unwrap();
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
}

fn build_state(pool: sqlx::PgPool, config: AppConfig) -> Arc<AppState> {
    let room_repo = Arc::new(PostgresRoomRepository::new(pool.clone())) as Arc<dyn RoomRepository>;
    let booking_repo =
        Arc::new(PostgresBookingRepository::new(pool.clone())) as Arc<dyn BookingRepository>;
    let booking_transaction_repo = Arc::new(PostgresBookingTransactionRepository::new(pool.clone()))
        as Arc<dyn BookingTransactionRepository>;
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
    let payment_entry_repo = Arc::new(PostgresPaymentEntryRepository::new(pool.clone()))
        as Arc<dyn PaymentEntryRepository>;
    let room_hold_repo =
        Arc::new(PostgresRoomHoldRepository::new(pool.clone())) as Arc<dyn RoomHoldRepository>;
    let hotel_repo =
        Arc::new(PostgresHotelRepository::new(pool.clone())) as Arc<dyn HotelRepository>;
    let password_hasher = Arc::new(ArgonPasswordHasher) as Arc<dyn PasswordHasher>;
    let token_signer = Arc::new(JwtTokenSigner::new(
        config.jwt_secret.clone(),
        config.jwt_previous_secret.clone(),
        config.jwt_kid.clone(),
    )) as Arc<dyn TokenSigner>;

    let audit_service = Arc::new(AuditService::new(audit_repo.clone()));
    let room_service = Arc::new(RoomService::new(room_repo.clone()));
    let room_hold_service = Arc::new(RoomHoldService::new(
        room_hold_repo.clone(),
        room_repo.clone(),
    ));
    let booking_service = Arc::new(BookingService::new(
        booking_repo.clone(),
        room_repo.clone(),
        guest_repo.clone(),
        room_service.clone(),
        room_hold_service.clone(),
        audit_service.clone(),
        invoice_repo.clone(),
    ));
    let booking_transaction_service =
        Arc::new(BookingTransactionService::new(booking_transaction_repo));
    let front_desk_service = Arc::new(FrontDeskService::new(
        booking_repo.clone(),
        room_repo.clone(),
        room_hold_service.clone(),
    ));
    let analytics_service = Arc::new(AnalyticsService::new(booking_repo.clone()));
    let reporting_service = Arc::new(ReportingService::new(booking_repo.clone()));
    let guest_service = Arc::new(GuestService::new(guest_repo.clone()));
    let hotel_service = Arc::new(HotelService::new(hotel_repo.clone()));
    let billing_service = Arc::new(BillingService::new(
        extra_charge_repo.clone(),
        booking_repo.clone(),
        invoice_repo.clone(),
        payment_entry_repo.clone(),
    ));
    let cash_closure_service = Arc::new(CashClosureService::new(
        cash_closure_repo.clone(),
        invoice_repo.clone(),
        payment_entry_repo.clone(),
    ));
    let housekeeping_service = Arc::new(HousekeepingService::new(
        room_repo.clone(),
        booking_repo.clone(),
        room_service.clone(),
        audit_service.clone(),
        Arc::new(MaintenanceService::new(
            Arc::new(PostgresMaintenanceCaseRepository::new(pool.clone()))
                as Arc<dyn MaintenanceCaseRepository>,
        )),
    ));
    let invoice_service = Arc::new(InvoiceService::new(
        invoice_repo.clone(),
        payment_entry_repo.clone(),
    ));
    let user_service = Arc::new(UserService::new(user_repo.clone(), password_hasher.clone()));
    let auth_service = Arc::new(AuthService::new(
        user_repo.clone(),
        refresh_repo.clone(),
        password_hasher,
        token_signer,
        config.access_ttl_minutes,
        config.refresh_ttl_days,
    ));

    Arc::new(AppState {
        booking_service,
        booking_transaction_service,
        front_desk_service,
        analytics_service,
        reporting_service,
        guest_service,
        room_service,
        room_hold_service,
        hotel_service,
        billing_service,
        cash_closure_service,
        housekeeping_service,
        invoice_service,
        user_service,
        audit_service,
        auth_service,
        config,
    })
}

async fn send_request(
    app: &axum::Router,
    method: Method,
    path: &str,
    body: Option<String>,
    cookie: Option<String>,
    csrf_header: Option<&str>,
) -> axum::response::Response {
    let mut builder = Request::builder().method(method).uri(path);

    if let Some(cookie_value) = cookie {
        builder = builder.header(header::COOKIE, cookie_value);
    }
    if let Some(csrf) = csrf_header {
        builder = builder.header("x-csrf-token", csrf);
    }

    let mut req = if let Some(payload) = body {
        builder
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(payload))
            .unwrap()
    } else {
        builder.body(Body::empty()).unwrap()
    };

    let addr = SocketAddr::from(([127, 0, 0, 1], 40001));
    req.extensions_mut().insert(addr);
    req.extensions_mut().insert(ConnectInfo(addr));

    app.clone().oneshot(req).await.unwrap()
}

fn collect_set_cookie_values(response: &axum::response::Response) -> Vec<String> {
    response
        .headers()
        .get_all(header::SET_COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok().map(ToString::to_string))
        .collect()
}

fn extract_cookie_value(cookies: &[String], name: &str) -> Option<String> {
    let needle = format!("{}=", name);
    for cookie in cookies {
        if let Some(segment) = cookie.split(';').next() {
            if segment.starts_with(&needle) {
                return Some(segment.trim_start_matches(&needle).to_string());
            }
        }
    }
    None
}
