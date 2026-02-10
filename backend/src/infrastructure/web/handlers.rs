use crate::domain::errors::DomainError;
use crate::AppState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use chrono::NaiveDate;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
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
            DomainError::BookingNotFound => (
                StatusCode::NOT_FOUND,
                "La reserva solicitada no existe".to_string(),
            ),
            DomainError::InvalidInput(msg) => (StatusCode::BAD_REQUEST, msg),
            DomainError::Unauthorized => (StatusCode::UNAUTHORIZED, "No autorizado".to_string()),
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
    #[serde(alias = "start_date")]
    pub check_in: NaiveDate,
    #[serde(alias = "end_date")]
    pub check_out: NaiveDate,
}

#[derive(Deserialize)]
pub struct SearchParams {
    pub start: NaiveDate,
    pub end: NaiveDate,
}

#[derive(Deserialize)]
pub struct UpdateBookingRequest {
    pub guest_name: Option<String>,
    pub check_in: Option<NaiveDate>,
    pub check_out: Option<NaiveDate>,
    pub status: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateGuestRequest {
    pub full_name: String,
    pub email: String,
    pub phone: Option<String>,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(serde::Serialize)]
pub struct LoginResponse {
    pub token: String,
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
    if payload.guest_name.trim().is_empty() {
        return Err(DomainError::InvalidInput(
            "El nombre del huésped es obligatorio".to_string(),
        ));
    }

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

pub async fn list_bookings_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    let bookings = state
        .booking_service
        .list_bookings()
        .await
        .map_err(DomainError::InfrastructureError)?;
    Ok(Json(json!(bookings)))
}

pub async fn update_booking_handler(
    State(state): State<Arc<AppState>>,
    Path(booking_id): Path<Uuid>,
    Json(payload): Json<UpdateBookingRequest>,
) -> Result<Json<Value>, DomainError> {
    let status = payload.status.as_deref().map(|value| match value {
        "CANCELLED" | "Cancelled" => crate::domain::models::BookingStatus::Cancelled,
        _ => crate::domain::models::BookingStatus::Confirmed,
    });

    let booking = state
        .booking_service
        .update_booking(
            booking_id,
            payload.guest_name,
            payload.check_in,
            payload.check_out,
            status,
        )
        .await?;

    Ok(Json(json!(booking)))
}

pub async fn list_guests_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    let guests = state
        .guest_repo
        .find_all()
        .await
        .map_err(DomainError::InfrastructureError)?;
    Ok(Json(json!(guests)))
}

pub async fn create_guest_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateGuestRequest>,
) -> Result<Json<Value>, DomainError> {
    if payload.full_name.trim().is_empty() || payload.email.trim().is_empty() {
        return Err(DomainError::InvalidInput(
            "Nombre completo y email son obligatorios".to_string(),
        ));
    }

    let guest = crate::domain::models::Guest {
        id: Uuid::new_v4(),
        full_name: payload.full_name,
        email: payload.email,
        phone: payload.phone,
    };

    let created = state
        .guest_repo
        .create(guest)
        .await
        .map_err(DomainError::InfrastructureError)?;

    Ok(Json(json!(created)))
}

pub async fn login_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<Value>, DomainError> {
    if payload.username != state.config.admin_user || payload.password != state.config.admin_password {
        return Err(DomainError::Unauthorized);
    }

    let exp = SystemTime::now()
        .checked_add(Duration::from_secs(60 * 60 * 8))
        .unwrap()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as usize;

    let claims = crate::infrastructure::web::jwt::Claims {
        sub: payload.username,
        role: state.config.admin_role.clone(),
        exp,
    };

    let token = crate::infrastructure::web::jwt::encode_token(&claims, &state.config.jwt_secret)
        .map_err(|e| DomainError::InfrastructureError(e))?;

    Ok(Json(json!(LoginResponse { token })))
}

pub async fn health_check() -> Json<Value> {
    Json(json!({ "status": "operational" }))
}

pub async fn readiness_check(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    state
        .room_repo
        .find_all()
        .await
        .map_err(DomainError::InfrastructureError)?;
    Ok(Json(json!({ "status": "ready" })))
}

pub async fn root_handler() -> Json<Value> {
    Json(json!({ "message": "HMS Elite Backend (Hexagonal) activo" }))
}
