use crate::domain::errors::DomainError;
use crate::AppState;
use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Extension, Json,
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

#[derive(Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: Option<String>,
}

#[derive(serde::Serialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub expires_in: usize,
    pub role: String,
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
) -> Result<Response, DomainError> {
    if payload.username.trim().is_empty() || payload.password.trim().is_empty() {
        return Err(DomainError::InvalidInput(
            "Usuario y contraseña son obligatorios".to_string(),
        ));
    }

    let user = state
        .auth_service
        .verify_user(&payload.username, &payload.password)
        .await?;

    let exp = state.auth_service.access_exp();

    let claims = crate::infrastructure::web::jwt::Claims {
        sub: user.id.to_string(),
        role: user.role.clone(),
        exp,
    };

    let access_token =
        crate::infrastructure::web::jwt::encode_token(&claims, &state.config.jwt_secret)
            .map_err(DomainError::InfrastructureError)?;

    let (refresh_token, _) = state.auth_service.issue_refresh_token(user.id).await?;
    let refresh_cookie = build_refresh_cookie(&refresh_token, &state.config);
    let access_cookie = build_access_cookie(&access_token, &state.config);

    record_audit(
        &state,
        Some(user.id),
        "auth.login",
        None,
    )
    .await;

    Ok((
        StatusCode::OK,
        [(header::SET_COOKIE, refresh_cookie), (header::SET_COOKIE, access_cookie)],
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
    let refresh_token = payload
        .and_then(|value| value.0.refresh_token)
        .or_else(|| extract_refresh_cookie(&headers))
        .unwrap_or_default();

    if refresh_token.trim().is_empty() {
        return Err(DomainError::InvalidInput(
            "Refresh token inválido".to_string(),
        ));
    }

    let (user_id, new_refresh, _) = state
        .auth_service
        .rotate_refresh_token(&refresh_token)
        .await?;

    let user = state
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

    Ok((
        StatusCode::OK,
        [(header::SET_COOKIE, refresh_cookie), (header::SET_COOKIE, access_cookie)],
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
    headers: HeaderMap,
    payload: Option<Json<RefreshRequest>>,
) -> Result<Response, DomainError> {
    let refresh_token = payload
        .and_then(|value| value.0.refresh_token)
        .or_else(|| extract_refresh_cookie(&headers))
        .unwrap_or_default();

    if refresh_token.trim().is_empty() {
        return Err(DomainError::InvalidInput(
            "Refresh token inválido".to_string(),
        ));
    }

    let user_id = state
        .auth_service
        .revoke_refresh_token(&refresh_token)
        .await?;
    state.auth_service.revoke_user_tokens(user_id).await?;
    let expired_cookie = clear_refresh_cookie(&state.config);
    let expired_access = clear_access_cookie(&state.config);
    record_audit(&state, Some(user_id), "auth.logout", None).await;
    Ok((
        StatusCode::OK,
        [(header::SET_COOKIE, expired_cookie), (header::SET_COOKIE, expired_access)],
        Json(json!({ "status": "ok" })),
    )
        .into_response())
}

pub async fn me_handler(
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    let user_id = uuid::Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    let user = state
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
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    if claims.role != "admin" {
        return Err(DomainError::Unauthorized);
    }

    let users = state
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
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateUserRequest>,
) -> Result<Json<Value>, DomainError> {
    if claims.role != "admin" {
        return Err(DomainError::Unauthorized);
    }

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

    let created = state
        .user_repo
        .create(user)
        .await
        .map_err(DomainError::InfrastructureError)?;

    record_audit(&state, Some(created.id), "user.created", None).await;

    Ok(Json(json!({ "id": created.id, "username": created.username, "role": created.role })))
}

fn extract_refresh_cookie(headers: &HeaderMap) -> Option<String> {
    headers
        .get(header::COOKIE)
        .and_then(|value| value.to_str().ok())
        .and_then(|cookies| {
            cookies
                .split(';')
                .map(|cookie| cookie.trim())
                .find(|cookie| cookie.starts_with("refresh_token="))
                .map(|cookie| cookie.trim_start_matches("refresh_token=").to_string())
        })
}

fn build_refresh_cookie(token: &str, config: &crate::config::AppConfig) -> String {
    let mut cookie = format!(
        "refresh_token={}; HttpOnly; Path=/; SameSite={}; Max-Age={}",
        token,
        config.cookie_samesite,
        config.refresh_ttl_days * 24 * 60 * 60
    );

    if config.cookie_secure {
        cookie.push_str("; Secure");
    }

    cookie
}

fn clear_refresh_cookie(config: &crate::config::AppConfig) -> String {
    let mut cookie = format!(
        "refresh_token=; HttpOnly; Path=/; SameSite={}; Max-Age=0",
        config.cookie_samesite
    );
    if config.cookie_secure {
        cookie.push_str("; Secure");
    }
    cookie
}

fn build_access_cookie(token: &str, config: &crate::config::AppConfig) -> String {
    let mut cookie = format!(
        "access_token={}; HttpOnly; Path=/; SameSite={}; Max-Age={}",
        token,
        config.cookie_samesite,
        config.access_ttl_minutes * 60
    );

    if config.cookie_secure {
        cookie.push_str("; Secure");
    }

    cookie
}

fn clear_access_cookie(config: &crate::config::AppConfig) -> String {
    let mut cookie = format!(
        "access_token=; HttpOnly; Path=/; SameSite={}; Max-Age=0",
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
