use axum::{
    http::HeaderValue,
    middleware::Next,
    response::Response,
    extract::Request,
};
use uuid::Uuid;
use crate::domain::errors::DomainError;
use crate::infrastructure::web::handlers::REQUEST_ID;

pub async fn request_id_middleware(
    req: Request,
    next: Next,
) -> Result<Response, DomainError> {
    let request_id = Uuid::new_v4().to_string();
    let mut response = REQUEST_ID
        .scope(request_id.clone(), async { next.run(req).await })
        .await;
    if let Ok(value) = HeaderValue::from_str(&request_id) {
        response.headers_mut().insert("x-request-id", value);
    }
    Ok(response)
}
