use axum::{
    extract::DefaultBodyLimit,
    http::{
        header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE, COOKIE, HeaderName},
        HeaderValue, Method,
    },
    middleware,
    routing::{get, post, patch, delete},
    Router,
};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;
use crate::infrastructure::web::openapi::ApiDoc;
use std::sync::Arc;
use std::time::Duration;
use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer};
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};

use crate::app_state::AppState;
use crate::infrastructure::web::handlers::{
    create_booking_handler, create_guest_handler, create_room_handler, create_user_handler, get_dashboard_kpis_handler,
    finish_cleaning_handler, get_invoice_by_booking_handler, get_occupancy_report_handler, get_revenue_report_handler,
    get_rooms_handler, health_check, list_bookings_handler, list_dirty_rooms_handler, list_guests_handler,
    list_invoices_handler, list_users_handler, delete_user_handler, login_handler, logout_handler, me_handler, readiness_check,
    refresh_handler, root_handler, search_rooms_handler, start_cleaning_handler, update_booking_handler,
    update_room_status_handler, list_hotels_handler, create_hotel_handler, add_extra_charge_handler, list_extra_charges_handler,
    get_current_balance_handler, close_cash_handler,
};
use crate::infrastructure::web::middleware::{
    auth::auth_middleware, rbac::admin_only, request_id::request_id_middleware, metrics::track_metrics,
    security_headers::security_headers_middleware, rate_limit_logger::rate_limit_logger_middleware,
};

pub fn create_router(state: Arc<AppState>) -> Router {
    let config = &state.config;

    // --- Metrics Handler ---
    let metrics_handle = metrics_exporter_prometheus::PrometheusBuilder::new()
        .install_recorder()
        .expect("failed to install recorder");

    // --- Rate Limiting Configuration ---
    let api_rate = Arc::new(
        GovernorConfigBuilder::default()
            .period(Duration::from_millis(per_minute_to_period_ms(
                config.rate_limit_per_minute,
            )))
            .burst_size(config.rate_limit_per_minute.max(1))
            .finish()
            .unwrap(),
    );

    let login_rate = Arc::new(
        GovernorConfigBuilder::default()
            .period(Duration::from_millis(per_minute_to_period_ms(
                config.login_limit_per_minute,
            )))
            .burst_size(config.login_limit_per_minute.max(1))
            .finish()
            .unwrap(),
    );

    // --- CORS Configuration ---
    let cors_origins = parse_cors_origins(&config.cors_origin);
    let cors_origin = if cors_origins.is_empty() {
        AllowOrigin::list(vec![HeaderValue::from_static("http://localhost:5173")])
    } else {
        AllowOrigin::list(cors_origins)
    };

    let cors = CorsLayer::new()
        .allow_origin(cors_origin)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([AUTHORIZATION, CONTENT_TYPE, ACCEPT, COOKIE, HeaderName::from_static("x-csrf-token")])
        .allow_credentials(true);

    // --- Routes Definition ---
    
    let auth_router_v1 = Router::new()
        .route("/api/v1/auth/login", post(login_handler))
        .route("/api/v1/auth/refresh", post(refresh_handler))
        .route("/api/v1/auth/logout", post(logout_handler))
        .layer(middleware::from_fn(rate_limit_logger_middleware)) // Log fallos de login masivos
        .layer(GovernorLayer { config: login_rate });

    let api_v1 = Router::new()
        .merge(auth_router_v1)
        .route("/api/v1/hotels", get(list_hotels_handler).post(create_hotel_handler).layer(middleware::from_fn(admin_only)))
        .route("/api/v1/rooms", get(get_rooms_handler).merge(post(create_room_handler).layer(middleware::from_fn(admin_only))))
        .route("/api/v1/rooms/available", get(search_rooms_handler))
        .route("/api/v1/rooms/:id/status", patch(update_room_status_handler))
        .route("/api/v1/bookings", get(list_bookings_handler).post(create_booking_handler))
        .route("/api/v1/bookings/:id", patch(update_booking_handler))
        .route("/api/v1/bookings/:id/extra-charges", get(list_extra_charges_handler).post(add_extra_charge_handler))
        .route("/api/v1/guests", get(list_guests_handler).post(create_guest_handler))
        .route("/api/v1/auth/me", get(me_handler))
        .route("/api/v1/users", get(list_users_handler).post(create_user_handler).layer(middleware::from_fn(admin_only)))
        .route("/api/v1/users/:id", delete(delete_user_handler).layer(middleware::from_fn(admin_only)))
        .route("/api/v1/analytics/kpis", get(get_dashboard_kpis_handler).layer(middleware::from_fn(admin_only)))
        .route("/api/v1/billing/balance", get(get_current_balance_handler))
        .route("/api/v1/billing/close-cash", post(close_cash_handler))
        .route("/api/v1/invoices", get(list_invoices_handler).layer(middleware::from_fn(admin_only)))
        .route("/api/v1/bookings/:id/invoice", get(get_invoice_by_booking_handler))
        .route("/api/v1/housekeeping/dirty", get(list_dirty_rooms_handler))
        .route("/api/v1/housekeeping/:id/start", post(start_cleaning_handler))
        .route("/api/v1/housekeeping/:id/finish", post(finish_cleaning_handler))
        .route("/api/v1/reports/revenue", get(get_revenue_report_handler).layer(middleware::from_fn(admin_only)))
        .route("/api/v1/reports/occupancy", get(get_occupancy_report_handler).layer(middleware::from_fn(admin_only)));

    let auth_layer = middleware::from_fn_with_state(state.clone(), auth_middleware);

    Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .route("/", get(root_handler))
        .route("/health", get(health_check))
        .route("/ready", get(readiness_check))
        .route("/metrics", get(move || {
            let handle = metrics_handle.clone();
            async move { handle.render() }
        }))
        .merge(api_v1)
        .route_layer(auth_layer)
        .layer(middleware::from_fn(track_metrics))
        .layer(middleware::from_fn_with_state(state.clone(), security_headers_middleware))
        .layer(middleware::from_fn(rate_limit_logger_middleware)) // Log general de rate limit
        .layer(GovernorLayer { config: api_rate })
        .layer(cors)
        .layer(DefaultBodyLimit::max(1024 * 1024))
        .layer(TraceLayer::new_for_http())
        .layer(middleware::from_fn(request_id_middleware))
        .with_state(state)
}

fn per_minute_to_period_ms(per_minute: u32) -> u64 {
    let per_minute = per_minute.max(1);
    let ms = 60_000u64 / per_minute as u64;
    if ms == 0 { 1 } else { ms }
}

fn parse_cors_origins(raw: &str) -> Vec<HeaderValue> {
    raw.split(',')
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .filter_map(|value| HeaderValue::from_str(value).ok())
        .collect()
}
