use hms_backend::bootstrap::build_app_state;
use hms_backend::config::AppConfig;
use hms_backend::infrastructure::web::routes::create_router;
use opentelemetry::KeyValue;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{trace as sdktrace, Resource};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
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

    // 5. Build Shared App State (repositories + services + seeders)
    let shared_state = build_app_state(pool.clone(), config.clone()).await;

    // 6. Build Router
    let app = create_router(shared_state);

    // 7. Start Server
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
