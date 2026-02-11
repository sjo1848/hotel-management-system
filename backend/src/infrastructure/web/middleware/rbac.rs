use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
};
use crate::domain::errors::DomainError;
use crate::infrastructure::web::jwt::Claims;

pub async fn require_role_middleware(
    required_role: &'static str,
    req: Request,
    next: Next,
) -> Result<Response, DomainError> {
    let claims = req
        .extensions()
        .get::<Claims>()
        .ok_or(DomainError::Unauthorized)?;

    if claims.role != required_role && claims.role != "admin" {
        return Err(DomainError::Unauthorized);
    }

    Ok(next.run(req).await)
}

// Helper to create the middleware for a specific role
pub async fn admin_only(req: Request, next: Next) -> Result<Response, DomainError> {
    require_role_middleware("admin", req, next).await
}

pub async fn ops_only(req: Request, next: Next) -> Result<Response, DomainError> {
    require_role_middleware("ops", req, next).await
}

pub async fn reception_only(req: Request, next: Next) -> Result<Response, DomainError> {
    require_role_middleware("receptionist", req, next).await
}
