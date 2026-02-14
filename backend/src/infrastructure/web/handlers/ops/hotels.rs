use super::*;

pub async fn list_hotels_handler(
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    let _ = claims;
    let hotels = state.hotel_service.list_hotels().await?;
    Ok(Json(json!(hotels)))
}

pub async fn create_hotel_handler(
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateHotelRequest>,
) -> Result<Json<Value>, DomainError> {
    let _ = claims;
    validate_non_empty_trimmed("name", &payload.name)?;
    validate_len_range("name", &payload.name, 2, 100)?;
    if let Some(address) = payload.address.as_deref() {
        validate_len_range("address", address, 2, 250)?;
    }
    let hotel = state
        .hotel_service
        .create_hotel(payload.name, payload.address)
        .await?;
    Ok(Json(json!(hotel)))
}
