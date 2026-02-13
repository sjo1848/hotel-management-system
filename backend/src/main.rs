use hms_backend::app_state::AppState;
use hms_backend::application::{
    analytics_service::AnalyticsService, audit_service::AuditService, auth_service::AuthService,
    billing_service::BillingService, booking_service::BookingService,
    cash_closure_service::CashClosureService, guest_service::GuestService,
    hotel_service::HotelService, housekeeping_service::HousekeepingService,
    reporting_service::ReportingService, room_service::RoomService,
};
use hms_backend::config::AppConfig;
use hms_backend::domain::repositories::{
    AuditRepository, BookingRepository, CashClosureRepository, ExtraChargeRepository,
    GuestRepository, HotelRepository, InvoiceRepository, RefreshTokenRepository, RoomRepository,
    UserRepository,
};
use hms_backend::infrastructure::{
    repository::{
        postgres::PostgresRoomRepository, postgres_audit::PostgresAuditRepository,
        postgres_booking::PostgresBookingRepository,
        postgres_cash_closure::PostgresCashClosureRepository,
        postgres_extra_charge::PostgresExtraChargeRepository,
        postgres_guest::PostgresGuestRepository, postgres_hotel::PostgresHotelRepository,
        postgres_invoice::PostgresInvoiceRepository,
        postgres_refresh_token::PostgresRefreshTokenRepository,
        postgres_user::PostgresUserRepository,
    },
    seeder,
    web::routes::create_router,
};
use opentelemetry::KeyValue;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{trace as sdktrace, Resource};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

fn init_tracing(config: &AppConfig) {
    let env_filter = tracing_subscriber::EnvFilter::from_default_env();
    let fmt_layer = tracing_subscriber::fmt::layer().json();

    if !config.otel_enabled {
        tracing_subscriber::registry()
            .with(env_filter)
            .with(fmt_layer)
            .init();
        return;
    }

    let trace_config = sdktrace::Config::default().with_resource(Resource::new(vec![
        KeyValue::new("service.name", config.otel_service_name.clone()),
        KeyValue::new("deployment.environment", config.app_env.clone()),
    ]));

    let otlp_exporter = opentelemetry_otlp::new_exporter()
        .tonic()
        .with_endpoint(config.otel_exporter_endpoint.clone());

    let otel_result = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_trace_config(trace_config)
        .with_exporter(otlp_exporter)
        .install_batch(opentelemetry_sdk::runtime::Tokio);

    match otel_result {
        Ok(tracer) => {
            let otel_layer = tracing_opentelemetry::layer().with_tracer(tracer);
            tracing_subscriber::registry()
                .with(env_filter)
                .with(fmt_layer)
                .with(otel_layer)
                .init();
            tracing::info!(
                endpoint = %config.otel_exporter_endpoint,
                service = %config.otel_service_name,
                "OpenTelemetry tracing enabled"
            );
        }
        Err(error) => {
            eprintln!(
                "⚠️ OpenTelemetry disabled due to init error: {}. Falling back to JSON logging only.",
                error
            );
            tracing_subscriber::registry()
                .with(env_filter)
                .with(fmt_layer)
                .init();
        }
    }
}

#[tokio::main]
async fn main() {
    // 1. Load Config from Env
    let config = AppConfig::from_env();
    // 2. Initialize Logging/Tracing
    init_tracing(&config);

    // 3. Connect to Database
    let pool = PgPoolOptions::new()
        .max_connections(config.db_max_connections)
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
    let hotel_repo =
        Arc::new(PostgresHotelRepository::new(pool.clone())) as Arc<dyn HotelRepository>;

    // 6. Initialize Services
    let audit_service = Arc::new(AuditService::new(audit_repo.clone()));
    let hotel_service = Arc::new(HotelService::new(hotel_repo.clone()));
    let billing_service = Arc::new(BillingService::new(
        extra_charge_repo.clone(),
        booking_repo.clone(),
    ));
    let cash_closure_service = Arc::new(CashClosureService::new(
        cash_closure_repo.clone(),
        invoice_repo.clone(),
    ));
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

    // 7. Seed Initial Data
    seeder::bootstrap_admin_user(&config, user_repo.clone()).await;
    seeder::seed_rooms_if_empty(room_repo.clone()).await;

    // 8. Create Shared State
    let shared_state = Arc::new(AppState {
        room_repo: room_repo.clone(),
        hotel_repo: hotel_repo.clone(),
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
        user_repo: user_repo.clone(),
        refresh_repo,
        audit_repo,
        extra_charge_repo,
        cash_closure_repo,
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
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}
