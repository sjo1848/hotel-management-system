use axum::{
    extract::{DefaultBodyLimit, State},
    http::{
        header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE, COOKIE, HeaderName},
        HeaderValue, Method,
    },
    middleware,
    routing::{get, post},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};
use uuid::Uuid;

use hms_backend::app_state::AppState;
use hms_backend::application::auth_service::AuthService;
use hms_backend::application::booking_service::BookingService;
use hms_backend::application::analytics_service::AnalyticsService;
use hms_backend::config::AppConfig;
use hms_backend::domain::errors::DomainError;
use hms_backend::domain::models::{Room, RoomStatus};
use hms_backend::domain::repositories::{
    AuditRepository, BookingRepository, GuestRepository, RefreshTokenRepository, RoomRepository,
    UserRepository,
};
use hms_backend::infrastructure::repository::postgres::PostgresRoomRepository;
use hms_backend::infrastructure::repository::postgres_audit::PostgresAuditRepository;
use hms_backend::infrastructure::repository::postgres_booking::PostgresBookingRepository;
use hms_backend::infrastructure::repository::postgres_guest::PostgresGuestRepository;
use hms_backend::infrastructure::repository::postgres_refresh_token::PostgresRefreshTokenRepository;
use hms_backend::infrastructure::repository::postgres_user::PostgresUserRepository;
use hms_backend::infrastructure::web::handlers::{
    create_booking_handler, create_guest_handler, get_rooms_handler, health_check, list_bookings_handler,
    list_guests_handler, login_handler, logout_handler, me_handler, readiness_check, refresh_handler,
    root_handler, search_rooms_handler, update_booking_handler, list_users_handler, create_user_handler,
    get_dashboard_kpis_handler,
};
use hms_backend::infrastructure::web::utils::{csrf_valid, requires_csrf};
use hms_backend::infrastructure::web::handlers::REQUEST_ID;
use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer};

#[tokio::main]
async fn main() {
    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .json()
        .finish();
    tracing::subscriber::set_global_default(subscriber).expect("setting default subscriber failed");

    let config = AppConfig::from_env();

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&config.database_url)
        .await
        .expect("🚨 Error conectando a la DB");

    sqlx::migrate!()
        .run(&pool)
        .await
        .expect("🚨 Error aplicando migraciones");

    let room_repo = Arc::new(PostgresRoomRepository::new(pool.clone())) as Arc<dyn RoomRepository>;
    let booking_repo =
        Arc::new(PostgresBookingRepository::new(pool.clone())) as Arc<dyn BookingRepository>;
    let guest_repo =
        Arc::new(PostgresGuestRepository::new(pool.clone())) as Arc<dyn GuestRepository>;
    let user_repo = Arc::new(PostgresUserRepository::new(pool.clone())) as Arc<dyn UserRepository>;
    let refresh_repo =
        Arc::new(PostgresRefreshTokenRepository::new(pool.clone())) as Arc<dyn RefreshTokenRepository>;
    let audit_repo = Arc::new(PostgresAuditRepository::new(pool.clone())) as Arc<dyn AuditRepository>;
    let booking_service = Arc::new(BookingService::new(booking_repo.clone(), room_repo.clone()));
    let analytics_service = Arc::new(AnalyticsService::new(booking_repo.clone()));
    let auth_service = Arc::new(AuthService::new(
        user_repo.clone(),
        refresh_repo.clone(),
        config.access_ttl_minutes,
        config.refresh_ttl_days,
    ));

    let shared_state = Arc::new(AppState {
        room_repo: room_repo.clone(),
        booking_service,
        analytics_service,
        guest_repo,
        user_repo: user_repo.clone(),
        refresh_repo,
        audit_repo,
        auth_service: auth_service.clone(),
        config: config.clone(),
    });

    bootstrap_admin_user(&config, user_repo.clone()).await;
    seed_rooms_if_empty(room_repo.clone()).await;

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

    let auth_layer = middleware::from_fn_with_state(shared_state.clone(), auth_middleware);

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
        .route("/api/v1/bookings", get(list_bookings_handler).post(create_booking_handler))
        .route("/api/v1/bookings/:id", axum::routing::patch(update_booking_handler))
        .route("/api/v1/guests", get(list_guests_handler).post(create_guest_handler))
        .route("/api/v1/auth/me", get(me_handler))
        .route("/api/v1/users", get(list_users_handler).post(create_user_handler))
        .route("/api/v1/analytics/kpis", get(get_dashboard_kpis_handler));

    let legacy_api = Router::new()
        .merge(auth_router_legacy)
        .route("/api/rooms", get(get_rooms_handler))
        .route("/api/rooms/available", get(search_rooms_handler))
        .route("/api/bookings", get(list_bookings_handler).post(create_booking_handler))
        .route("/api/bookings/:id", axum::routing::patch(update_booking_handler))
        .route("/api/guests", get(list_guests_handler).post(create_guest_handler))
        .route("/api/auth/me", get(me_handler))
        .route("/api/users", get(list_users_handler).post(create_user_handler))
        .route("/api/analytics/kpis", get(get_dashboard_kpis_handler));

    let app = Router::new()
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
        .with_state(shared_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("🚀 HMS Elite (Hexagonal) escuchando en {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
        .await
        .unwrap();
}

async fn request_id_middleware(
    req: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> Result<axum::response::Response, DomainError> {
    let request_id = Uuid::new_v4().to_string();
    let mut response = REQUEST_ID
        .scope(request_id.clone(), async { next.run(req).await })
        .await;
    if let Ok(value) = HeaderValue::from_str(&request_id) {
        response.headers_mut().insert("x-request-id", value);
    }
    Ok(response)
}

async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    req: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> Result<axum::response::Response, DomainError> {
    if !state.config.auth_required {
        return Ok(next.run(req).await);
    }

    let path = req.uri().path();
    if path == "/health"
        || path == "/ready"
        || path == "/"
        || path == "/api/auth/login"
        || path == "/api/auth/refresh"
        || path == "/api/auth/logout"
        || path == "/api/v1/auth/login"
        || path == "/api/v1/auth/refresh"
        || path == "/api/v1/auth/logout"
    {
        return Ok(next.run(req).await);
    }

    let auth_header = req
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok());
    
    let token = if let Some(value) = auth_header {
        if value.starts_with("Bearer ") {
            value.trim_start_matches("Bearer ").trim().to_string()
        } else {
            return Err(DomainError::Unauthorized);
        }
    } else {
        let cookie_header = req
            .headers()
            .get(axum::http::header::COOKIE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("");
        cookie_header
            .split(';')
            .map(|cookie| cookie.trim())
            .find(|cookie| cookie.starts_with("access_token="))
            .map(|cookie| cookie.trim_start_matches("access_token=").to_string())
            .ok_or(DomainError::Unauthorized)?
    };

    let claims = hms_backend::infrastructure::web::jwt::decode_token(&token, &state.config.jwt_secret)
        .map_err(|_| DomainError::Unauthorized)?;

    if requires_csrf(&req) && !csrf_valid(req.headers()) {
        return Err(DomainError::InvalidInput("CSRF token inválido".to_string()));
    }

    if claims.role != "admin" && claims.role != "ops" {
        return Err(DomainError::Unauthorized);
    }

    let mut req = req;
    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}

async fn bootstrap_admin_user(config: &AppConfig, user_repo: Arc<dyn UserRepository>) {
    if let Ok(Some(_)) = user_repo.find_by_username(&config.admin_user).await {
        return;
    }

    let hash = match hms_backend::infrastructure::web::passwords::hash_password(&config.admin_password) {
        Ok(value) => value,
        Err(_) => return,
    };

    let _ = user_repo
        .create(hms_backend::domain::models::User {
            id: uuid::Uuid::new_v4(),
            username: config.admin_user.clone(),
            password_hash: hash,
            role: config.admin_role.clone(),
        })
        .await;
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

async fn seed_rooms_if_empty(room_repo: Arc<dyn RoomRepository>) {
    if let Ok(rooms) = room_repo.find_all().await {
        if !rooms.is_empty() {
            tracing::info!("Habitaciones ya existen, saltando seed.");
            return;
        }
    }

    tracing::info!("Seeding initial rooms...");
    let rooms = vec![
        ("101", "SINGLE", 5000),
        ("102", "SINGLE", 5000),
        ("103", "DOUBLE", 8000),
        ("104", "DOUBLE", 8000),
        ("201", "SUITE", 15000),
        ("202", "SUITE", 15000),
        ("301", "DELUXE", 25000),
    ];

    for (num, rtype, price) in rooms {
        let room = Room {
            id: Uuid::new_v4(),
            room_number: num.to_string(),
            room_type: rtype.to_string(),
            status: RoomStatus::Available,
            price_cents: price,
        };
        if let Err(e) = room_repo.create(room).await {
            tracing::error!("Error creating seed room {}: {}", num, e);
        }
    }
    tracing::info!("Seed complete.");
}