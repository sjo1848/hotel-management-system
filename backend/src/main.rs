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
use crate::domain::repositories::{BookingRepository, GuestRepository, RoomRepository};
use crate::infrastructure::repository::postgres::PostgresRoomRepository;
use crate::infrastructure::repository::postgres_booking::PostgresBookingRepository;
use crate::infrastructure::repository::postgres_guest::PostgresGuestRepository;
use crate::infrastructure::web::handlers::{
    create_booking_handler, create_guest_handler, get_rooms_handler, health_check,
    list_bookings_handler, list_guests_handler, root_handler, search_rooms_handler,
    update_booking_handler,
};

pub struct AppState {
    pub room_repo: Arc<dyn RoomRepository>,
    pub booking_service: Arc<BookingService>,
    pub guest_repo: Arc<dyn GuestRepository>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let db_url = "postgres://admin:password123@db:5432/hms_core";
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(db_url)
        .await
        .expect("🚨 Error conectando a la DB");

    let room_repo = Arc::new(PostgresRoomRepository::new(pool.clone())) as Arc<dyn RoomRepository>;
    let booking_repo =
        Arc::new(PostgresBookingRepository::new(pool.clone())) as Arc<dyn BookingRepository>;
    let guest_repo =
        Arc::new(PostgresGuestRepository::new(pool.clone())) as Arc<dyn GuestRepository>;
    let booking_service = Arc::new(BookingService::new(booking_repo.clone(), room_repo.clone()));

    let shared_state = Arc::new(AppState {
        room_repo,
        booking_service,
        guest_repo,
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(root_handler))
        .route("/health", get(health_check))
        .route("/api/rooms", get(get_rooms_handler))
        .route("/api/rooms/available", get(search_rooms_handler)) // Nueva ruta de búsqueda
        .route("/api/bookings", get(list_bookings_handler).post(create_booking_handler))
        .route("/api/bookings/:id", axum::routing::patch(update_booking_handler))
        .route("/api/guests", get(list_guests_handler).post(create_guest_handler))
        .layer(cors)
        .with_state(shared_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("🚀 HMS Elite (Hexagonal) escuchando en {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
