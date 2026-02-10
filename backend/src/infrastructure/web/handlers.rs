use crate::AppState; // Importamos el estado del main
use axum::{extract::State, Json};
use chrono::NaiveDate;
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

// DTO: Objeto de transferencia para recibir el JSON del cliente
#[derive(serde::Deserialize)]
pub struct CreateBookingRequest {
    pub room_id: Uuid,
    pub guest_name: String,
    pub check_in: NaiveDate,
    pub check_out: NaiveDate,
}

pub async fn get_rooms_handler(State(state): State<Arc<AppState>>) -> Json<Value> {
    match state.room_repo.find_all().await {
        Ok(rooms) => Json(json!(rooms)),
        Err(e) => Json(json!({ "error": e })),
    }
}

pub async fn create_booking_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateBookingRequest>,
) -> Json<Value> {
    // Llamamos al servicio de aplicación (coordinador)
    let result = state
        .booking_service
        .execute(
            payload.room_id,
            payload.guest_name,
            payload.check_in,
            payload.check_out,
        )
        .await;

    match result {
        Ok(booking) => Json(json!(booking)),
        Err(e) => Json(json!({ "error": e })),
    }
}

pub async fn health_check() -> Json<Value> {
    Json(json!({ "status": "operational" }))
}

pub async fn root_handler() -> Json<Value> {
    Json(json!({ "message": "HMS Elite Backend (Hexagonal) activo" }))
}
