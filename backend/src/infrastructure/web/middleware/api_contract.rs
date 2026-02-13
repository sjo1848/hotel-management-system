use axum::{
    extract::Request,
    http::{HeaderName, HeaderValue},
    middleware::Next,
    response::Response,
};

pub async fn api_contract_headers_middleware(req: Request, next: Next) -> Response {
    let mut response = next.run(req).await;

    response.headers_mut().insert(
        HeaderName::from_static("x-api-version"),
        HeaderValue::from_static("v1"),
    );
    response.headers_mut().insert(
        HeaderName::from_static("x-api-deprecation-policy"),
        HeaderValue::from_static("backward-compatible-within-v1"),
    );

    response
}
