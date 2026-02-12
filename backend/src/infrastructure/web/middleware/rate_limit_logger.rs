use axum::{
    extract::{Request, ConnectInfo},
    middleware::Next,
    response::Response,
    http::StatusCode,
};
use std::net::SocketAddr;

pub async fn rate_limit_logger_middleware(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    req: Request,
    next: Next,
) -> Response {
    let method = req.method().clone();
    let path = req.uri().path().to_string();
    let ip = addr.ip().to_string();

    let response = next.run(req).await;

    if response.status() == StatusCode::TOO_MANY_REQUESTS {
        tracing::warn!(
            ip = %ip,
            method = %method,
            path = %path,
            "Rate limit excedido (Posible ataque de fuerza bruta o escaneo)"
        );
    }

    response
}
