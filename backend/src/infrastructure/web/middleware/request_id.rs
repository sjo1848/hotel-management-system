use crate::domain::errors::DomainError;
use crate::infrastructure::web::handlers::REQUEST_ID;
use axum::{extract::Request, http::HeaderValue, middleware::Next, response::Response};
use tracing::{info_span, Instrument};
use uuid::Uuid;

pub async fn request_id_middleware(req: Request, next: Next) -> Result<Response, DomainError> {
    let request_id = Uuid::new_v4().to_string();

    // Creamos un span de tracing que envuelve toda la petición e incluye el request_id
    let span = info_span!("http_request", %request_id);

    let mut response = REQUEST_ID
        .scope(request_id.clone(), async {
            next.run(req).instrument(span).await
        })
        .await;

    if let Ok(value) = HeaderValue::from_str(&request_id) {
        response.headers_mut().insert("x-request-id", value);
    }
    Ok(response)
}
