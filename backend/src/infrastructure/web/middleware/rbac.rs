use crate::domain::errors::DomainError;
use crate::infrastructure::web::jwt::Claims;
use axum::{extract::Request, middleware::Next, response::Response};

pub fn role_has_capability(role: &str, capability: &str) -> bool {
    match role {
        // Platform/super-admin keeps full access.
        "admin" => true,
        // Ops gets operational read permissions.
        "ops" => matches!(
            capability,
            "analytics.kpis.read"
                | "billing.invoices.read"
                | "reports.revenue.read"
                | "reports.occupancy.read"
        ),
        // Reception role intentionally restricted for this phase.
        "receptionist" => false,
        _ => false,
    }
}

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

pub async fn require_capability_middleware(
    required_capability: &'static str,
    req: Request,
    next: Next,
) -> Result<Response, DomainError> {
    let claims = req
        .extensions()
        .get::<Claims>()
        .ok_or(DomainError::Unauthorized)?;

    if !role_has_capability(&claims.role, required_capability) {
        return Err(DomainError::Forbidden);
    }

    Ok(next.run(req).await)
}

pub async fn hotels_read(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("saas.hotels.read", req, next).await
}

pub async fn hotels_write(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("saas.hotels.write", req, next).await
}

pub async fn rooms_write(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("rooms.write", req, next).await
}

pub async fn users_read(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("users.read", req, next).await
}

pub async fn users_write(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("users.write", req, next).await
}

pub async fn users_delete(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("users.delete", req, next).await
}

pub async fn analytics_read(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("analytics.kpis.read", req, next).await
}

pub async fn invoices_read(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("billing.invoices.read", req, next).await
}

pub async fn reports_revenue_read(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("reports.revenue.read", req, next).await
}

pub async fn reports_occupancy_read(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("reports.occupancy.read", req, next).await
}

#[cfg(test)]
mod tests {
    use super::role_has_capability;

    #[test]
    fn admin_has_all_capabilities() {
        assert!(role_has_capability("admin", "any.capability"));
    }

    #[test]
    fn ops_has_only_operational_read_capabilities() {
        assert!(role_has_capability("ops", "analytics.kpis.read"));
        assert!(role_has_capability("ops", "billing.invoices.read"));
        assert!(!role_has_capability("ops", "users.write"));
    }

    #[test]
    fn unknown_or_reception_role_is_restricted() {
        assert!(!role_has_capability("receptionist", "analytics.kpis.read"));
        assert!(!role_has_capability("guest", "reports.revenue.read"));
    }
}
