use crate::app_state::AppState;
use crate::domain::errors::DomainError;
use crate::infrastructure::web::utils::{csrf_valid, requires_csrf};
use axum::{
    extract::ConnectInfo,
    extract::{Request, State},
    http::HeaderMap,
    middleware::Next,
    response::Response,
};
use std::{
    net::{IpAddr, SocketAddr},
    sync::Arc,
};
use tracing::Span;

pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Result<Response, DomainError> {
    let path = req.uri().path();
    if path == "/metrics" {
        let allowed = state.config.metrics_public
            || can_access_metrics(&req, state.config.metrics_auth_token.as_deref());
        if allowed {
            return Ok(next.run(req).await);
        }
        return Err(DomainError::Forbidden);
    }

    if !state.config.auth_required {
        return Ok(next.run(req).await);
    }

    let is_public_path = path == "/health"
        || path == "/ready"
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

    let span = Span::current();
    span.record("tenant_id", claims.hotel_id.as_str());
    span.record("user_id", claims.sub.as_str());
    span.record("role", claims.role.as_str());

    // Role check is now handled by RBAC middleware

    let mut req = req;
    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}

fn can_access_metrics(req: &Request, expected_token: Option<&str>) -> bool {
    metrics_token_matches(req.headers(), expected_token) || request_from_private_or_loopback(req)
}

fn metrics_token_matches(headers: &HeaderMap, expected_token: Option<&str>) -> bool {
    let Some(expected_token) = expected_token else {
        return false;
    };
    headers
        .get("x-metrics-auth")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.trim() == expected_token)
        .unwrap_or(false)
}

fn request_from_private_or_loopback(req: &Request) -> bool {
    request_ip(req)
        .map(is_private_or_loopback_ip)
        .unwrap_or(false)
}

fn request_ip(req: &Request) -> Option<IpAddr> {
    if let Some(connect_info) = req.extensions().get::<ConnectInfo<SocketAddr>>() {
        return Some(connect_info.0.ip());
    }
    req.extensions().get::<SocketAddr>().map(SocketAddr::ip)
}

fn is_private_or_loopback_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ipv4) => ipv4.is_loopback() || ipv4.is_private() || ipv4.is_link_local(),
        IpAddr::V6(ipv6) => {
            ipv6.is_loopback()
                || ipv6.is_unicast_link_local()
                || ((ipv6.segments()[0] & 0xfe00) == 0xfc00)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{can_access_metrics, is_private_or_loopback_ip};
    use axum::{body::Body, extract::ConnectInfo, http::Request};
    use std::net::{IpAddr, Ipv4Addr, SocketAddr};

    fn request_with_peer(ip: IpAddr) -> Request<Body> {
        let mut request = Request::builder()
            .uri("/metrics")
            .body(Body::empty())
            .expect("request");
        request
            .extensions_mut()
            .insert(ConnectInfo(SocketAddr::new(ip, 12345)));
        request
    }

    #[test]
    fn private_or_loopback_ip_detection_is_strict() {
        assert!(is_private_or_loopback_ip(IpAddr::V4(Ipv4Addr::new(
            127, 0, 0, 1
        ))));
        assert!(is_private_or_loopback_ip(IpAddr::V4(Ipv4Addr::new(
            10, 1, 2, 3
        ))));
        assert!(!is_private_or_loopback_ip(IpAddr::V4(Ipv4Addr::new(
            8, 8, 8, 8
        ))));
    }

    #[test]
    fn metrics_access_allows_private_network_without_token() {
        let request = request_with_peer(IpAddr::V4(Ipv4Addr::new(10, 10, 0, 7)));
        assert!(can_access_metrics(&request, None));
    }

    #[test]
    fn metrics_access_allows_proxy_token_for_public_ip() {
        let mut request = request_with_peer(IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8)));
        request.headers_mut().insert(
            "x-metrics-auth",
            "proxy-secret".parse().expect("header value"),
        );
        assert!(can_access_metrics(&request, Some("proxy-secret")));
    }

    #[test]
    fn metrics_access_denies_public_ip_without_valid_token() {
        let request = request_with_peer(IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8)));
        assert!(!can_access_metrics(&request, None));
        assert!(!can_access_metrics(&request, Some("proxy-secret")));
    }
}
