mod application;
mod domain;
mod infrastructure;

use axum::{
    routing::{get, post},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

use crate::application::booking_service::BookingService;
use crate::domain::repositories::{BookingRepository, RoomRepository};
use crate::infrastructure::repository::postgres::PostgresRoomRepository;
use crate::infrastructure::repository::postgres_booking::PostgresBookingRepository;
use crate::infrastructure::web::handlers::{
    create_booking_handler, get_rooms_handler, health_check, root_handler,
};

// Estado Global: El contenedor de inyección de dependencias
pub struct AppState {
    pub room_repo: Arc<dyn RoomRepository>,
    pub booking_service: Arc<BookingService>,
}

#[tokio::main]
async fn main() {
    // Iniciamos logs con el formato que ya vimos en tus logs (Feb 2026)
    tracing_subscriber::fmt::init();

    let db_url = "postgres://admin:password123@db:5432/hms_core";
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(db_url)
        .await
        .expect("🚨 Error conectando a la DB");

    // 1. Instanciamos Adaptadores de Infraestructura
    let room_repo = Arc::new(PostgresRoomRepository::new(pool.clone())) as Arc<dyn RoomRepository>;
    let booking_repo =
        Arc::new(PostgresBookingRepository::new(pool.clone())) as Arc<dyn BookingRepository>;

    // 2. Instanciamos Lógica de Aplicación
    let booking_service = Arc::new(BookingService::new(booking_repo.clone(), room_repo.clone()));

    // 3. Creamos el Estado Compartido (Inyección)
    let shared_state = Arc::new(AppState {
        room_repo,
        booking_service,
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // 4. Router: Aquí conectamos los Handlers con el Estado
    let app = Router::new()
        .route("/", get(root_handler))
        .route("/health", get(health_check))
        .route("/api/rooms", get(get_rooms_handler))
        .route("/api/bookings", post(create_booking_handler))
        .layer(cors)
        .with_state(shared_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("🚀 HMS Elite (Hexagonal) escuchando en {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
