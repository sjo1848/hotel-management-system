use crate::domain::errors::DomainError;
use crate::infrastructure::web::jwt::Claims;
use axum::{extract::Request, middleware::Next, response::Response};

const ADMIN_CAPABILITIES: &[&str] = &[
    "saas.hotels.read",
    "saas.hotels.write",
    "rooms.read",
    "rooms.write",
    "rooms.search",
    "rooms.status.write",
    "bookings.read",
    "bookings.write",
    "bookings.update",
    "bookings.extra_charges.read",
    "bookings.extra_charges.write",
    "guests.read",
    "guests.write",
    "housekeeping.read",
    "housekeeping.write",
    "billing.balance.read",
    "billing.close_cash.write",
    "billing.invoices.read",
    "billing.invoice.read",
    "analytics.kpis.read",
    "reports.revenue.read",
    "reports.occupancy.read",
    "users.read",
    "users.write",
    "users.delete",
];

const SAAS_ADMIN_CAPABILITIES: &[&str] = &["saas.hotels.read", "saas.hotels.write"];

const OPS_CAPABILITIES: &[&str] = &[
    "rooms.read",
    "rooms.search",
    "rooms.status.write",
    "bookings.read",
    "bookings.write",
    "bookings.update",
    "bookings.extra_charges.read",
    "bookings.extra_charges.write",
    "guests.read",
    "guests.write",
    "housekeeping.read",
    "housekeeping.write",
    "billing.balance.read",
    "billing.close_cash.write",
    "billing.invoices.read",
    "billing.invoice.read",
    "analytics.kpis.read",
    "reports.revenue.read",
    "reports.occupancy.read",
];

const RECEPTIONIST_CAPABILITIES: &[&str] = &[
    "rooms.read",
    "rooms.search",
    "bookings.read",
    "bookings.write",
    "bookings.update",
    "bookings.extra_charges.read",
    "bookings.extra_charges.write",
    "guests.read",
    "guests.write",
    "billing.balance.read",
    "billing.invoice.read",
];

const HOUSEKEEPING_CAPABILITIES: &[&str] = &["housekeeping.read", "housekeeping.write"];

fn has_capability(capabilities: &[&str], capability: &str) -> bool {
    capabilities.contains(&capability)
}

pub fn role_has_capability(role: &str, capability: &str) -> bool {
    match role {
        "admin" => has_capability(ADMIN_CAPABILITIES, capability),
        "saas_admin" => has_capability(SAAS_ADMIN_CAPABILITIES, capability),
        // Ops can operate day-to-day flow and business reporting.
        "ops" => has_capability(OPS_CAPABILITIES, capability),
        // Reception can handle front-desk workflows.
        "receptionist" => has_capability(RECEPTIONIST_CAPABILITIES, capability),
        // Housekeeping is constrained to cleaning operations.
        "housekeeping" => has_capability(HOUSEKEEPING_CAPABILITIES, capability),
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

pub async fn rooms_read(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("rooms.read", req, next).await
}

pub async fn rooms_search(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("rooms.search", req, next).await
}

pub async fn rooms_status_write(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("rooms.status.write", req, next).await
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

pub async fn invoice_read(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("billing.invoice.read", req, next).await
}

pub async fn bookings_read(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("bookings.read", req, next).await
}

pub async fn bookings_write(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("bookings.write", req, next).await
}

pub async fn bookings_update(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("bookings.update", req, next).await
}

pub async fn extra_charges_read(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("bookings.extra_charges.read", req, next).await
}

pub async fn extra_charges_write(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("bookings.extra_charges.write", req, next).await
}

pub async fn guests_read(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("guests.read", req, next).await
}

pub async fn guests_write(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("guests.write", req, next).await
}

pub async fn housekeeping_read(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("housekeeping.read", req, next).await
}

pub async fn housekeeping_write(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("housekeeping.write", req, next).await
}

pub async fn billing_balance_read(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("billing.balance.read", req, next).await
}

pub async fn billing_close_cash_write(req: Request, next: Next) -> Result<Response, DomainError> {
    require_capability_middleware("billing.close_cash.write", req, next).await
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
        assert!(role_has_capability("admin", "users.delete"));
        assert!(role_has_capability("admin", "saas.hotels.write"));
        assert!(!role_has_capability("admin", "unknown.capability"));
    }

    #[test]
    fn saas_admin_has_only_hotel_network_capabilities() {
        assert!(role_has_capability("saas_admin", "saas.hotels.read"));
        assert!(role_has_capability("saas_admin", "saas.hotels.write"));
        assert!(!role_has_capability("saas_admin", "users.read"));
        assert!(!role_has_capability("saas_admin", "bookings.write"));
    }

    #[test]
    fn ops_has_only_operational_read_capabilities() {
        assert!(role_has_capability("ops", "analytics.kpis.read"));
        assert!(role_has_capability("ops", "bookings.write"));
        assert!(role_has_capability("ops", "billing.invoices.read"));
        assert!(!role_has_capability("ops", "users.write"));
    }

    #[test]
    fn receptionist_and_housekeeping_have_scoped_permissions() {
        assert!(role_has_capability("receptionist", "bookings.write"));
        assert!(!role_has_capability("receptionist", "users.read"));
        assert!(role_has_capability("housekeeping", "housekeeping.write"));
        assert!(!role_has_capability("housekeeping", "bookings.read"));
    }

    #[test]
    fn unknown_role_is_restricted() {
        assert!(!role_has_capability("guest", "reports.revenue.read"));
    }
}
