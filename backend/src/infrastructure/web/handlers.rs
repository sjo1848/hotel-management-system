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
            DomainError::HotelAlreadyExists => (
                StatusCode::CONFLICT,
                "HOTEL_ALREADY_EXISTS",
                "Ya existe un hotel con ese nombre".to_string(),
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
            DomainError::UserNotFound => (
                StatusCode::NOT_FOUND,
                "USER_NOT_FOUND",
                "El usuario solicitado no existe".to_string(),
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
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let rooms: Vec<crate::domain::models::Room> =
        operations.room_service.list_rooms(hotel_id).await?;
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
    let operations = state.operations_context();
    let ip = addr.ip().to_string();
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    validate_non_empty_trimmed("room_number", &payload.room_number)?;
    validate_len_range("room_number", &payload.room_number, 1, 10)?;
    validate_non_empty_trimmed("room_type", &payload.room_type)?;
    validate_len_range("room_type", &payload.room_type, 1, 50)?;
    validate_positive_amount("price_cents", payload.price_cents)?;

    let room = operations
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
    let operations = state.operations_context();
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

    operations
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
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let rooms: Vec<crate::domain::models::Room> = operations
        .room_service
        .find_available_rooms(hotel_id, params.start, params.end)
        .await?;
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
    let booking_ctx = state.booking_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    validate_non_empty_trimmed("guest_name", &payload.guest_name)?;
    validate_len_range("guest_name", &payload.guest_name, 1, 100)?;
    validate_booking_dates(payload.check_in, payload.check_out)?;

    // Especificamos el tipo para evitar el error de "never type fallback"
    let booking: crate::domain::models::Booking = booking_ctx
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
    let booking_ctx = state.booking_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let bookings: Vec<crate::domain::models::Booking> = match (params.start, params.end) {
        (Some(start), Some(end)) => {
            booking_ctx
                .booking_service
                .list_bookings_in_range(hotel_id, start, end)
                .await?
        }
        _ => booking_ctx.booking_service.list_bookings(hotel_id).await?,
    };
    Ok(Json(json!(bookings)))
}

pub async fn update_booking_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(booking_id): Path<Uuid>,
    Json(payload): Json<UpdateBookingRequest>,
) -> Result<Json<Value>, DomainError> {
    let booking_ctx = state.booking_context();
    let actor_user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    if let Some(name) = payload.guest_name.as_deref() {
        validate_non_empty_trimmed("guest_name", name)?;
        validate_len_range("guest_name", name, 1, 100)?;
    }
    if let (Some(check_in), Some(check_out)) = (payload.check_in, payload.check_out) {
        validate_booking_dates(check_in, check_out)?;
    }
    let status = parse_booking_status_input(payload.status.as_deref())?;

    let booking: crate::domain::models::Booking = booking_ctx
        .booking_transaction_service
        .update_booking_transactional(
            hotel_id,
            booking_id,
            Some(actor_user_id),
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
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;

    let guests = operations.guest_service.list_guests(hotel_id).await?;

    Ok(Json(json!(guests)))
}

pub async fn create_guest_handler(
    State(state): State<Arc<AppState>>,

    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,

    Json(payload): Json<CreateGuestRequest>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    validate_non_empty_trimmed("full_name", &payload.full_name)?;
    validate_len_range("full_name", &payload.full_name, 2, 120)?;
    validate_email(&payload.email)?;
    validate_len_range("email", &payload.email, 5, 150)?;

    let created = operations
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
    headers: HeaderMap,
    Json(payload): Json<LoginRequest>,
) -> Result<Response, DomainError> {
    let auth_ctx = state.auth_context();
    let ip = addr.ip().to_string();
    let hotel_id_input = payload.hotel_id.trim();
    validate_non_empty_trimmed("hotel_id", hotel_id_input)?;
    validate_non_empty_trimmed("username", &payload.username)?;
    validate_len_range("username", &payload.username, 3, 80)?;
    validate_non_empty_trimmed("password", &payload.password)?;
    validate_len_range("password", &payload.password, 8, 128)?;

    let hotel_id = if let Ok(uuid) = Uuid::parse_str(hotel_id_input) {
        uuid
    } else {
        state
            .hotel_service
            .find_hotel_id_by_name_ci(hotel_id_input)
            .await?
            .ok_or_else(|| {
                DomainError::InvalidInput("Hotel inválido. Usá ID o nombre existente.".to_string())
            })?
    };

    let user = match auth_ctx
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

    let device_id = resolve_device_id(payload.device_id.as_deref(), &headers);
    auth_ctx
        .auth_service
        .revoke_user_device_tokens(user.hotel_id, user.id, &device_id)
        .await?;

    let exp = auth_ctx.auth_service.access_exp();

    let claims = crate::infrastructure::web::jwt::Claims {
        sub: user.id.to_string(),
        hotel_id: user.hotel_id.to_string(),
        role: user.role.clone(),
        exp,
    };

    let access_token = crate::infrastructure::web::jwt::encode_token(
        &claims,
        &state.config.jwt_secret,
        &state.config.jwt_kid,
    )
    .map_err(DomainError::InfrastructureError)?;

    let (refresh_token, _): (String, crate::domain::models::RefreshToken) = auth_ctx
        .auth_service
        .issue_refresh_token(user.hotel_id, user.id, device_id, None)
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
            expires_in: auth_ctx.auth_service.access_ttl_seconds(),
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
    let auth_ctx = state.auth_context();
    // CSRF check is now performed by auth_middleware for this endpoint

    let refresh_token = payload
        .as_ref()
        .and_then(|value| value.0.refresh_token.as_ref().cloned())
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
    ) = auth_ctx
        .auth_service
        .rotate_refresh_token(&refresh_token)
        .await?;

    let user: crate::domain::models::User = auth_ctx
        .auth_service
        .get_session_user(hotel_id, user_id)
        .await?;

    let exp = auth_ctx.auth_service.access_exp();
    let claims = crate::infrastructure::web::jwt::Claims {
        sub: user.id.to_string(),
        hotel_id: user.hotel_id.to_string(),
        role: user.role.clone(),
        exp,
    };

    let access_token = crate::infrastructure::web::jwt::encode_token(
        &claims,
        &state.config.jwt_secret,
        &state.config.jwt_kid,
    )
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
            expires_in: auth_ctx.auth_service.access_ttl_seconds(),
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
    let auth_ctx = state.auth_context();
    let ip = addr.ip().to_string();
    // CSRF check is now performed by auth_middleware for this endpoint

    let refresh_token = payload
        .as_ref()
        .and_then(|value| value.0.refresh_token.as_ref().cloned())
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

    let logout_all_devices = payload
        .as_ref()
        .and_then(|value| value.0.all_devices)
        .unwrap_or(false);
    let revoked = auth_ctx
        .auth_service
        .revoke_refresh_token_with_context(&refresh_token)
        .await?;
    if logout_all_devices {
        auth_ctx
            .auth_service
            .revoke_user_tokens(revoked.hotel_id, revoked.user_id)
            .await?;
    } else {
        auth_ctx
            .auth_service
            .revoke_session_tokens(revoked.hotel_id, revoked.user_id, revoked.session_id)
            .await?;
    }
    let expired_cookie = clear_refresh_cookie(&state.config);
    let expired_access = clear_access_cookie(&state.config);
    let expired_csrf = clear_csrf_cookie(&state.config);
    state
        .audit_service
        .record(
            Some(revoked.hotel_id),
            Some(revoked.user_id),
            "auth.logout",
            Some(ip),
        )
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
    let auth_ctx = state.auth_context();
    let user_id = uuid::Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;

    let hotel_id =
        uuid::Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;

    let user: crate::domain::models::User = auth_ctx
        .auth_service
        .get_session_user(hotel_id, user_id)
        .await?;

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
    let users: Vec<crate::domain::models::User> = state.user_service.list_users(hotel_id).await?;

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

    state.user_service.delete_user(hotel_id, user_id).await?;

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
    validate_non_empty_trimmed("username", &payload.username)?;
    validate_len_range("username", &payload.username, 3, 80)?;
    validate_non_empty_trimmed("password", &payload.password)?;
    validate_len_range("password", &payload.password, 8, 128)?;
    validate_non_empty_trimmed("role", &payload.role)?;
    validate_role(&payload.role)?;

    let created: crate::domain::models::User = state
        .user_service
        .create_user(hotel_id, payload.username, payload.password, payload.role)
        .await?;

    state
        .audit_service
        .record(Some(hotel_id), Some(created.id), "user.created", None)
        .await;

    Ok(Json(
        json!({ "id": created.id, "username": created.username, "role": created.role }),
    ))
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
    validate_non_empty_trimmed("name", &payload.name)?;
    validate_len_range("name", &payload.name, 2, 100)?;
    if let Some(address) = payload.address.as_deref() {
        validate_len_range("address", address, 2, 250)?;
    }
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
    let booking_ctx = state.booking_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    validate_non_empty_trimmed("description", &payload.description)?;
    validate_len_range("description", &payload.description, 2, 250)?;
    validate_non_empty_trimmed("category", &payload.category)?;
    validate_len_range("category", &payload.category, 2, 50)?;
    validate_positive_amount("amount_cents", payload.amount_cents)?;

    let charge = booking_ctx
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
    let booking_ctx = state.booking_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;

    let charges = booking_ctx
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
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let (total, cash, card) = operations
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
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    if let Some(notes) = payload.notes.as_deref() {
        validate_len_range("notes", notes, 0, 500)?;
    }

    let closure = operations
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
    let _: Vec<crate::domain::models::Room> = state.room_service.list_rooms(dummy_hotel).await?;
    Ok(Json(json!({ "status": "ready" })))
}

pub async fn root_handler() -> Json<Value> {
    Json(json!({ "message": "HMS Elite Backend (Hexagonal) activo" }))
}

#[utoipa::path(
    post,
    path = "/api/v1/telemetry/ui",
    request_body = UiTelemetryEventRequest,
    responses(
        (status = 200, description = "Evento de telemetría UI aceptado"),
        (status = 400, description = "Evento inválido")
    ),
    tag = "Análisis"
)]
pub async fn track_ui_telemetry_handler(
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Json(payload): Json<UiTelemetryEventRequest>,
) -> Result<Json<Value>, DomainError> {
    const ALLOWED_EVENTS: &[&str] = &[
        "dashboard_load_failed",
        "dashboard_retry_clicked",
        "close_cash_success",
        "close_cash_failure",
    ];

    if !ALLOWED_EVENTS.contains(&payload.event.as_str()) {
        return Err(DomainError::InvalidInput(format!(
            "Evento de telemetría UI inválido: {}",
            payload.event
        )));
    }

    counter!(
        "ui_telemetry_events_total",
        "event" => payload.event.clone()
    )
    .increment(1);

    tracing::info!(
        event = %payload.event,
        hotel_id = %claims.hotel_id,
        has_payload = payload.payload.is_some(),
        has_timestamp = payload.timestamp.is_some(),
        "ui telemetry event ingested"
    );

    Ok(Json(json!({ "status": "ok" })))
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
        .await?;
    Ok(Json(json!(kpis)))
}

pub async fn list_invoices_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let booking_ctx = state.booking_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let invoices = booking_ctx.invoice_service.list_invoices(hotel_id).await?;
    Ok(Json(json!(invoices)))
}

pub async fn get_invoice_by_booking_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<Value>, DomainError> {
    let booking_ctx = state.booking_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let invoice = booking_ctx
        .invoice_service
        .get_invoice_by_booking(hotel_id, booking_id)
        .await?;
    Ok(Json(json!(invoice)))
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
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let rooms = operations
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
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    operations
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
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    operations
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
    validate_date_range(start, end)?;

    let report = state
        .reporting_service
        .get_revenue_report(hotel_id, start, end)
        .await?;

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
    validate_date_range(start, end)?;

    let report = state
        .reporting_service
        .get_occupancy_report(hotel_id, start, end)
        .await?;

    Ok(Json(json!(report)))
}
