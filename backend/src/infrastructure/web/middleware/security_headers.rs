use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use axum::http::header;
use std::sync::Arc;
use crate::app_state::AppState;

pub async fn security_headers_middleware(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Response {
    let is_swagger = req.uri().path().starts_with("/swagger-ui") || req.uri().path().starts_with("/api-docs");
    let mut response = next.run(req).await;
    let headers = response.headers_mut();

    // Cabeceras base
    headers.insert(header::X_CONTENT_TYPE_OPTIONS, "nosniff".parse().unwrap());
    headers.insert(header::X_FRAME_OPTIONS, "DENY".parse().unwrap());
    headers.insert(header::REFERRER_POLICY, "strict-origin-when-cross-origin".parse().unwrap());
    
    // HSTS: Solo si cookie_secure está activo (Producción/HTTPS)
    if state.config.cookie_secure {
        headers.insert(
            header::STRICT_TRANSPORT_SECURITY,
            "max-age=31536000; includeSubDomains; preload".parse().unwrap()
        );
    }

    // CSP: Un poco más permisiva para Swagger, estricta para el resto
    let csp = if is_swagger {
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none';"
    } else {
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none';"
    };
    
    headers.insert(header::CONTENT_SECURITY_POLICY, csp.parse().unwrap());

    response
}
