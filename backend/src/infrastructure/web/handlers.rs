use crate::domain::errors::DomainError;
use crate::AppState;
use axum::{
    extract::{ConnectInfo, Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{AppendHeaders, IntoResponse, Response},
    Extension, Json,
};
use base64::Engine;
use chrono::NaiveDate;
use rand::RngCore;
use serde::Deserialize;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::task_local;
use utoipa::ToSchema;
use uuid::Uuid;

task_local! {
    pub static REQUEST_ID: String;
}

impl IntoResponse for DomainError {
    fn into_response(self) -> Response {
        let (status, error_code, error_message): (StatusCode, &str, String) = match self {
            DomainError::RoomNotFound => (
                StatusCode::NOT_FOUND,
                "ROOM_NOT_FOUND",
                "La habitación solicitada no existe".to_string(),
            ),
            DomainError::HotelNotFound => (
                StatusCode::NOT_FOUND,
                "HOTEL_NOT_FOUND",
                "El hotel solicitado no existe".to_string(),
            ),
            DomainError::RoomAlreadyExists => (
                StatusCode::CONFLICT,
                "ROOM_ALREADY_EXISTS",
                "Ya existe una habitación con ese número".to_string(),
            ),
            DomainError::GuestAlreadyExists => (
                StatusCode::CONFLICT,
                "GUEST_ALREADY_EXISTS",
                "Ya existe un huésped con ese email en este hotel".to_string(),
            ),
            DomainError::GuestNotFound => (
                StatusCode::NOT_FOUND,
                "GUEST_NOT_FOUND",
                "El huésped solicitado no existe".to_string(),
            ),
            DomainError::UserAlreadyExists => (
                StatusCode::CONFLICT,
                "USER_ALREADY_EXISTS",
                "Ya existe un usuario con ese nombre en este hotel".to_string(),
            ),
            DomainError::InvalidRoomStatusTransition => (
                StatusCode::BAD_REQUEST,
                "INVALID_ROOM_STATUS_TRANSITION",
                "Transición de estado de habitación no permitida".to_string(),
            ),
            DomainError::RoomNotAvailable => (
                StatusCode::CONFLICT,
                "ROOM_NOT_AVAILABLE",
                "La habitación ya está ocupada en esas fechas".to_string(),
            ),
            DomainError::InvalidBookingDates => (
                StatusCode::BAD_REQUEST,
                "INVALID_BOOKING_DATES",
                "Las fechas de reserva no son válidas".to_string(),
            ),
            DomainError::BookingNotFound => (
                StatusCode::NOT_FOUND,
                "BOOKING_NOT_FOUND",
                "La reserva solicitada no existe".to_string(),
            ),
            DomainError::InvoiceNotFound => (
                StatusCode::NOT_FOUND,
                "INVOICE_NOT_FOUND",
                "La factura solicitada no existe".to_string(),
            ),
            DomainError::InvalidInput(msg) => (StatusCode::BAD_REQUEST, "INVALID_INPUT", msg),
            DomainError::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                "UNAUTHORIZED",
                "No autorizado".to_string(),
            ),
            DomainError::Forbidden => (
                StatusCode::FORBIDDEN,
                "FORBIDDEN",
                "No tiene permisos para realizar esta acción".to_string(),
            ),
            DomainError::InfrastructureError(msg) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "INFRA_ERROR", msg)
            }
        };

        let request_id = REQUEST_ID
            .try_with(|value: &String| value.clone())
            .unwrap_or_else(|_| "unknown".to_string());
        let body = Json(json!({
            "error_code": error_code,
            "message": error_message,
            "request_id": request_id,
            "details": {}
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
}

#[derive(Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: Option<String>,
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

#[utoipa::path(
    get,
    path = "/api/v1/rooms",
    responses(
        (status = 200, description = "Lista de todas las habitaciones", body = [Room])
    ),
    tag = "Hotelería"
)]
pub async fn get_rooms_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let rooms: Vec<crate::domain::models::Room> = state
        .room_repo
        .find_all(hotel_id)
        .await
        .map_err(DomainError::InfrastructureError)?;
    Ok(Json(json!(rooms)))
}

#[utoipa::path(
    post,
    path = "/api/v1/rooms",
    request_body = CreateRoomRequest,
    responses(
        (status = 201, description = "Habitación creada exitosamente", body = Room),
        (status = 409, description = "Ya existe una habitación con ese número"),
        (status = 401, description = "No autorizado"),
        (status = 403, description = "Prohibido (Solo Admin)")
    ),
    tag = "Hotelería",
    security(
        ("jwt" = [])
    )
)]
pub async fn create_room_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(payload): Json<CreateRoomRequest>,
) -> Result<(StatusCode, Json<Value>), DomainError> {
    let ip = addr.ip().to_string();
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;

    let room = state
        .room_service
        .create_room(
            hotel_id,
            payload.room_number,
            payload.room_type,
            payload.price_cents,
        )
        .await?;

    state
        .audit_service
        .record(
            Some(hotel_id),
            Some(user_id),
            &format!("room.created: {}", room.room_number),
            Some(ip),
        )
        .await;

    Ok((StatusCode::CREATED, Json(json!(room))))
}

#[utoipa::path(
    patch,
    path = "/api/v1/rooms/{room_id}/status",
    request_body = UpdateRoomStatusRequest,
    params(
        ("room_id" = Uuid, Path, description = "ID de la habitación")
    ),
    responses(
        (status = 200, description = "Estado actualizado exitosamente"),
        (status = 404, description = "Habitación no encontrada")
    ),
    tag = "Hotelería"
)]
pub async fn update_room_status_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(room_id): Path<Uuid>,
    Json(payload): Json<UpdateRoomStatusRequest>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let status = match payload.status.to_uppercase().as_str() {
        "AVAILABLE" => crate::domain::models::RoomStatus::Available,
        "OCCUPIED" => crate::domain::models::RoomStatus::Occupied,
        "DIRTY" => crate::domain::models::RoomStatus::Dirty,
        "MAINTENANCE" => crate::domain::models::RoomStatus::Maintenance,
        _ => {
            return Err(DomainError::InvalidInput(
                "Estado de habitación inválido".to_string(),
            ))
        }
    };

    state
        .room_service
        .update_room_status(hotel_id, room_id, status)
        .await?;
    Ok(Json(json!({ "status": "ok" })))
}

pub async fn search_rooms_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Query(params): Query<SearchParams>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let rooms: Vec<crate::domain::models::Room> = state
        .room_repo
        .find_available(hotel_id, params.start, params.end)
        .await
        .map_err(DomainError::InfrastructureError)?;
    Ok(Json(json!(rooms)))
}

#[utoipa::path(
    post,
    path = "/api/v1/bookings",
    request_body = CreateBookingRequest,
    responses(
        (status = 201, description = "Reserva creada exitosamente", body = Booking),
        (status = 409, description = "Conflicto de fechas")
    ),
    tag = "Reservas"
)]
pub async fn create_booking_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Json(payload): Json<CreateBookingRequest>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    if payload.guest_name.trim().is_empty() {
        return Err(DomainError::InvalidInput(
            "El nombre del huésped es obligatorio".to_string(),
        ));
    }

    // Especificamos el tipo para evitar el error de "never type fallback"
    let booking: crate::domain::models::Booking = state
        .booking_service
        .execute(
            hotel_id,
            payload.room_id,
            payload.guest_id,
            payload.guest_name,
            payload.check_in,
            payload.check_out,
        )
        .await?;

    Ok(Json(json!(booking)))
}

pub async fn list_bookings_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Query(params): Query<BookingFilterParams>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let bookings: Vec<crate::domain::models::Booking> = match (params.start, params.end) {
        (Some(start), Some(end)) => state
            .booking_service
            .list_bookings_in_range(hotel_id, start, end)
            .await
            .map_err(DomainError::InfrastructureError)?,
        _ => state
            .booking_service
            .list_bookings(hotel_id)
            .await
            .map_err(DomainError::InfrastructureError)?,
    };
    Ok(Json(json!(bookings)))
}

pub async fn update_booking_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(booking_id): Path<Uuid>,
    Json(payload): Json<UpdateBookingRequest>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;

    let status = match payload.status.as_deref() {
        Some("Confirmed") | Some("CONFIRMED") => {
            Some(crate::domain::models::BookingStatus::Confirmed)
        }
        Some("CheckedIn") | Some("CHECKED_IN") => {
            Some(crate::domain::models::BookingStatus::CheckedIn)
        }
        Some("CheckedOut") | Some("CHECKED_OUT") => {
            Some(crate::domain::models::BookingStatus::CheckedOut)
        }
        Some("Cancelled") | Some("CANCELLED") => {
            Some(crate::domain::models::BookingStatus::Cancelled)
        }
        _ => None,
    };

    let booking: crate::domain::models::Booking = state
        .booking_service
        .update_booking(
            hotel_id,
            booking_id,
            payload.guest_id,
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

    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;

    let guests = state.guest_service.list_guests(hotel_id).await?;

    Ok(Json(json!(guests)))
}

pub async fn create_guest_handler(
    State(state): State<Arc<AppState>>,

    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,

    Json(payload): Json<CreateGuestRequest>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;

    let created = state
        .guest_service
        .create_guest(hotel_id, payload.full_name, payload.email, payload.phone)
        .await?;

    Ok(Json(json!(created)))
}

#[utoipa::path(
    post,
    path = "/api/v1/auth/login",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Login exitoso", body = LoginResponse)
    ),
    tag = "Autenticación"
)]
pub async fn login_handler(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(payload): Json<LoginRequest>,
) -> Result<Response, DomainError> {
    let ip = addr.ip().to_string();
    let hotel_id_input = payload.hotel_id.trim();

    if hotel_id_input.is_empty() || payload.username.trim().is_empty() || payload.password.trim().is_empty() {
        return Err(DomainError::InvalidInput(
            "Hotel, usuario y contraseña son obligatorios".to_string(),
        ));
    }

    let hotel_id = if let Ok(uuid) = Uuid::parse_str(hotel_id_input) {
        uuid
    } else {
        state
            .hotel_repo
            .find_by_name_ci(hotel_id_input)
            .await
            .map_err(DomainError::InfrastructureError)?
            .map(|hotel| hotel.id)
            .ok_or_else(|| {
                DomainError::InvalidInput("Hotel inválido. Usá ID o nombre existente.".to_string())
            })?
    };

    let user = match state
        .auth_service
        .verify_user(hotel_id, &payload.username, &payload.password)
        .await
    {
        Ok(u) => u,
        Err(e) => {
            tracing::warn!(
                ip = %ip,
                username = %payload.username,
                "Intento de login fallido"
            );
            return Err(e);
        }
    };

    let exp = state.auth_service.access_exp();

    let claims = crate::infrastructure::web::jwt::Claims {
        sub: user.id.to_string(),
        hotel_id: user.hotel_id.to_string(),
        role: user.role.clone(),
        exp,
    };

    let access_token =
        crate::infrastructure::web::jwt::encode_token(&claims, &state.config.jwt_secret)
            .map_err(DomainError::InfrastructureError)?;

    let (refresh_token, _): (String, crate::domain::models::RefreshToken) = state
        .auth_service
        .issue_refresh_token(user.hotel_id, user.id)
        .await?;
    let refresh_cookie = build_refresh_cookie(&refresh_token, &state.config);
    let access_cookie = build_access_cookie(&access_token, &state.config);
    let csrf_token = generate_csrf_token();
    let csrf_cookie = build_csrf_cookie(&csrf_token, &state.config);

    state
        .audit_service
        .record(Some(user.hotel_id), Some(user.id), "auth.login", Some(ip))
        .await;

    Ok((
        StatusCode::OK,
        AppendHeaders([
            (header::SET_COOKIE, refresh_cookie),
            (header::SET_COOKIE, access_cookie),
            (header::SET_COOKIE, csrf_cookie),
        ]),
        Json(json!(LoginResponse {
            access_token,
            expires_in: state.auth_service.access_ttl_seconds(),
            hotel_id: user.hotel_id,
            role: user.role,
        })),
    )
        .into_response())
}

pub async fn refresh_handler(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    payload: Option<Json<RefreshRequest>>,
) -> Result<Response, DomainError> {
    // CSRF check is now performed by auth_middleware for this endpoint

    let refresh_token = payload
        .and_then(|value| value.0.refresh_token)
        .or_else(|| extract_refresh_cookie(&headers))
        .unwrap_or_default();

    if refresh_token.trim().is_empty() {
        return Err(DomainError::Unauthorized);
    }

    let (hotel_id, user_id, new_refresh, _): (
        Uuid,
        Uuid,
        String,
        crate::domain::models::RefreshToken,
    ) = state
        .auth_service
        .rotate_refresh_token(&refresh_token)
        .await?;

    let user: crate::domain::models::User = state
        .user_repo
        .find_by_id(hotel_id, user_id)
        .await
        .map_err(DomainError::InfrastructureError)?
        .ok_or(DomainError::Unauthorized)?;

    let exp = state.auth_service.access_exp();
    let claims = crate::infrastructure::web::jwt::Claims {
        sub: user.id.to_string(),
        hotel_id: user.hotel_id.to_string(),
        role: user.role.clone(),
        exp,
    };

    let access_token =
        crate::infrastructure::web::jwt::encode_token(&claims, &state.config.jwt_secret)
            .map_err(DomainError::InfrastructureError)?;

    let refresh_cookie = build_refresh_cookie(&new_refresh, &state.config);
    let access_cookie = build_access_cookie(&access_token, &state.config);
    let csrf_token = generate_csrf_token();
    let csrf_cookie = build_csrf_cookie(&csrf_token, &state.config);

    Ok((
        StatusCode::OK,
        AppendHeaders([
            (header::SET_COOKIE, refresh_cookie),
            (header::SET_COOKIE, access_cookie),
            (header::SET_COOKIE, csrf_cookie),
        ]),
        Json(json!(LoginResponse {
            access_token,
            expires_in: state.auth_service.access_ttl_seconds(),
            hotel_id: user.hotel_id,
            role: user.role,
        })),
    )
        .into_response())
}

pub async fn logout_handler(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    payload: Option<Json<RefreshRequest>>,
) -> Result<Response, DomainError> {
    let ip = addr.ip().to_string();
    // CSRF check is now performed by auth_middleware for this endpoint

    let refresh_token = payload
        .and_then(|value| value.0.refresh_token)
        .or_else(|| extract_refresh_cookie(&headers))
        .unwrap_or_default();

    if refresh_token.trim().is_empty() {
        // If no token, just clear cookies and return OK (idempotent logout)
        let expired_cookie = clear_refresh_cookie(&state.config);
        let expired_access = clear_access_cookie(&state.config);
        let expired_csrf = clear_csrf_cookie(&state.config);
        return Ok((
            StatusCode::OK,
            AppendHeaders([
                (header::SET_COOKIE, expired_cookie),
                (header::SET_COOKIE, expired_access),
                (header::SET_COOKIE, expired_csrf),
            ]),
            Json(json!({ "status": "ok" })),
        )
            .into_response());
    }

    let (hotel_id, user_id) = state
        .auth_service
        .revoke_refresh_token(&refresh_token)
        .await?;
    state
        .auth_service
        .revoke_user_tokens(hotel_id, user_id)
        .await?;
    let expired_cookie = clear_refresh_cookie(&state.config);
    let expired_access = clear_access_cookie(&state.config);
    let expired_csrf = clear_csrf_cookie(&state.config);
    state
        .audit_service
        .record(Some(hotel_id), Some(user_id), "auth.logout", Some(ip))
        .await;
    Ok((
        StatusCode::OK,
        AppendHeaders([
            (header::SET_COOKIE, expired_cookie),
            (header::SET_COOKIE, expired_access),
            (header::SET_COOKIE, expired_csrf),
        ]),
        Json(json!({ "status": "ok" })),
    )
        .into_response())
}

pub async fn me_handler(
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,

    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    let user_id = uuid::Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;

    let hotel_id =
        uuid::Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;

    let user: crate::domain::models::User = state
        .user_repo
        .find_by_id(hotel_id, user_id)
        .await
        .map_err(DomainError::InfrastructureError)?
        .ok_or(DomainError::Unauthorized)?;

    Ok(Json(json!({

        "id": user.id,

        "username": user.username,

        "hotel_id": user.hotel_id,

        "role": user.role

    })))
}

#[derive(Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    pub role: String,
}

pub async fn list_users_handler(
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let users: Vec<crate::domain::models::User> = state
        .user_repo
        .find_all(hotel_id)
        .await
        .map_err(DomainError::InfrastructureError)?;

    Ok(Json(json!(users
        .into_iter()
        .map(|user| json!({ "id": user.id, "username": user.username, "role": user.role }))
        .collect::<Vec<_>>())))
}

pub async fn delete_user_handler(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<Uuid>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let current_user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;

    if user_id == current_user_id {
        return Err(DomainError::InvalidInput(
            "No puedes eliminar tu propia cuenta".to_string(),
        ));
    }

    state
        .user_repo
        .delete(hotel_id, user_id)
        .await
        .map_err(DomainError::InfrastructureError)?;

    state
        .audit_service
        .record(
            Some(hotel_id),
            Some(current_user_id),
            &format!("user.deleted: {}", user_id),
            None,
        )
        .await;

    Ok(Json(json!({ "status": "ok" })))
}

pub async fn create_user_handler(
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateUserRequest>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    if payload.username.trim().is_empty() || payload.password.trim().is_empty() {
        return Err(DomainError::InvalidInput(
            "Usuario y contraseña son obligatorios".to_string(),
        ));
    }

    let hash = crate::infrastructure::web::passwords::hash_password(&payload.password)
        .map_err(DomainError::InfrastructureError)?;

    let user = crate::domain::models::User {
        id: Uuid::new_v4(),
        hotel_id,
        username: payload.username,
        password_hash: hash,
        role: payload.role,
    };

    let created: crate::domain::models::User = state
        .user_repo
        .create(user)
        .await
        .map_err(map_user_repo_error)?;

    state
        .audit_service
        .record(Some(hotel_id), Some(created.id), "user.created", None)
        .await;

    Ok(Json(
        json!({ "id": created.id, "username": created.username, "role": created.role }),
    ))
}

fn map_user_repo_error(message: String) -> DomainError {
    let normalized = message.to_lowercase();
    if normalized.contains("duplicate key value")
        || normalized.contains("ux_users_hotel_username")
        || normalized.contains("users_username_key")
    {
        DomainError::UserAlreadyExists
    } else {
        DomainError::InfrastructureError(message)
    }
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
    cookie
}

#[derive(Deserialize, ToSchema)]
pub struct CreateHotelRequest {
    pub name: String,
    pub address: Option<String>,
}

pub async fn list_hotels_handler(
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    let _ = claims;
    let hotels = state.hotel_service.list_hotels().await?;
    Ok(Json(json!(hotels)))
}

pub async fn create_hotel_handler(
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateHotelRequest>,
) -> Result<Json<Value>, DomainError> {
    let _ = claims;
    let hotel = state
        .hotel_service
        .create_hotel(payload.name, payload.address)
        .await?;
    Ok(Json(json!(hotel)))
}

#[derive(Deserialize, ToSchema)]
pub struct AddExtraChargeRequest {
    pub description: String,
    pub amount_cents: i64,
    pub category: String,
}

pub async fn add_extra_charge_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(booking_id): Path<Uuid>,
    Json(payload): Json<AddExtraChargeRequest>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;

    let charge = state
        .billing_service
        .add_extra_charge(
            hotel_id,
            booking_id,
            payload.description,
            payload.amount_cents,
            payload.category,
        )
        .await?;

    Ok(Json(json!(charge)))
}

pub async fn list_extra_charges_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;

    let charges = state
        .billing_service
        .list_extra_charges(hotel_id, booking_id)
        .await?;
    Ok(Json(json!(charges)))
}

#[derive(Deserialize)]
pub struct CashClosureRequest {
    pub notes: Option<String>,
}

pub async fn get_current_balance_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let (total, cash, card) = state
        .cash_closure_service
        .get_current_balance(hotel_id)
        .await?;

    Ok(Json(json!({
        "total_amount_cents": total,
        "cash_amount_cents": cash,
        "card_amount_cents": card
    })))
}

pub async fn close_cash_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Json(payload): Json<CashClosureRequest>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;

    let closure = state
        .cash_closure_service
        .close_cash(hotel_id, user_id, payload.notes)
        .await?;

    state
        .audit_service
        .record(Some(hotel_id), Some(user_id), "cash.closed", None)
        .await;

    Ok(Json(json!(closure)))
}

pub async fn health_check() -> Json<Value> {
    Json(json!({ "status": "operational" }))
}

pub async fn readiness_check(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    let dummy_hotel = Uuid::nil(); // Solo para verificar conexión
    let _: Vec<crate::domain::models::Room> = state
        .room_repo
        .find_all(dummy_hotel)
        .await
        .map_err(DomainError::InfrastructureError)?;
    Ok(Json(json!({ "status": "ready" })))
}

pub async fn root_handler() -> Json<Value> {
    Json(json!({ "message": "HMS Elite Backend (Hexagonal) activo" }))
}

#[utoipa::path(
    get,
    path = "/api/v1/analytics/kpis",
    responses(
        (status = 200, description = "KPIs del dashboard", body = DashboardKpis)
    ),
    tag = "Análisis",
    security(
        ("jwt" = [])
    )
)]
pub async fn get_dashboard_kpis_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let kpis = state
        .reporting_service
        .get_dashboard_summary(hotel_id)
        .await
        .map_err(DomainError::InfrastructureError)?;
    Ok(Json(json!(kpis)))
}

pub async fn list_invoices_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let invoices = state
        .invoice_repo
        .find_all(hotel_id)
        .await
        .map_err(DomainError::InfrastructureError)?;
    Ok(Json(json!(invoices)))
}

pub async fn get_invoice_by_booking_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let invoice = state
        .invoice_repo
        .find_by_booking(hotel_id, booking_id)
        .await
        .map_err(DomainError::InfrastructureError)?;

    match invoice {
        Some(inv) => Ok(Json(json!(inv))),
        None => Err(DomainError::InvoiceNotFound),
    }
}

#[utoipa::path(
    get,
    path = "/api/v1/housekeeping/dirty",
    responses(
        (status = 200, description = "Lista de habitaciones que requieren limpieza", body = [Room])
    ),
    tag = "Housekeeping"
)]
pub async fn list_dirty_rooms_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let rooms = state
        .housekeeping_service
        .list_dirty_rooms(hotel_id)
        .await?;
    Ok(Json(json!(rooms)))
}

#[utoipa::path(
    post,
    path = "/api/v1/housekeeping/{room_id}/start",
    responses(
        (status = 200, description = "Limpieza iniciada")
    ),
    params(
        ("room_id" = Uuid, Path, description = "ID de la habitación")
    ),
    tag = "Housekeeping"
)]
pub async fn start_cleaning_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    state
        .housekeeping_service
        .start_cleaning(hotel_id, room_id)
        .await?;
    Ok(Json(json!({ "status": "ok" })))
}

#[utoipa::path(
    post,
    path = "/api/v1/housekeeping/{room_id}/finish",
    responses(
        (status = 200, description = "Limpieza finalizada e habitación disponible")
    ),
    params(
        ("room_id" = Uuid, Path, description = "ID de la habitación")
    ),
    tag = "Housekeeping"
)]
pub async fn finish_cleaning_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    state
        .housekeeping_service
        .finish_cleaning(hotel_id, room_id)
        .await?;
    Ok(Json(json!({ "status": "ok" })))
}
#[utoipa::path(
    get,
    path = "/api/v1/reports/revenue",
    responses(
        (status = 200, description = "Reporte de ingresos por día", body = [RevenueReport])
    ),
    params(
        ("start" = Option<NaiveDate>, Query, description = "Fecha de inicio (YYYY-MM-DD)"),
        ("end" = Option<NaiveDate>, Query, description = "Fecha de fin (YYYY-MM-DD)")
    ),
    tag = "Análisis"
)]
pub async fn get_revenue_report_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Query(params): Query<DateRangeParams>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let start = params
        .start
        .unwrap_or_else(|| chrono::Utc::now().naive_utc().date() - chrono::Duration::days(30));
    let end = params
        .end
        .unwrap_or_else(|| chrono::Utc::now().naive_utc().date());

    let report = state
        .reporting_service
        .get_revenue_report(hotel_id, start, end)
        .await
        .map_err(DomainError::InfrastructureError)?;

    Ok(Json(json!(report)))
}

#[utoipa::path(
    get,
    path = "/api/v1/reports/occupancy",
    responses(
        (status = 200, description = "Reporte de ocupación por día", body = [OccupancyReport])
    ),
    params(
        ("start" = Option<NaiveDate>, Query, description = "Fecha de inicio (YYYY-MM-DD)"),
        ("end" = Option<NaiveDate>, Query, description = "Fecha de fin (YYYY-MM-DD)")
    ),
    tag = "Análisis"
)]
pub async fn get_occupancy_report_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Query(params): Query<DateRangeParams>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let start = params
        .start
        .unwrap_or_else(|| chrono::Utc::now().naive_utc().date() - chrono::Duration::days(30));
    let end = params
        .end
        .unwrap_or_else(|| chrono::Utc::now().naive_utc().date());

    let report = state
        .reporting_service
        .get_occupancy_report(hotel_id, start, end)
        .await
        .map_err(DomainError::InfrastructureError)?;

    Ok(Json(json!(report)))
}
