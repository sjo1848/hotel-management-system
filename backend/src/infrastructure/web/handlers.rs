use crate::domain::repositories::RoomRepository;
use axum::{extract::State, Json};
use serde_json::{json, Value};
use std::sync::Arc;

pub async fn get_rooms_handler(State(repo): State<Arc<dyn RoomRepository>>) -> Json<Value> {
    match repo.find_all().await {
        Ok(rooms) => Json(json!(rooms)),
        Err(e) => Json(json!({ "error": e })),
    }
}

pub async fn health_check() -> Json<Value> {
    Json(json!({ "status": "operational" }))
}

pub async fn root_handler() -> Json<Value> {
    Json(json!({ "message": "HMS Elite Backend v1.0 (Hexagonal Mode) running" }))
}
