use axum::body::to_bytes;
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
use hms_backend::infrastructure::web::jwt::{encode_token, Claims};
use hms_backend::infrastructure::web::passwords::{hash_password, ArgonPasswordHasher};
use hms_backend::infrastructure::web::routes::create_router;
use serde_json::Value;
use std::net::SocketAddr;
use std::sync::Arc;
use tower::ServiceExt;
use uuid::Uuid;

#[sqlx::test]
async fn rbac_capability_matrix_enforced(pool: sqlx::PgPool) {
    let hotel_id = Uuid::new_v4();
    let other_hotel_id = Uuid::new_v4();
    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(hotel_id)
        .bind("Hotel RBAC QA")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
        .bind(other_hotel_id)
        .bind("Hotel RBAC QA 2")
        .bind("N/A")
        .execute(&pool)
        .await
        .unwrap();

    let admin_id = insert_user(&pool, hotel_id, "admin_rbac", "admin").await;
    let saas_admin_id = insert_user(&pool, hotel_id, "saas_admin_rbac", "saas_admin").await;
    let ops_id = insert_user(&pool, hotel_id, "ops_rbac", "ops").await;
    let reception_id = insert_user(&pool, hotel_id, "reception_rbac", "receptionist").await;
    let hk_id = insert_user(&pool, hotel_id, "housekeeping_rbac", "housekeeping").await;

    let config = AppConfig::from_env();
    let app = create_router(build_state(pool.clone(), config.clone()));

    let admin_token = make_token(&config.jwt_secret, admin_id, hotel_id, "admin");
    let saas_admin_token = make_token(&config.jwt_secret, saas_admin_id, hotel_id, "saas_admin");
    let ops_token = make_token(&config.jwt_secret, ops_id, hotel_id, "ops");
    let reception_token = make_token(&config.jwt_secret, reception_id, hotel_id, "receptionist");
    let hk_token = make_token(&config.jwt_secret, hk_id, hotel_id, "housekeeping");

    // Seed cross-tenant audit data to validate tenant-scoped reads.
    sqlx::query(
        "INSERT INTO audit_events (id, hotel_id, user_id, action, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_id)
    .bind(admin_id)
    .bind("RBAC_AUDIT_OWN_TENANT")
    .bind("127.0.0.1")
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO audit_events (id, hotel_id, user_id, action, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())",
    )
    .bind(Uuid::new_v4())
    .bind(other_hotel_id)
    .bind(Option::<Uuid>::None)
    .bind("RBAC_AUDIT_OTHER_TENANT")
    .bind("10.0.0.2")
    .execute(&pool)
    .await
    .unwrap();

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

    // Exercise critical booking handlers used by front desk flows.
    let booking_room_id = Uuid::new_v4();
    let booking_reassign_room_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents)
         VALUES ($1, $2, $3, $4, $5, $6), ($7, $2, $8, $9, $10, $11)",
    )
    .bind(booking_room_id)
    .bind(hotel_id)
    .bind("RBAC-101")
    .bind("Standard")
    .bind("AVAILABLE")
    .bind(12_000_i64)
    .bind(booking_reassign_room_id)
    .bind("RBAC-102")
    .bind("Standard Plus")
    .bind("AVAILABLE")
    .bind(13_500_i64)
    .execute(&pool)
    .await
    .unwrap();

    let booking_guest_name = format!("RBAC Booking {}", Uuid::new_v4());
    assert_status(
        &app,
        Method::POST,
        "/api/v1/bookings",
        &admin_token,
        Some(format!(
            r#"{{"room_id":"{}","guest_name":"{}","check_in":"2026-03-10","check_out":"2026-03-12"}}"#,
            booking_room_id, booking_guest_name
        )),
        true,
        StatusCode::CREATED,
    )
    .await;

    let booking_id: Uuid = sqlx::query_scalar(
        "SELECT id
         FROM bookings
         WHERE hotel_id = $1 AND guest_name = $2
         ORDER BY created_at DESC
         LIMIT 1",
    )
    .bind(hotel_id)
    .bind(&booking_guest_name)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_status(
        &app,
        Method::GET,
        "/api/v1/bookings?start=2026-03-01&end=2026-03-31",
        &admin_token,
        None,
        false,
        StatusCode::OK,
    )
    .await;
    assert_status(
        &app,
        Method::GET,
        "/api/v1/front-desk/board?date=2026-03-10",
        &admin_token,
        None,
        false,
        StatusCode::OK,
    )
    .await;

    assert_status(
        &app,
        Method::PATCH,
        &format!("/api/v1/bookings/{booking_id}"),
        &admin_token,
        Some(format!(
            r#"{{"room_id":"{}","operational_note":"Reasignacion operativa QA","front_desk":{{"check_in_reference":"CHK-123","check_in_guests_count":2,"check_in_document_verified":true,"check_in_contact_confirmed":true,"check_in_stay_confirmed":true}}}}"#,
            booking_reassign_room_id
        )),
        true,
        StatusCode::OK,
    )
    .await;

    assert_status(
        &app,
        Method::PATCH,
        &format!("/api/v1/bookings/{booking_id}"),
        &admin_token,
        Some(
            r#"{"status":"CheckedIn","operational_note":"Check in operativo QA","front_desk":{"check_in_reference":"CHK-456","check_in_guests_count":2,"check_in_document_verified":true,"check_in_contact_confirmed":true,"check_in_stay_confirmed":true}}"#
                .to_string(),
        ),
        true,
        StatusCode::OK,
    )
    .await;

    assert_status(
        &app,
        Method::POST,
        &format!("/api/v1/bookings/{booking_id}/extra-charges"),
        &admin_token,
        Some(
            r#"{"description":"Minibar nocturno","amount_cents":1800,"category":"MINIBAR"}"#
                .to_string(),
        ),
        true,
        StatusCode::OK,
    )
    .await;

    assert_status(
        &app,
        Method::GET,
        &format!("/api/v1/bookings/{booking_id}/extra-charges"),
        &admin_token,
        None,
        false,
        StatusCode::OK,
    )
    .await;

    assert_status(
        &app,
        Method::POST,
        &format!("/api/v1/bookings/{booking_id}/payments"),
        &admin_token,
        Some(
            r#"{"amount_cents":1000,"payment_method":"CASH","payment_reference":"POS-001","note":"Cobro parcial QA"}"#
                .to_string(),
        ),
        true,
        StatusCode::OK,
    )
    .await;

    assert_status(
        &app,
        Method::POST,
        &format!("/api/v1/bookings/{booking_id}/settle-payment"),
        &admin_token,
        Some(r#"{"payment_method":"CARD","payment_reference":"POS-002"}"#.to_string()),
        true,
        StatusCode::OK,
    )
    .await;

    assert_status(
        &app,
        Method::GET,
        &format!("/api/v1/bookings/{booking_id}/payments"),
        &admin_token,
        None,
        false,
        StatusCode::OK,
    )
    .await;
    assert_status(
        &app,
        Method::GET,
        &format!("/api/v1/bookings/{booking_id}/invoice"),
        &admin_token,
        None,
        false,
        StatusCode::OK,
    )
    .await;
    assert_status(
        &app,
        Method::GET,
        "/api/v1/invoices",
        &admin_token,
        None,
        false,
        StatusCode::OK,
    )
    .await;

    assert_status(
        &app,
        Method::PATCH,
        &format!("/api/v1/bookings/{booking_id}"),
        &admin_token,
        Some(
            r#"{"status":"CheckedOut","operational_note":"Checkout operativo QA","front_desk":{"check_out_payment_policy":"settled","check_out_reference":"CHECKOUT-001","check_out_charges_reviewed":true,"check_out_room_release_confirmed":true,"check_out_housekeeping_handoff":true}}"#
                .to_string(),
        ),
        true,
        StatusCode::OK,
    )
    .await;

    // Only admin can authorize checkout with a pending balance.
    let override_room_id = Uuid::new_v4();
    let override_booking_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(override_room_id)
    .bind(hotel_id)
    .bind("RBAC-OVR")
    .bind("Standard")
    .bind("OCCUPIED")
    .bind(10_000_i64)
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO bookings (
            id, hotel_id, room_id, guest_name, check_in, check_out,
            total_price_cents, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(override_booking_id)
    .bind(hotel_id)
    .bind(override_room_id)
    .bind("RBAC Override Guest")
    .bind(chrono::NaiveDate::from_ymd_opt(2026, 3, 20).unwrap())
    .bind(chrono::NaiveDate::from_ymd_opt(2026, 3, 22).unwrap())
    .bind(20_000_i64)
    .bind("CHECKED_IN")
    .execute(&pool)
    .await
    .unwrap();
    let pending_override_payload = r#"{"status":"CheckedOut","front_desk":{"check_out_payment_policy":"pending-approved","check_out_reference":"OVERRIDE-RBAC-001","check_out_charges_reviewed":true,"check_out_room_release_confirmed":true,"check_out_housekeeping_handoff":true}}"#;

    assert_status(
        &app,
        Method::PATCH,
        &format!("/api/v1/bookings/{override_booking_id}"),
        &reception_token,
        Some(pending_override_payload.to_string()),
        true,
        StatusCode::FORBIDDEN,
    )
    .await;
    let denied_booking_status: String =
        sqlx::query_scalar("SELECT status FROM bookings WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(override_booking_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(denied_booking_status, "CHECKED_IN");

    assert_status(
        &app,
        Method::PATCH,
        &format!("/api/v1/bookings/{override_booking_id}"),
        &admin_token,
        Some(pending_override_payload.to_string()),
        true,
        StatusCode::OK,
    )
    .await;
    let override_audit: (Uuid, String) = sqlx::query_as(
        "SELECT user_id, action
         FROM audit_events
         WHERE hotel_id = $1
           AND action LIKE 'CO_OVERRIDE booking=%'
         ORDER BY created_at DESC
         LIMIT 1",
    )
    .bind(hotel_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(override_audit.0, admin_id);
    assert!(override_audit.1.contains(&override_booking_id.to_string()));
    assert!(override_audit.1.contains("due=20000"));
    assert!(override_audit.1.contains("ref=OVERRIDE-RBAC-001"));

    // Ops can read tenant-scoped audit events.
    assert_status(
        &app,
        Method::GET,
        "/api/v1/audit/events",
        &ops_token,
        None,
        false,
        StatusCode::OK,
    )
    .await;

    let audit_payload = get_json(&app, "/api/v1/audit/events?limit=50", &ops_token).await;
    let items = audit_payload
        .as_array()
        .expect("audit response must be an array");
    assert!(
        !items.is_empty(),
        "audit response should include at least one event"
    );
    let hotel_id_str = hotel_id.to_string();
    let other_hotel_id_str = other_hotel_id.to_string();
    assert!(
        items.iter().all(|item| {
            item.get("hotel_id")
                .and_then(Value::as_str)
                .map(|value| value == hotel_id_str)
                .unwrap_or(false)
        }),
        "audit response must include only current tenant events"
    );
    assert!(
        items.iter().all(|item| {
            item.get("hotel_id")
                .and_then(Value::as_str)
                .map(|value| value != other_hotel_id_str)
                .unwrap_or(true)
        }),
        "audit response leaked events from another tenant"
    );

    // Tenant admin cannot cross into SaaS network scope.
    assert_status(
        &app,
        Method::GET,
        "/api/v1/hotels",
        &admin_token,
        None,
        false,
        StatusCode::FORBIDDEN,
    )
    .await;
    assert_status(
        &app,
        Method::POST,
        "/api/v1/hotels",
        &admin_token,
        Some(r#"{"name":"Forbidden tenant admin hotel","address":"N/A"}"#.to_string()),
        true,
        StatusCode::FORBIDDEN,
    )
    .await;

    // Tenant admin cannot provision a platform principal through /users.
    let escalated_username = format!("saas-escalation-{}", Uuid::new_v4());
    assert_status(
        &app,
        Method::POST,
        "/api/v1/users",
        &admin_token,
        Some(format!(
            r#"{{"username":"{}","password":"test-password-123","role":"saas_admin"}}"#,
            escalated_username
        )),
        true,
        StatusCode::BAD_REQUEST,
    )
    .await;
    let escalated_user_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::BIGINT FROM users WHERE hotel_id = $1 AND username = $2",
    )
    .bind(hotel_id)
    .bind(&escalated_username)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(escalated_user_count, 0);

    // Tenant user management exposes every operational role, canonicalizes it,
    // attributes the audit to the admin, and keeps platform identities isolated.
    for (input_role, stored_role) in [
        ("admin", "admin"),
        ("ops", "ops"),
        (" Receptionist ", "receptionist"),
        ("housekeeping", "housekeeping"),
    ] {
        let username = format!("wf005-{}-{}", stored_role, Uuid::new_v4());
        assert_status(
            &app,
            Method::POST,
            "/api/v1/users",
            &admin_token,
            Some(format!(
                r#"{{"username":"{}","password":"test-password-123","role":"{}"}}"#,
                username, input_role
            )),
            true,
            StatusCode::OK,
        )
        .await;

        let created_user: (Uuid, String) =
            sqlx::query_as("SELECT id, role FROM users WHERE hotel_id = $1 AND username = $2")
                .bind(hotel_id)
                .bind(&username)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(created_user.1, stored_role);

        let audit_actor: Uuid = sqlx::query_scalar(
            "SELECT user_id FROM audit_events
             WHERE hotel_id = $1 AND action LIKE $2
             ORDER BY created_at DESC LIMIT 1",
        )
        .bind(hotel_id)
        .bind(format!(
            "user.created: {} role={}%",
            created_user.0, stored_role
        ))
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(audit_actor, admin_id);
    }

    let tenant_users = get_json(&app, "/api/v1/users", &admin_token).await;
    assert!(tenant_users
        .as_array()
        .unwrap()
        .iter()
        .all(|user| user.get("role").and_then(Value::as_str) != Some("saas_admin")));
    assert_status(
        &app,
        Method::DELETE,
        &format!("/api/v1/users/{}", saas_admin_id),
        &admin_token,
        None,
        true,
        StatusCode::FORBIDDEN,
    )
    .await;
    let platform_user_still_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE hotel_id = $1 AND id = $2)")
            .bind(hotel_id)
            .bind(saas_admin_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(platform_user_still_exists);

    // SaaS admin can list hotels.
    assert_status(
        &app,
        Method::GET,
        "/api/v1/hotels",
        &saas_admin_token,
        None,
        false,
        StatusCode::OK,
    )
    .await;

    // SaaS admin can create hotels.
    assert_status(
        &app,
        Method::POST,
        "/api/v1/hotels",
        &saas_admin_token,
        Some(format!(
            r#"{{"name":"Hotel SaaS {}","address":"HQ"}}"#,
            Uuid::new_v4()
        )),
        true,
        StatusCode::OK,
    )
    .await;

    // Ops cannot list hotels in SaaS network scope.
    assert_status(
        &app,
        Method::GET,
        "/api/v1/hotels",
        &ops_token,
        None,
        false,
        StatusCode::FORBIDDEN,
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

    // Reception cannot read audit events.
    assert_status(
        &app,
        Method::GET,
        "/api/v1/audit/events",
        &reception_token,
        None,
        false,
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
    encode_token(&claims, secret, "test-kid").unwrap()
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
    request
        .extensions_mut()
        .insert(ConnectInfo(SocketAddr::from(([127, 0, 0, 1], 40000))));

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

async fn get_json(app: &axum::Router, path: &str, token: &str) -> Value {
    let mut request = Request::builder()
        .method(Method::GET)
        .uri(path)
        .header(header::AUTHORIZATION, format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();
    request
        .extensions_mut()
        .insert(SocketAddr::from(([127, 0, 0, 1], 40000)));
    request
        .extensions_mut()
        .insert(ConnectInfo(SocketAddr::from(([127, 0, 0, 1], 40000))));

    let response = app.clone().oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body_bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    serde_json::from_slice(&body_bytes).expect("response must be valid json")
}
