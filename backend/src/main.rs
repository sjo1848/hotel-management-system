mod application;
mod domain;
mod infrastructure;

use axum::{routing::get, Router};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

use crate::domain::repositories::RoomRepository;
use crate::infrastructure::repository::postgres::PostgresRoomRepository;
use crate::infrastructure::web::handlers::{get_rooms_handler, health_check, root_handler};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let db_url = "postgres://admin:password123@db:5432/hms_core";
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(db_url)
        .await
        .expect("🚨 Error conectando a la DB");

    // Inyección de Dependencia:
    // Creamos el repositorio y lo envolvemos en un Arc para compartirlo entre hilos
    let room_repo = Arc::new(PostgresRoomRepository::new(pool)) as Arc<dyn RoomRepository>;

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(root_handler))
        .route("/health", get(health_check))
        .route("/api/rooms", get(get_rooms_handler))
        .layer(cors)
        .with_state(room_repo);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("🚀 HMS Elite (Hexagonal) escuchando en {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
