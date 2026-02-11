use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use std::sync::Arc;
use hms_backend::app_state::AppState;
use hms_backend::application::{
    analytics_service::AnalyticsService, auth_service::AuthService, booking_service::BookingService,
    room_service::RoomService, reporting_service::ReportingService,
    guest_service::GuestService, housekeeping_service::HousekeepingService,
};
use hms_backend::config::AppConfig;
use hms_backend::domain::repositories::{
    AuditRepository, BookingRepository, GuestRepository, InvoiceRepository, RefreshTokenRepository, RoomRepository,
    UserRepository,
};
use hms_backend::infrastructure::{
    repository::{
        postgres::PostgresRoomRepository, postgres_audit::PostgresAuditRepository,
        postgres_booking::PostgresBookingRepository, postgres_guest::PostgresGuestRepository,
        postgres_invoice::PostgresInvoiceRepository,
        postgres_refresh_token::PostgresRefreshTokenRepository, postgres_user::PostgresUserRepository,
    },
    seeder,
    web::routes::create_router,
};

#[tokio::main]
async fn main() {
    // 1. Initialize Logging
    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .json()
        .finish();
    tracing::subscriber::set_global_default(subscriber).expect("setting default subscriber failed");

    // 2. Load Config from Env
    let config = AppConfig::from_env();

    // 3. Connect to Database
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&config.database_url)
        .await
        .expect("🚨 Error conectando a la DB");

    // 4. Run Migrations
    sqlx::migrate!()
        .run(&pool)
        .await
        .expect("🚨 Error aplicando migraciones");

    // 5. Initialize Repositories
    let room_repo = Arc::new(PostgresRoomRepository::new(pool.clone())) as Arc<dyn RoomRepository>;
    let booking_repo = Arc::new(PostgresBookingRepository::new(pool.clone())) as Arc<dyn BookingRepository>;
    let guest_repo = Arc::new(PostgresGuestRepository::new(pool.clone())) as Arc<dyn GuestRepository>;
    let user_repo = Arc::new(PostgresUserRepository::new(pool.clone())) as Arc<dyn UserRepository>;
    let refresh_repo = Arc::new(PostgresRefreshTokenRepository::new(pool.clone())) as Arc<dyn RefreshTokenRepository>;
    let audit_repo = Arc::new(PostgresAuditRepository::new(pool.clone())) as Arc<dyn AuditRepository>;
    let invoice_repo = Arc::new(PostgresInvoiceRepository::new(pool.clone())) as Arc<dyn InvoiceRepository>;

    // 6. Initialize Services
    let booking_service = Arc::new(BookingService::new(booking_repo.clone(), room_repo.clone(), audit_repo.clone(), invoice_repo.clone()));
    let analytics_service = Arc::new(AnalyticsService::new(booking_repo.clone()));
    let reporting_service = Arc::new(ReportingService::new(booking_repo.clone()));
    let room_service = Arc::new(RoomService::new(room_repo.clone()));
    let guest_service = Arc::new(GuestService::new(guest_repo.clone()));
    let housekeeping_service = Arc::new(HousekeepingService::new(room_repo.clone(), audit_repo.clone()));
    let auth_service = Arc::new(AuthService::new(
        user_repo.clone(),
        refresh_repo.clone(),
        config.access_ttl_minutes,
        config.refresh_ttl_days,
    ));

    // 7. Seed Initial Data
    seeder::bootstrap_admin_user(&config, user_repo.clone()).await;
    seeder::seed_rooms_if_empty(room_repo.clone()).await;

    // 8. Create Shared State
    let shared_state = Arc::new(AppState {
        room_repo: room_repo.clone(),
        booking_service,
        analytics_service,
        reporting_service,
        guest_service,
        room_service,
        housekeeping_service,
        guest_repo,
        user_repo: user_repo.clone(),
        refresh_repo,
        audit_repo,
        auth_service,
        invoice_repo,
        config: config.clone(),
    });

    // 9. Build Router
    let app = create_router(shared_state);

    // 10. Start Server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    println!("🚀 HMS Elite (Hexagonal) escuchando en {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
        .await
        .unwrap();
}