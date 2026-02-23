use crate::domain::errors::DomainError;
use crate::infrastructure::web::validation::{
    parse_booking_status_input, validate_booking_dates, validate_date_range, validate_email,
    validate_len_range, validate_non_empty_trimmed, validate_positive_amount, validate_role,
};
use crate::AppState;
use axum::{
    extract::{ConnectInfo, Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{AppendHeaders, IntoResponse, Response},
    Extension, Json,
};
use base64::Engine;
use chrono::NaiveDate;
use metrics::counter;
use rand::RngCore;
use serde::Deserialize;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::task_local;
use tracing::Span;
use utoipa::ToSchema;
use uuid::Uuid;

task_local! {
    pub static REQUEST_ID: String;
}

#[path = "handlers/auth.rs"]
mod auth;
pub use auth::{login_handler, logout_handler, me_handler, refresh_handler};
#[path = "handlers/ops.rs"]
mod ops;
pub use ops::{
    add_extra_charge_handler, close_cash_handler, create_booking_handler, create_guest_handler,
    create_hotel_handler, create_room_handler, create_user_handler, delete_user_handler,
    finish_cleaning_handler, get_current_balance_handler, get_hotel_network_kpis_handler,
    get_invoice_by_booking_handler, get_rooms_handler, list_bookings_handler,
    list_dirty_rooms_handler, list_extra_charges_handler, list_guests_handler, list_hotels_handler,
    list_invoices_handler, list_users_handler, search_rooms_handler, start_cleaning_handler,
    update_booking_handler, update_room_status_handler,
};
#[path = "handlers/reporting.rs"]
mod reporting;
pub use reporting::{
    get_audit_events_handler, get_dashboard_kpis_handler, get_occupancy_report_handler,
    get_revenue_report_handler, health_check, readiness_check, root_handler,
    track_ui_telemetry_handler,
};

impl IntoResponse for DomainError {
    fn into_response(self) -> Response {
        let (status, error_code, error_message, details): (StatusCode, &str, String, Value) =
            match self {
                DomainError::RoomNotFound => (
                    StatusCode::NOT_FOUND,
                    "ROOM_NOT_FOUND",
                    "La habitación solicitada no existe".to_string(),
                    json!({}),
                ),
                DomainError::HotelNotFound => (
                    StatusCode::NOT_FOUND,
                    "HOTEL_NOT_FOUND",
                    "El hotel solicitado no existe".to_string(),
                    json!({}),
                ),
                DomainError::HotelAlreadyExists => (
                    StatusCode::CONFLICT,
                    "HOTEL_ALREADY_EXISTS",
                    "Ya existe un hotel con ese nombre".to_string(),
                    json!({}),
                ),
                DomainError::RoomAlreadyExists => (
                    StatusCode::CONFLICT,
                    "ROOM_ALREADY_EXISTS",
                    "Ya existe una habitación con ese número".to_string(),
                    json!({}),
                ),
                DomainError::GuestAlreadyExists => (
                    StatusCode::CONFLICT,
                    "GUEST_ALREADY_EXISTS",
                    "Ya existe un huésped con ese email en este hotel".to_string(),
                    json!({}),
                ),
                DomainError::GuestNotFound => (
                    StatusCode::NOT_FOUND,
                    "GUEST_NOT_FOUND",
                    "El huésped solicitado no existe".to_string(),
                    json!({}),
                ),
                DomainError::UserAlreadyExists => (
                    StatusCode::CONFLICT,
                    "USER_ALREADY_EXISTS",
                    "Ya existe un usuario con ese nombre en este hotel".to_string(),
                    json!({}),
                ),
                DomainError::UserNotFound => (
                    StatusCode::NOT_FOUND,
                    "USER_NOT_FOUND",
                    "El usuario solicitado no existe".to_string(),
                    json!({}),
                ),
                DomainError::InvalidRoomStatusTransition => (
                    StatusCode::BAD_REQUEST,
                    "INVALID_ROOM_STATUS_TRANSITION",
                    "Transición de estado de habitación no permitida".to_string(),
                    json!({}),
                ),
                DomainError::RoomNotAvailable => (
                    StatusCode::CONFLICT,
                    "ROOM_NOT_AVAILABLE",
                    "La habitación ya está ocupada en esas fechas".to_string(),
                    json!({}),
                ),
                DomainError::InvalidBookingDates => (
                    StatusCode::BAD_REQUEST,
                    "INVALID_BOOKING_DATES",
                    "Las fechas de reserva no son válidas".to_string(),
                    json!({}),
                ),
                DomainError::BookingNotFound => (
                    StatusCode::NOT_FOUND,
                    "BOOKING_NOT_FOUND",
                    "La reserva solicitada no existe".to_string(),
                    json!({}),
                ),
                DomainError::InvoiceNotFound => (
                    StatusCode::NOT_FOUND,
                    "INVOICE_NOT_FOUND",
                    "La factura solicitada no existe".to_string(),
                    json!({}),
                ),
                DomainError::InvalidInput(msg) => (
                    StatusCode::BAD_REQUEST,
                    "INVALID_INPUT",
                    msg.clone(),
                    json!({ "reason": msg }),
                ),
                DomainError::Unauthorized => (
                    StatusCode::UNAUTHORIZED,
                    "UNAUTHORIZED",
                    "No autorizado".to_string(),
                    json!({}),
                ),
                DomainError::Forbidden => (
                    StatusCode::FORBIDDEN,
                    "FORBIDDEN",
                    "No tiene permisos para realizar esta acción".to_string(),
                    json!({}),
                ),
                DomainError::InfrastructureError(msg) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "INFRA_ERROR",
                    msg,
                    json!({}),
                ),
            };

        let request_id = REQUEST_ID
            .try_with(|value: &String| value.clone())
            .unwrap_or_else(|_| "unknown".to_string());
        Span::current().record("error_code", error_code);
        let body = Json(json!({
            "error_code": error_code,
            "message": error_message,
            "request_id": request_id,
            "details": details
        }));
        (status, body).into_response()
    }
}

#[derive(Deserialize, ToSchema)]
pub struct CreateBookingRequest {
    pub room_id: Uuid,
    pub guest_id: Option<Uuid>,
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
pub struct BookingFilterParams {
    pub start: Option<NaiveDate>,
    pub end: Option<NaiveDate>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateBookingRequest {
    pub guest_id: Option<Uuid>,
    pub guest_name: Option<String>,
    pub check_in: Option<NaiveDate>,
    pub check_out: Option<NaiveDate>,
    pub status: Option<String>,
}

#[derive(Deserialize)]
pub struct DateRangeParams {
    pub start: Option<chrono::NaiveDate>,
    pub end: Option<chrono::NaiveDate>,
}

#[derive(Deserialize)]
pub struct AuditQueryParams {
    pub limit: Option<usize>,
}

#[derive(Deserialize, ToSchema)]
pub struct UiTelemetryEventRequest {
    pub event: String,
    pub payload: Option<Value>,
    pub timestamp: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct CreateGuestRequest {
    pub full_name: String,
    pub email: String,
    pub phone: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct LoginRequest {
    pub hotel_id: String,
    pub username: String,
    pub password: String,
    pub device_id: Option<String>,
}

#[derive(Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: Option<String>,
    pub all_devices: Option<bool>,
}

#[derive(serde::Serialize, ToSchema)]
pub struct LoginResponse {
    pub access_token: String,
    pub expires_in: usize,
    pub hotel_id: Uuid,
    pub role: String,
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateRoomStatusRequest {
    pub status: String,
}

#[derive(Deserialize, ToSchema)]
pub struct CreateRoomRequest {
    pub room_number: String,
    pub room_type: String,
    pub price_cents: i64,
}

#[derive(Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    pub role: String,
}

fn extract_refresh_cookie(headers: &HeaderMap) -> Option<String> {
    let cookies_header = headers
        .get(header::COOKIE)
        .and_then(|value| value.to_str().ok());
    cookies_header.and_then(|cookies| {
        cookies
            .split(';')
            .map(|cookie| cookie.trim())
            .find(|cookie| cookie.starts_with("refresh_token="))
            .map(|cookie| cookie.trim_start_matches("refresh_token=").to_string())
    })
}

fn resolve_device_id(payload_device_id: Option<&str>, headers: &HeaderMap) -> String {
    let explicit = payload_device_id.unwrap_or_default().trim();
    if !explicit.is_empty() {
        return explicit.to_string();
    }
    headers
        .get("x-device-id")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| "web-browser".to_string())
}

pub fn build_refresh_cookie(token: &str, config: &crate::config::AppConfig) -> String {
    let mut cookie_parts = vec![
        format!("refresh_token={}", token),
        format!("Path=/"),
        format!("SameSite={}", config.cookie_samesite),
        format!("Max-Age={}", config.refresh_ttl_days * 24 * 60 * 60),
        String::from("HttpOnly"),
    ];

    if config.cookie_secure {
        cookie_parts.push(String::from("Secure"));
    }
    if let Some(domain) = config.cookie_domain.as_deref() {
        cookie_parts.push(format!("Domain={domain}"));
    }

    cookie_parts.join("; ")
}

pub fn clear_refresh_cookie(config: &crate::config::AppConfig) -> String {
    let mut cookie_parts = vec![
        format!("refresh_token=;"),
        format!("Path=/"),
        format!("SameSite={}", config.cookie_samesite),
        format!("Max-Age=0"),
        String::from("HttpOnly"),
    ];
    if config.cookie_secure {
        cookie_parts.push(String::from("Secure"));
    }
    if let Some(domain) = config.cookie_domain.as_deref() {
        cookie_parts.push(format!("Domain={domain}"));
    }
    cookie_parts.join("; ")
}

pub fn build_access_cookie(token: &str, config: &crate::config::AppConfig) -> String {
    let mut cookie_parts = vec![
        format!("access_token={}", token),
        format!("Path=/"),
        format!("SameSite={}", config.cookie_samesite),
        format!("Max-Age={}", config.access_ttl_minutes * 60),
        String::from("HttpOnly"),
    ];

    if config.cookie_secure {
        cookie_parts.push(String::from("Secure"));
    }
    if let Some(domain) = config.cookie_domain.as_deref() {
        cookie_parts.push(format!("Domain={domain}"));
    }

    cookie_parts.join("; ")
}

pub fn clear_access_cookie(config: &crate::config::AppConfig) -> String {
    let mut cookie_parts = vec![
        format!("access_token=;"),
        format!("Path=/"),
        format!("SameSite={}", config.cookie_samesite),
        format!("Max-Age=0"),
        String::from("HttpOnly"),
    ];
    if config.cookie_secure {
        cookie_parts.push(String::from("Secure"));
    }
    if let Some(domain) = config.cookie_domain.as_deref() {
        cookie_parts.push(format!("Domain={domain}"));
    }
    cookie_parts.join("; ")
}

fn generate_csrf_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

fn build_csrf_cookie(token: &str, config: &crate::config::AppConfig) -> String {
    let mut cookie = format!(
        "csrf_token={}; Path=/; SameSite={}; Max-Age={}",
        token,
        config.cookie_samesite,
        config.refresh_ttl_days * 24 * 60 * 60
    );
    if config.cookie_secure {
        cookie.push_str("; Secure");
    }
    if let Some(domain) = config.cookie_domain.as_deref() {
        cookie.push_str(&format!("; Domain={domain}"));
    }
    cookie
}

fn clear_csrf_cookie(config: &crate::config::AppConfig) -> String {
    let mut cookie = format!(
        "csrf_token=; Path=/; SameSite={}; Max-Age=0",
        config.cookie_samesite
    );
    if config.cookie_secure {
        cookie.push_str("; Secure");
    }
    if let Some(domain) = config.cookie_domain.as_deref() {
        cookie.push_str(&format!("; Domain={domain}"));
    }
    cookie
}

#[derive(Deserialize, ToSchema)]
pub struct CreateHotelRequest {
    pub name: String,
    pub address: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct AddExtraChargeRequest {
    pub description: String,
    pub amount_cents: i64,
    pub category: String,
}

#[derive(Deserialize)]
pub struct CashClosureRequest {
    pub notes: Option<String>,
}
