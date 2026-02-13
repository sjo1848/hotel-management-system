use crate::app_state::AppState;
use axum::http::header;
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;

pub async fn security_headers_middleware(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Response {
    let path = req.uri().path().to_string();
    let mut response = next.run(req).await;
    let headers = response.headers_mut();

    // Cabeceras base
    headers.insert(header::X_CONTENT_TYPE_OPTIONS, "nosniff".parse().unwrap());
    headers.insert(header::X_FRAME_OPTIONS, "DENY".parse().unwrap());
    headers.insert(
        header::REFERRER_POLICY,
        "strict-origin-when-cross-origin".parse().unwrap(),
    );

    // HSTS: Solo si cookie_secure está activo (Producción/HTTPS)
    if state.config.cookie_secure {
        headers.insert(
            header::STRICT_TRANSPORT_SECURITY,
            "max-age=31536000; includeSubDomains; preload"
                .parse()
                .unwrap(),
        );
    }

    // CSP: Un poco más permisiva para Swagger, estricta para el resto
    let csp = content_security_policy_for_path(&path);

    headers.insert(header::CONTENT_SECURITY_POLICY, csp.parse().unwrap());

    response
}

fn is_swagger_path(path: &str) -> bool {
    path.starts_with("/swagger-ui") || path.starts_with("/api-docs")
}

fn content_security_policy_for_path(path: &str) -> &'static str {
    if is_swagger_path(path) {
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none';"
    } else {
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none';"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_swagger_path_detects_swagger_routes() {
        assert!(is_swagger_path("/swagger-ui"));
        assert!(is_swagger_path("/swagger-ui/index.html"));
        assert!(is_swagger_path("/api-docs/openapi.json"));
        assert!(!is_swagger_path("/api/v1/rooms"));
    }

    #[test]
    fn csp_for_swagger_allows_inline_script() {
        let csp = content_security_policy_for_path("/swagger-ui/index.html");
        assert!(csp.contains("script-src 'self' 'unsafe-inline'"));
        assert!(!csp.contains("frame-ancestors 'none'"));
    }

    #[test]
    fn csp_for_api_is_stricter() {
        let csp = content_security_policy_for_path("/api/v1/bookings");
        assert!(csp.contains("script-src 'self'"));
        assert!(!csp.contains("script-src 'self' 'unsafe-inline'"));
        assert!(csp.contains("frame-ancestors 'none'"));
    }
}
