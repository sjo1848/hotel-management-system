use axum::{
    extract::DefaultBodyLimit,
    http::{
        header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE, COOKIE, HeaderName},
        HeaderValue, Method,
    },
    middleware,
    routing::{get, post, patch},
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
    create_booking_handler, create_guest_handler, create_user_handler, get_dashboard_kpis_handler,
    get_invoice_by_booking_handler, get_rooms_handler, health_check, list_bookings_handler,
    list_guests_handler, list_invoices_handler, list_users_handler, login_handler, logout_handler,
    me_handler, readiness_check, refresh_handler, root_handler, search_rooms_handler,
    update_booking_handler, update_room_status_handler,
};
use crate::infrastructure::web::middleware::{
    auth::auth_middleware, rbac::admin_only, request_id::request_id_middleware,
};

pub fn create_router(state: Arc<AppState>) -> Router {
    let config = &state.config;

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
    
    let auth_router_legacy = Router::new()
        .route("/api/auth/login", post(login_handler))
        .route("/api/auth/refresh", post(refresh_handler))
        .route("/api/auth/logout", post(logout_handler))
        .layer(GovernorLayer { config: login_rate.clone() });

    let auth_router_v1 = Router::new()
        .route("/api/v1/auth/login", post(login_handler))
        .route("/api/v1/auth/refresh", post(refresh_handler))
        .route("/api/v1/auth/logout", post(logout_handler))
        .layer(GovernorLayer { config: login_rate });

    let api_v1 = Router::new()
        .merge(auth_router_v1)
        .route("/api/v1/rooms", get(get_rooms_handler))
        .route("/api/v1/rooms/available", get(search_rooms_handler))
        .route("/api/v1/rooms/:id/status", patch(update_room_status_handler))
        .route("/api/v1/bookings", get(list_bookings_handler).post(create_booking_handler))
        .route("/api/v1/bookings/:id", patch(update_booking_handler))
        .route("/api/v1/guests", get(list_guests_handler).post(create_guest_handler))
        .route("/api/v1/auth/me", get(me_handler))
        .route("/api/v1/users", get(list_users_handler).post(create_user_handler).layer(middleware::from_fn(admin_only)))
        .route("/api/v1/analytics/kpis", get(get_dashboard_kpis_handler).layer(middleware::from_fn(admin_only)))
        .route("/api/v1/invoices", get(list_invoices_handler).layer(middleware::from_fn(admin_only)))
        .route("/api/v1/bookings/:id/invoice", get(get_invoice_by_booking_handler));

    let legacy_api = Router::new()
        .merge(auth_router_legacy)
        .route("/api/rooms", get(get_rooms_handler))
        .route("/api/rooms/available", get(search_rooms_handler))
        .route("/api/bookings", get(list_bookings_handler).post(create_booking_handler))
        .route("/api/bookings/:id", patch(update_booking_handler))
        .route("/api/guests", get(list_guests_handler).post(create_guest_handler))
        .route("/api/auth/me", get(me_handler))
        .route("/api/users", get(list_users_handler).post(create_user_handler).layer(middleware::from_fn(admin_only)))
        .route("/api/analytics/kpis", get(get_dashboard_kpis_handler).layer(middleware::from_fn(admin_only)))
        .route("/api/invoices", get(list_invoices_handler).layer(middleware::from_fn(admin_only)))
        .route("/api/bookings/:id/invoice", get(get_invoice_by_booking_handler));

    let auth_layer = middleware::from_fn_with_state(state.clone(), auth_middleware);

    Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .route("/", get(root_handler))
        .route("/health", get(health_check))
        .route("/ready", get(readiness_check))
        .merge(api_v1)
        .merge(legacy_api)
        .route_layer(auth_layer)
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
