use super::*;

#[utoipa::path(
    get,
    path = "/api/v1/housekeeping/dirty",
    responses(
        (status = 200, description = "Lista de habitaciones que requieren limpieza", body = [Room])
    ),
    tag = "Housekeeping"
)]
pub async fn list_dirty_rooms_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let rooms = operations
        .housekeeping_service
        .list_dirty_rooms(hotel_id)
        .await?;
    Ok(Json(json!(rooms)))
}

#[utoipa::path(
    post,
    path = "/api/v1/housekeeping/{room_id}/start",
    responses(
        (status = 200, description = "Limpieza iniciada")
    ),
    params(
        ("room_id" = Uuid, Path, description = "ID de la habitación")
    ),
    tag = "Housekeeping"
)]
pub async fn start_cleaning_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    operations
        .housekeeping_service
        .start_cleaning(hotel_id, room_id)
        .await?;
    Ok(Json(json!({ "status": "ok" })))
}

#[utoipa::path(
    post,
    path = "/api/v1/housekeeping/{room_id}/finish",
    responses(
        (status = 200, description = "Limpieza finalizada e habitación disponible")
    ),
    params(
        ("room_id" = Uuid, Path, description = "ID de la habitación")
    ),
    tag = "Housekeeping"
)]
pub async fn finish_cleaning_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    operations
        .housekeeping_service
        .finish_cleaning(hotel_id, room_id)
        .await?;
    Ok(Json(json!({ "status": "ok" })))
}
