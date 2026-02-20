use super::*;

#[utoipa::path(
    get,
    path = "/api/v1/rooms",
    responses(
        (status = 200, description = "Lista de todas las habitaciones", body = [Room])
    ),
    tag = "Hotelería"
)]
pub async fn get_rooms_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let rooms: Vec<crate::domain::models::Room> =
        operations.room_service.list_rooms(hotel_id).await?;
    Ok(Json(json!(rooms)))
}

#[utoipa::path(
    get,
    path = "/api/v1/rooms/{id}",
    params(
        ("id" = Uuid, Path, description = "ID de la habitación")
    ),
    responses(
        (status = 200, description = "Habitación encontrada", body = Room),
        (status = 404, description = "Habitación no encontrada")
    ),
    tag = "Hotelería"
)]
pub async fn get_room_by_id_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let room = operations.room_service.get_room_by_id(hotel_id, id).await?;
    Ok(Json(json!(room)))
}

#[utoipa::path(
    post,
    path = "/api/v1/rooms",
    request_body = CreateRoomRequest,
    responses(
        (status = 201, description = "Habitación creada exitosamente", body = Room),
        (status = 409, description = "Ya existe una habitación con ese número"),
        (status = 401, description = "No autorizado"),
        (status = 403, description = "Prohibido (Solo Admin)")
    ),
    tag = "Hotelería",
    security(
        ("jwt" = [])
    )
)]
pub async fn create_room_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(payload): Json<CreateRoomRequest>,
) -> Result<(StatusCode, Json<Value>), DomainError> {
    let operations = state.operations_context();
    let ip = addr.ip().to_string();
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    validate_non_empty_trimmed("room_number", &payload.room_number)?;
    validate_len_range("room_number", &payload.room_number, 1, 10)?;
    validate_non_empty_trimmed("room_type", &payload.room_type)?;
    validate_len_range("room_type", &payload.room_type, 1, 50)?;
    validate_positive_amount("price_cents", payload.price_cents)?;

    let room = operations
        .room_service
        .create_room(
            hotel_id,
            payload.room_number,
            payload.room_type,
            payload.price_cents,
        )
        .await?;

    state
        .audit_service
        .record(
            Some(hotel_id),
            Some(user_id),
            &format!("room.created: {}", room.room_number),
            Some(ip),
        )
        .await;

    Ok((StatusCode::CREATED, Json(json!(room))))
}

#[utoipa::path(
    patch,
    path = "/api/v1/rooms/{room_id}/status",
    request_body = UpdateRoomStatusRequest,
    params(
        ("room_id" = Uuid, Path, description = "ID de la habitación")
    ),
    responses(
        (status = 200, description = "Estado actualizado exitosamente"),
        (status = 404, description = "Habitación no encontrada")
    ),
    tag = "Hotelería"
)]
pub async fn update_room_status_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(room_id): Path<Uuid>,
    Json(payload): Json<UpdateRoomStatusRequest>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let status = match payload.status.to_uppercase().as_str() {
        "AVAILABLE" => crate::domain::models::RoomStatus::Available,
        "OCCUPIED" => crate::domain::models::RoomStatus::Occupied,
        "DIRTY" => crate::domain::models::RoomStatus::Dirty,
        "MAINTENANCE" => crate::domain::models::RoomStatus::Maintenance,
        _ => {
            return Err(DomainError::InvalidInput(
                "Estado de habitación inválido".to_string(),
            ))
        }
    };

    operations
        .room_service
        .update_room_status(hotel_id, room_id, status)
        .await?;
    Ok(Json(json!({ "status": "ok" })))
}

pub async fn search_rooms_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Query(params): Query<SearchParams>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let rooms: Vec<crate::domain::models::Room> = operations
        .room_service
        .find_available_rooms(hotel_id, params.start, params.end)
        .await?;
    Ok(Json(json!(rooms)))
}
