use axum::{
    extract::{State, Request},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;
use crate::app_state::AppState;
use crate::domain::errors::DomainError;
use crate::infrastructure::web::utils::{csrf_valid, requires_csrf};

pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Result<Response, DomainError> {
    if !state.config.auth_required {
        return Ok(next.run(req).await);
    }

    let path = req.uri().path();
    if path == "/health"
        || path == "/ready"
        || path == "/"
        || path == "/api/auth/login"
        || path == "/api/auth/refresh"
        || path == "/api/auth/logout"
        || path == "/api/v1/auth/login"
        || path == "/api/v1/auth/refresh"
        || path == "/api/v1/auth/logout"
    {
        return Ok(next.run(req).await);
    }

    let auth_header = req
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok());
    
    let token = if let Some(value) = auth_header {
        if value.starts_with("Bearer ") {
            value.trim_start_matches("Bearer ").trim().to_string()
        } else {
            return Err(DomainError::Unauthorized);
        }
    } else {
        let cookie_header = req
            .headers()
            .get(axum::http::header::COOKIE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("");
        cookie_header
            .split(';')
            .map(|cookie| cookie.trim())
            .find(|cookie| cookie.starts_with("access_token="))
            .map(|cookie| cookie.trim_start_matches("access_token=").to_string())
            .ok_or(DomainError::Unauthorized)?
    };

    let claims = crate::infrastructure::web::jwt::decode_token(&token, &state.config.jwt_secret)
        .map_err(|_| DomainError::Unauthorized)?;

    if requires_csrf(&req) && !csrf_valid(req.headers()) {
        return Err(DomainError::InvalidInput("CSRF token inválido".to_string()));
    }

    // Role check is now handled by RBAC middleware

    let mut req = req;
    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}
