use axum::body::{to_bytes, Body};
use axum::extract::ConnectInfo;
use axum::http::{header, Method, Request, StatusCode};
use hms_backend::bootstrap::build_app_state;
use hms_backend::config::AppConfig;
use hms_backend::infrastructure::web::routes::create_router;
use serde_json::Value;
use std::net::SocketAddr;
use tower::ServiceExt;

async fn body_json(response: axum::response::Response) -> Value {
    let status = response.status();
    let bytes = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body");
    serde_json::from_slice::<Value>(&bytes).unwrap_or_else(|error| {
        panic!(
            "json body parse failed (status={} body='{}'): {}",
            status,
            String::from_utf8_lossy(&bytes),
            error
        )
    })
}

#[sqlx::test]
async fn observability_error_contract_includes_request_context(pool: sqlx::PgPool) {
    let config = AppConfig::from_env();
    let app = create_router(build_app_state(pool, config).await);

    let unauthorized = app
        .clone()
        .oneshot({
            let mut request = Request::builder()
                .method(Method::GET)
                .uri("/api/v1/auth/me")
                .body(Body::empty())
                .expect("request");
            request
                .extensions_mut()
                .insert(ConnectInfo(SocketAddr::from(([127, 0, 0, 1], 14001))));
            request
        })
        .await
        .expect("response");
    assert!(
        unauthorized.status() != StatusCode::OK,
        "auth-me without credentials must not return 200"
    );
    let unauthorized_request_id = unauthorized
        .headers()
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    assert!(
        !unauthorized_request_id.is_empty(),
        "x-request-id header must be present"
    );
    let unauthorized_payload = body_json(unauthorized).await;
    assert!(
        unauthorized_payload
            .get("error_code")
            .and_then(Value::as_str)
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false),
        "error payload must contain a non-empty error_code"
    );
    assert_eq!(
        unauthorized_payload
            .get("request_id")
            .and_then(Value::as_str)
            .unwrap_or(""),
        unauthorized_request_id
    );

    let invalid_login = app
        .oneshot({
            let mut request = Request::builder()
                .method(Method::POST)
                .uri("/api/v1/auth/login")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    r#"{"hotel_id":"", "username":"x", "password":"short"}"#,
                ))
                .expect("request");
            request
                .extensions_mut()
                .insert(ConnectInfo(SocketAddr::from(([127, 0, 0, 1], 14002))));
            request
        })
        .await
        .expect("response");
    assert!(
        invalid_login.status() != StatusCode::OK,
        "invalid login payload must not return 200"
    );
    let invalid_login_request_id = invalid_login
        .headers()
        .get("x-request-id")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    assert!(
        !invalid_login_request_id.is_empty(),
        "x-request-id header must be present in login validation errors"
    );
    let invalid_login_payload = body_json(invalid_login).await;
    assert!(
        invalid_login_payload
            .get("error_code")
            .and_then(Value::as_str)
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false),
        "login error payload must contain a non-empty error_code"
    );
    assert_eq!(
        invalid_login_payload
            .get("request_id")
            .and_then(Value::as_str)
            .unwrap_or(""),
        invalid_login_request_id
    );
}
