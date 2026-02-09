use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::postgres::{PgPool, PgPoolOptions};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};

// 1. Definimos la estructura de la Habitación (debe coincidir con la DB)
#[derive(Serialize, sqlx::FromRow)]
struct Room {
    id: uuid::Uuid,
    room_number: String,
    room_type: String,
    status: String,
    price_cents: i64,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    // 2. Configuración de la conexión a la DB
    // Host 'db' porque así se llama el servicio en docker-compose
    let db_url = "postgres://admin:password123@db:5432/hms_core";

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(db_url)
        .await
        .expect("🚨 No se pudo conectar a la base de datos. ¿Está el contenedor 'db' arriba?");

    println!("✅ Conexión a Postgres exitosa.");

    // 3. Configuración de CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // 4. Definición de rutas (Aquí sumamos /api/rooms)
    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health_check))
        .route("/api/rooms", get(get_rooms)) // <--- ESTA ES LA QUE FALTABA
        .layer(cors)
        .with_state(pool); // Pasamos la DB a los handlers

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("🚀 Backend escuchando en {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

// Handler para traer las habitaciones de la DB
async fn get_rooms(State(pool): State<PgPool>) -> Json<Value> {
    let result = sqlx::query_as::<_, Room>(
        "SELECT id, room_number, room_type, status, price_cents FROM rooms",
    )
    .fetch_all(&pool)
    .await;

    match result {
        Ok(rooms) => Json(json!(rooms)),
        Err(e) => {
            eprintln!("Error en DB: {}", e);
            Json(json!({ "error": "No se pudieron obtener las habitaciones" }))
        }
    }
}

async fn root() -> Json<Value> {
    Json(json!({ "message": "HMS Elite Backend v1.0 running" }))
}

async fn health_check() -> Json<Value> {
    Json(json!({ "status": "ok", "system": "operational" }))
}
