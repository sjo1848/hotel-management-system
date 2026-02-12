use crate::domain::errors::DomainError;
use crate::AppState;
use axum::{
    extract::{Path, Query, State, ConnectInfo},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response, AppendHeaders},
    Extension, Json,
};
use std::net::SocketAddr;
use chrono::NaiveDate;
use rand::RngCore;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;
use base64::Engine;
use tokio::task_local;
use utoipa::ToSchema;

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
            DomainError::InvalidInput(msg) => (StatusCode::BAD_REQUEST, "INVALID_INPUT", msg),
            DomainError::Unauthorized => (
                StatusCode::UNAUTHORIZED,
                "UNAUTHORIZED",
                "No autorizado".to_string(),
            ),
            DomainError::InfrastructureError(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "INFRA_ERROR",
                msg,
            ),
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
    pub role: String,
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateRoomStatusRequest {
    pub status: String,
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
) -> Result<Json<Value>, DomainError> {
    let rooms: Vec<crate::domain::models::Room> = state
        .room_repo
        .find_all()
        .await
        .map_err(DomainError::InfrastructureError)?;
    Ok(Json(json!(rooms)))
}

pub async fn update_room_status_handler(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<Uuid>,
    Json(payload): Json<UpdateRoomStatusRequest>,
) -> Result<Json<Value>, DomainError> {
    let status = match payload.status.to_uppercase().as_str() {
        "AVAILABLE" => crate::domain::models::RoomStatus::Available,
        "OCCUPIED" => crate::domain::models::RoomStatus::Occupied,
        "DIRTY" => crate::domain::models::RoomStatus::Dirty,
        "MAINTENANCE" => crate::domain::models::RoomStatus::Maintenance,
        _ => return Err(DomainError::InvalidInput("Estado de habitación inválido".to_string())),
    };

    state.room_service.update_room_status(room_id, status).await?;
    Ok(Json(json!({ "status": "ok" })))
}

pub async fn search_rooms_handler(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchParams>,
) -> Result<Json<Value>, DomainError> {
    let rooms: Vec<crate::domain::models::Room> = state
        .room_repo
        .find_available(params.start, params.end)
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
    Json(payload): Json<CreateBookingRequest>,
) -> Result<Json<Value>, DomainError> {
    if payload.guest_name.trim().is_empty() {
        return Err(DomainError::InvalidInput(
            "El nombre del huésped es obligatorio".to_string(),
        ));
    }

    // Especificamos el tipo para evitar el error de "never type fallback"
    let booking: crate::domain::models::Booking = state
        .booking_service
        .execute(
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
    Query(params): Query<BookingFilterParams>,
) -> Result<Json<Value>, DomainError> {
    let bookings: Vec<crate::domain::models::Booking> = match (params.start, params.end) {
        (Some(start), Some(end)) => state
            .booking_service
            .list_bookings_in_range(start, end)
            .await
            .map_err(DomainError::InfrastructureError)?,
        _ => state
            .booking_service
            .list_bookings()
            .await
            .map_err(DomainError::InfrastructureError)?,
    };
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

    let booking: crate::domain::models::Booking = state
        .booking_service
        .update_booking(
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
) -> Result<Json<Value>, DomainError> {
    let guests = state.guest_service.list_guests().await?;
    Ok(Json(json!(guests)))
}

pub async fn create_guest_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateGuestRequest>,
) -> Result<Json<Value>, DomainError> {
    let created = state
        .guest_service
        .create_guest(payload.full_name, payload.email, payload.phone)
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

    if payload.username.trim().is_empty() || payload.password.trim().is_empty() {
        return Err(DomainError::InvalidInput(
            "Usuario y contraseña son obligatorios".to_string(),
        ));
    }

    let user = match state
        .auth_service
        .verify_user(&payload.username, &payload.password)
        .await {
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
        role: user.role.clone(),
        exp,
    };

    let access_token =
        crate::infrastructure::web::jwt::encode_token(&claims, &state.config.jwt_secret)
            .map_err(DomainError::InfrastructureError)?;

    let (refresh_token, _): (String, crate::domain::models::RefreshToken) =
        state.auth_service.issue_refresh_token(user.id).await?;
    let refresh_cookie = build_refresh_cookie(&refresh_token, &state.config);
    let access_cookie = build_access_cookie(&access_token, &state.config);
    let csrf_token = generate_csrf_token();
    let csrf_cookie = build_csrf_cookie(&csrf_token, &state.config);

    record_audit(
        &state,
        Some(user.id),
        "auth.login",
        Some(ip),
    )
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

    let (user_id, new_refresh, _): (Uuid, String, crate::domain::models::RefreshToken) = state
        .auth_service
        .rotate_refresh_token(&refresh_token)
        .await?;

    let user: crate::domain::models::User = state
        .user_repo
        .find_by_id(user_id)
        .await
        .map_err(DomainError::InfrastructureError)?
        .ok_or(DomainError::Unauthorized)?;

    let exp = state.auth_service.access_exp();
    let claims = crate::infrastructure::web::jwt::Claims {
        sub: user.id.to_string(),
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

    let user_id = state
        .auth_service
        .revoke_refresh_token(&refresh_token)
        .await?;
    state.auth_service.revoke_user_tokens(user_id).await?;
    let expired_cookie = clear_refresh_cookie(&state.config);
    let expired_access = clear_access_cookie(&state.config);
    let expired_csrf = clear_csrf_cookie(&state.config);
    record_audit(&state, Some(user_id), "auth.logout", Some(ip)).await;
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
    let user: crate::domain::models::User = state
        .user_repo
        .find_by_id(user_id)
        .await
        .map_err(DomainError::InfrastructureError)?
        .ok_or(DomainError::Unauthorized)?;

    Ok(Json(json!({ "id": user.id, "username": user.username, "role": user.role })))
}

#[derive(Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    pub role: String,
}

pub async fn list_users_handler(
    Extension(_claims): Extension<crate::infrastructure::web::jwt::Claims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    let users: Vec<crate::domain::models::User> = state
        .user_repo
        .find_all()
        .await
        .map_err(DomainError::InfrastructureError)?;

    Ok(Json(json!(users
        .into_iter()
        .map(|user| json!({ "id": user.id, "username": user.username, "role": user.role }))
        .collect::<Vec<_>>())))
}

pub async fn create_user_handler(
    Extension(_claims): Extension<crate::infrastructure::web::jwt::Claims>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateUserRequest>,
) -> Result<Json<Value>, DomainError> {
    if payload.username.trim().is_empty() || payload.password.trim().is_empty() {
        return Err(DomainError::InvalidInput(
            "Usuario y contraseña son obligatorios".to_string(),
        ));
    }

    let hash = crate::infrastructure::web::passwords::hash_password(&payload.password)
        .map_err(DomainError::InfrastructureError)?;

    let user = crate::domain::models::User {
        id: Uuid::new_v4(),
        username: payload.username,
        password_hash: hash,
        role: payload.role,
    };

    let created: crate::domain::models::User = state
        .user_repo
        .create(user)
        .await
        .map_err(DomainError::InfrastructureError)?;

    record_audit(&state, Some(created.id), "user.created", None).await;

    Ok(Json(json!({ "id": created.id, "username": created.username, "role": created.role })))
}

fn extract_refresh_cookie(headers: &HeaderMap) -> Option<String> {
    let cookies_header = headers.get(header::COOKIE).and_then(|value| value.to_str().ok());
    cookies_header
        .and_then(|cookies| {
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

async fn record_audit(
    state: &Arc<AppState>,
    user_id: Option<Uuid>,
    action: &str,
    ip: Option<String>,
) {
    let event = crate::domain::models::AuditEvent {
        id: Uuid::new_v4(),
        user_id,
        action: action.to_string(),
        ip_address: ip,
        created_at: chrono::Utc::now().naive_utc(),
    };

    let _ = state.audit_repo.record(event).await;
}

pub async fn health_check() -> Json<Value> {
    Json(json!({ "status": "operational" }))
}

pub async fn readiness_check(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    let _: Vec<crate::domain::models::Room> = state
        .room_repo
        .find_all()
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
) -> Result<Json<Value>, DomainError> {
    let kpis = state
        .reporting_service
        .get_dashboard_summary()
        .await
        .map_err(DomainError::InfrastructureError)?;
    Ok(Json(json!(kpis)))
}

pub async fn list_invoices_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    let invoices = state
        .invoice_repo
        .find_all()
        .await
        .map_err(DomainError::InfrastructureError)?;
    Ok(Json(json!(invoices)))
}

pub async fn get_invoice_by_booking_handler(
    State(state): State<Arc<AppState>>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<Value>, DomainError> {
    let invoice = state
        .invoice_repo
        .find_by_booking(booking_id)
        .await
        .map_err(DomainError::InfrastructureError)?;

    match invoice {
        Some(inv) => Ok(Json(json!(inv))),
        None => Err(DomainError::InfrastructureError("Factura no encontrada para esta reserva".to_string())),
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
) -> Result<Json<Value>, DomainError> {
    let rooms = state.housekeeping_service.list_dirty_rooms().await?;
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
    Path(room_id): Path<Uuid>,
) -> Result<Json<Value>, DomainError> {
    state.housekeeping_service.start_cleaning(room_id).await?;
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
    Path(room_id): Path<Uuid>,
) -> Result<Json<Value>, DomainError> {
    state.housekeeping_service.finish_cleaning(room_id).await?;
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
    Query(params): Query<DateRangeParams>,
) -> Result<Json<Value>, DomainError> {
    let start = params.start.unwrap_or_else(|| chrono::Utc::now().naive_utc().date() - chrono::Duration::days(30));
    let end = params.end.unwrap_or_else(|| chrono::Utc::now().naive_utc().date());
    
    let report = state.reporting_service.get_revenue_report(start, end).await
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
    Query(params): Query<DateRangeParams>,
) -> Result<Json<Value>, DomainError> {
    let start = params.start.unwrap_or_else(|| chrono::Utc::now().naive_utc().date() - chrono::Duration::days(30));
    let end = params.end.unwrap_or_else(|| chrono::Utc::now().naive_utc().date());
    
    let report = state.reporting_service.get_occupancy_report(start, end).await
        .map_err(DomainError::InfrastructureError)?;
    
    Ok(Json(json!(report)))
}
