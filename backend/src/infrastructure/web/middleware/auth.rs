use crate::app_state::AppState;
use crate::domain::errors::DomainError;
use crate::infrastructure::web::utils::{csrf_valid, requires_csrf};
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;

pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Result<Response, DomainError> {
    if !state.config.auth_required {
        return Ok(next.run(req).await);
    }

    let path = req.uri().path();
    let is_public_path = path == "/health"
        || path == "/ready"
        || path == "/metrics"
        || path == "/"
        || path.starts_with("/swagger-ui")
        || path.starts_with("/api-docs")
        || path == "/api/auth/login"
        || path == "/api/auth/refresh"
        || path == "/api/auth/logout"
        || path == "/api/v1/auth/login"
        || path == "/api/v1/auth/refresh"
        || path == "/api/v1/auth/logout";

    // Perform CSRF check BEFORE potentially skipping auth for public paths.
    // This ensures that even if authentication is skipped (e.g., for refresh/logout),
    // we still validate CSRF for state-changing operations.
    if requires_csrf(&req) && !csrf_valid(req.headers()) {
        return Err(DomainError::InvalidInput("CSRF token inválido".to_string()));
    }

    if is_public_path {
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

    let claims = crate::infrastructure::web::jwt::decode_token(
        &token,
        &state.config.jwt_secret,
        state.config.jwt_previous_secret.as_deref(),
    )
    .map_err(|_| DomainError::Unauthorized)?;

    // Role check is now handled by RBAC middleware

    let mut req = req;
    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}
