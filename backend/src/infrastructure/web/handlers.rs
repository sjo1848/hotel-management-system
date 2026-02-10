use crate::domain::errors::DomainError;
use crate::AppState;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use chrono::NaiveDate;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

impl IntoResponse for DomainError {
    fn into_response(self) -> Response {
        // Forzamos a que todos los brazos devuelvan (StatusCode, String)
        let (status, error_message): (StatusCode, String) = match self {
            DomainError::RoomNotFound => (
                StatusCode::NOT_FOUND,
                "La habitación solicitada no existe".to_string(),
            ),
            DomainError::RoomNotAvailable => (
                StatusCode::CONFLICT,
                "La habitación ya está ocupada en esas fechas".to_string(),
            ),
            DomainError::InvalidBookingDates => (
                StatusCode::BAD_REQUEST,
                "Las fechas de reserva no son válidas".to_string(),
            ),
            DomainError::InfrastructureError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
        };

        let body = Json(json!({ "error": error_message }));
        (status, body).into_response()
    }
}

#[derive(Deserialize)]
pub struct CreateBookingRequest {
    pub room_id: Uuid,
    pub guest_name: String,
    pub check_in: NaiveDate,
    pub check_out: NaiveDate,
}

#[derive(Deserialize)]
pub struct SearchParams {
    pub start: NaiveDate,
    pub end: NaiveDate,
}

pub async fn get_rooms_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    let rooms = state
        .room_repo
        .find_all()
        .await
        .map_err(DomainError::InfrastructureError)?;
    Ok(Json(json!(rooms)))
}

pub async fn search_rooms_handler(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchParams>,
) -> Result<Json<Value>, DomainError> {
    let rooms = state
        .room_repo
        .find_available(params.start, params.end)
        .await
        .map_err(DomainError::InfrastructureError)?;
    Ok(Json(json!(rooms)))
}

pub async fn create_booking_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateBookingRequest>,
) -> Result<Json<Value>, DomainError> {
    // Especificamos el tipo para evitar el error de "never type fallback"
    let booking = state
        .booking_service
        .execute(
            payload.room_id,
            payload.guest_name,
            payload.check_in,
            payload.check_out,
        )
        .await?;

    Ok(Json(json!(booking)))
}

pub async fn health_check() -> Json<Value> {
    Json(json!({ "status": "operational" }))
}

pub async fn root_handler() -> Json<Value> {
    Json(json!({ "message": "HMS Elite Backend (Hexagonal) activo" }))
}
