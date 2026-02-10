mod application;
mod config;
mod domain;
mod infrastructure;

use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use axum::extract::DefaultBodyLimit;
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

use crate::application::booking_service::BookingService;
use crate::application::auth_service::AuthService;
use crate::domain::errors::DomainError;
use crate::domain::repositories::{
    BookingRepository, GuestRepository, RefreshTokenRepository, RoomRepository, UserRepository,
};
use crate::infrastructure::repository::postgres::PostgresRoomRepository;
use crate::infrastructure::repository::postgres_booking::PostgresBookingRepository;
use crate::infrastructure::repository::postgres_guest::PostgresGuestRepository;
use crate::infrastructure::repository::postgres_refresh_token::PostgresRefreshTokenRepository;
use crate::infrastructure::repository::postgres_user::PostgresUserRepository;
use crate::infrastructure::web::handlers::{
    create_booking_handler, create_guest_handler, get_rooms_handler, health_check, list_bookings_handler,
    list_guests_handler, login_handler, logout_handler, readiness_check, refresh_handler, root_handler,
    search_rooms_handler, update_booking_handler,
};
use crate::config::AppConfig;
use tower_governor::{GovernorConfigBuilder, GovernorLayer};

pub struct AppState {
    pub room_repo: Arc<dyn RoomRepository>,
    pub booking_service: Arc<BookingService>,
    pub guest_repo: Arc<dyn GuestRepository>,
    pub user_repo: Arc<dyn UserRepository>,
    pub refresh_repo: Arc<dyn RefreshTokenRepository>,
    pub auth_service: Arc<AuthService>,
    pub config: AppConfig,
}

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
    let booking_service = Arc::new(BookingService::new(booking_repo.clone(), room_repo.clone()));
    let auth_service = Arc::new(AuthService::new(
        user_repo.clone(),
        refresh_repo.clone(),
        config.access_ttl_minutes,
        config.refresh_ttl_days,
    ));

    let shared_state = Arc::new(AppState {
        room_repo,
        booking_service,
        guest_repo,
        user_repo: user_repo.clone(),
        refresh_repo,
        auth_service: auth_service.clone(),
        config: config.clone(),
    });

    bootstrap_admin_user(&config, user_repo.clone()).await;

    let cors_origin = config
        .cors_origin
        .parse::<axum::http::HeaderValue>()
        .map(|value| value.into())
        .unwrap_or(Any.into());

    let cors = CorsLayer::new()
        .allow_origin(cors_origin)
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_credentials(true);

    let auth_layer = middleware::from_fn_with_state(shared_state.clone(), auth_middleware);

    let api_rate = GovernorConfigBuilder::default()
        .per_minute(config.rate_limit_per_minute)
        .burst_size(config.rate_limit_per_minute)
        .finish()
        .unwrap();

    let login_rate = GovernorConfigBuilder::default()
        .per_minute(config.login_limit_per_minute)
        .burst_size(config.login_limit_per_minute)
        .finish()
        .unwrap();

    let auth_router = Router::new()
        .route("/api/auth/login", post(login_handler))
        .route("/api/auth/refresh", post(refresh_handler))
        .route("/api/auth/logout", post(logout_handler))
        .layer(GovernorLayer::new(login_rate));

    let app = Router::new()
        .route("/", get(root_handler))
        .route("/health", get(health_check))
        .route("/ready", get(readiness_check))
        .merge(auth_router)
        .route("/api/rooms", get(get_rooms_handler))
        .route("/api/rooms/available", get(search_rooms_handler))
        .route("/api/bookings", get(list_bookings_handler).post(create_booking_handler))
        .route("/api/bookings/:id", axum::routing::patch(update_booking_handler))
        .route("/api/guests", get(list_guests_handler).post(create_guest_handler))
        .route_layer(auth_layer)
        .layer(GovernorLayer::new(api_rate))
        .layer(cors)
        .layer(DefaultBodyLimit::max(1024 * 1024))
        .layer(TraceLayer::new_for_http())
        .with_state(shared_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("🚀 HMS Elite (Hexagonal) escuchando en {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
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
        || path == "/"
        || path == "/api/auth/login"
        || path == "/api/auth/refresh"
        || path == "/api/auth/logout"
    {
        return Ok(next.run(req).await);
    }

    let auth_header = req
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok());

    let token = match auth_header {
        Some(value) if value.starts_with("Bearer ") => value.trim_start_matches("Bearer ").trim(),
        _ => return Err(DomainError::Unauthorized),
    };

    let claims = crate::infrastructure::web::jwt::decode_token(token, &state.config.jwt_secret)
        .map_err(|_| DomainError::Unauthorized)?;

    if claims.role != "admin" && claims.role != "ops" {
        return Err(DomainError::Unauthorized);
    }

    Ok(next.run(req).await)
}

async fn bootstrap_admin_user(config: &AppConfig, user_repo: Arc<dyn UserRepository>) {
    if let Ok(Some(_)) = user_repo.find_by_username(&config.admin_user).await {
        return;
    }

    let hash = match crate::infrastructure::web::passwords::hash_password(&config.admin_password) {
        Ok(value) => value,
        Err(_) => return,
    };

    let _ = user_repo
        .create(crate::domain::models::User {
            id: uuid::Uuid::new_v4(),
            username: config.admin_user.clone(),
            password_hash: hash,
            role: config.admin_role.clone(),
        })
        .await;
}
