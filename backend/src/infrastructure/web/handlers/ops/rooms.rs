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
    path = "/api/v1/rooms/{room_id}",
    params(
        ("room_id" = Uuid, Path, description = "ID de la habitación")
    ),
    responses(
        (status = 200, description = "Habitación encontrada", body = Room),
        (status = 401, description = "No autorizado"),
        (status = 403, description = "Prohibido"),
        (status = 404, description = "Habitación no encontrada")
    ),
    tag = "Hotelería",
    security(
        ("jwt" = [])
    )
)]
pub async fn get_room_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let room = operations.room_service.get_room(hotel_id, room_id).await?;
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
    path = "/api/v1/rooms/{room_id}",
    request_body = UpdateRoomRequest,
    params(
        ("room_id" = Uuid, Path, description = "ID de la habitación")
    ),
    responses(
        (status = 200, description = "Habitación actualizada exitosamente", body = Room),
        (status = 400, description = "Payload inválido"),
        (status = 401, description = "No autorizado"),
        (status = 403, description = "Prohibido"),
        (status = 404, description = "Habitación no encontrada"),
        (status = 409, description = "Ya existe una habitación con ese número")
    ),
    tag = "Hotelería",
    security(
        ("jwt" = [])
    )
)]
pub async fn update_room_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path(room_id): Path<Uuid>,
    Json(payload): Json<UpdateRoomRequest>,
) -> Result<Json<Value>, DomainError> {
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
        .update_room(
            hotel_id,
            room_id,
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
            &format!("room.updated: {}", room.room_number),
            Some(ip),
        )
        .await;

    Ok(Json(json!(room)))
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
    let status = parse_room_status_input(&payload.status)?;

    operations
        .room_service
        .update_room_status(hotel_id, room_id, status)
        .await?;
    Ok(Json(json!({ "status": "ok" })))
}

#[utoipa::path(
    post,
    path = "/api/v1/rooms/bulk-status",
    request_body = BulkUpdateRoomStatusRequest,
    responses(
        (status = 200, description = "Estados masivos actualizados", body = crate::domain::models::BulkRoomStatusUpdateResult),
        (status = 400, description = "Payload inválido"),
        (status = 401, description = "No autorizado"),
        (status = 404, description = "Habitación no encontrada")
    ),
    tag = "Hotelería",
    security(
        ("jwt" = [])
    )
)]
pub async fn bulk_update_room_status_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Json(payload): Json<BulkUpdateRoomStatusRequest>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let ip = addr.ip().to_string();
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let status = parse_room_status_input(&payload.status)?;

    let result = operations
        .room_service
        .update_room_status_bulk(hotel_id, payload.room_ids, status)
        .await?;

    state
        .audit_service
        .record(
            Some(hotel_id),
            Some(user_id),
            &format!(
                "room.bulk_status.updated: {} {:?}",
                result.updated_count, result.status
            ),
            Some(ip),
        )
        .await;

    Ok(Json(json!(result)))
}

#[utoipa::path(
    get,
    path = "/api/v1/rooms/holds/board",
    params(
        ("start" = Option<NaiveDate>, Query, description = "Fecha inicial del tablero"),
        ("end" = Option<NaiveDate>, Query, description = "Fecha final del tablero")
    ),
    responses(
        (status = 200, description = "Bloqueos de habitaciones para el rango consultado", body = [crate::domain::models::RoomHoldBoardEntry]),
        (status = 400, description = "Rango inválido"),
        (status = 401, description = "No autorizado")
    ),
    tag = "Hotelería",
    security(
        ("jwt" = [])
    )
)]
pub async fn list_room_holds_board_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Query(params): Query<DateRangeParams>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let start_date = params
        .start
        .unwrap_or_else(|| chrono::Utc::now().date_naive());
    let end_date = params
        .end
        .unwrap_or_else(|| start_date + chrono::Duration::days(30));
    validate_date_range(start_date, end_date)?;

    let board = operations
        .room_hold_service
        .list_hold_board(hotel_id, start_date, end_date)
        .await?;
    Ok(Json(json!(board)))
}

#[utoipa::path(
    get,
    path = "/api/v1/rooms/{room_id}/holds",
    params(
        ("room_id" = Uuid, Path, description = "ID de la habitación")
    ),
    responses(
        (status = 200, description = "Bloqueos vigentes e históricos de la habitación", body = [crate::domain::models::RoomHold]),
        (status = 401, description = "No autorizado"),
        (status = 404, description = "Habitación no encontrada")
    ),
    tag = "Hotelería",
    security(
        ("jwt" = [])
    )
)]
pub async fn list_room_holds_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let holds = operations
        .room_hold_service
        .list_holds(hotel_id, room_id)
        .await?;
    Ok(Json(json!(holds)))
}

#[utoipa::path(
    post,
    path = "/api/v1/rooms/{room_id}/holds",
    request_body = CreateRoomHoldRequest,
    params(
        ("room_id" = Uuid, Path, description = "ID de la habitación")
    ),
    responses(
        (status = 201, description = "Bloqueo creado", body = crate::domain::models::RoomHold),
        (status = 400, description = "Payload inválido"),
        (status = 401, description = "No autorizado"),
        (status = 404, description = "Habitación no encontrada"),
        (status = 409, description = "Rango ocupado o bloqueado")
    ),
    tag = "Hotelería",
    security(
        ("jwt" = [])
    )
)]
pub async fn create_room_hold_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path(room_id): Path<Uuid>,
    Json(payload): Json<CreateRoomHoldRequest>,
) -> Result<(StatusCode, Json<Value>), DomainError> {
    let operations = state.operations_context();
    let ip = addr.ip().to_string();
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    validate_non_empty_trimmed("reason", &payload.reason)?;
    validate_len_range("reason", &payload.reason, 4, 250)?;
    validate_booking_dates(payload.start_date, payload.end_date)?;
    let hold_type = parse_room_hold_type_input(&payload.hold_type)?;

    let hold = operations
        .room_hold_service
        .create_hold(
            hotel_id,
            room_id,
            payload.start_date,
            payload.end_date,
            hold_type,
            payload.reason,
            Some(user_id),
        )
        .await?;

    state
        .audit_service
        .record(
            Some(hotel_id),
            Some(user_id),
            &format!(
                "room.hold.created: {} {} {} {:?}",
                hold.room_id, hold.start_date, hold.end_date, hold.hold_type
            ),
            Some(ip),
        )
        .await;

    Ok((StatusCode::CREATED, Json(json!(hold))))
}

fn parse_room_hold_type_input(
    value: &str,
) -> Result<crate::domain::models::RoomHoldType, DomainError> {
    match value.trim().to_uppercase().as_str() {
        "VIP" => Ok(crate::domain::models::RoomHoldType::Vip),
        "MAINTENANCE" => Ok(crate::domain::models::RoomHoldType::Maintenance),
        "OWNER" => Ok(crate::domain::models::RoomHoldType::Owner),
        "COMPLIANCE" => Ok(crate::domain::models::RoomHoldType::Compliance),
        "COMMERCIAL" => Ok(crate::domain::models::RoomHoldType::Commercial),
        "OTHER" => Ok(crate::domain::models::RoomHoldType::Other),
        _ => Err(DomainError::InvalidInput(
            "Tipo de bloqueo inválido".to_string(),
        )),
    }
}

fn parse_room_status_input(value: &str) -> Result<crate::domain::models::RoomStatus, DomainError> {
    match value.trim().to_uppercase().as_str() {
        "AVAILABLE" => Ok(crate::domain::models::RoomStatus::Available),
        "OCCUPIED" => Ok(crate::domain::models::RoomStatus::Occupied),
        "DIRTY" => Ok(crate::domain::models::RoomStatus::Dirty),
        "CLEANING" => Ok(crate::domain::models::RoomStatus::Cleaning),
        "MAINTENANCE" => Ok(crate::domain::models::RoomStatus::Maintenance),
        _ => Err(DomainError::InvalidInput(
            "Estado de habitación inválido".to_string(),
        )),
    }
}

#[utoipa::path(
    delete,
    path = "/api/v1/rooms/{room_id}/holds/{hold_id}",
    params(
        ("room_id" = Uuid, Path, description = "ID de la habitación"),
        ("hold_id" = Uuid, Path, description = "ID del bloqueo")
    ),
    responses(
        (status = 200, description = "Bloqueo eliminado"),
        (status = 401, description = "No autorizado"),
        (status = 404, description = "Bloqueo no encontrado")
    ),
    tag = "Hotelería",
    security(
        ("jwt" = [])
    )
)]
pub async fn delete_room_hold_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path((room_id, hold_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let ip = addr.ip().to_string();
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;

    operations
        .room_hold_service
        .delete_hold(hotel_id, room_id, hold_id)
        .await?;

    state
        .audit_service
        .record(
            Some(hotel_id),
            Some(user_id),
            &format!("room.hold.deleted: {} {}", room_id, hold_id),
            Some(ip),
        )
        .await;

    Ok(Json(json!({ "status": "ok" })))
}

#[utoipa::path(
    patch,
    path = "/api/v1/rooms/{room_id}/holds/{hold_id}",
    request_body = CreateRoomHoldRequest,
    params(
        ("room_id" = Uuid, Path, description = "ID de la habitación"),
        ("hold_id" = Uuid, Path, description = "ID del bloqueo")
    ),
    responses(
        (status = 200, description = "Bloqueo actualizado", body = crate::domain::models::RoomHold),
        (status = 400, description = "Payload inválido"),
        (status = 401, description = "No autorizado"),
        (status = 404, description = "Bloqueo no encontrado")
    ),
    tag = "Hotelería",
    security(
        ("jwt" = [])
    )
)]
pub async fn update_room_hold_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path((room_id, hold_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<CreateRoomHoldRequest>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let ip = addr.ip().to_string();
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    validate_non_empty_trimmed("reason", &payload.reason)?;
    validate_len_range("reason", &payload.reason, 4, 250)?;
    validate_booking_dates(payload.start_date, payload.end_date)?;
    let hold_type = parse_room_hold_type_input(&payload.hold_type)?;

    let hold = operations
        .room_hold_service
        .update_hold(
            hotel_id,
            room_id,
            hold_id,
            payload.start_date,
            payload.end_date,
            hold_type,
            payload.reason,
            Some(user_id),
        )
        .await?;

    state
        .audit_service
        .record(
            Some(hotel_id),
            Some(user_id),
            &format!(
                "room.hold.updated: {} {} {} {:?}",
                hold.room_id, hold.start_date, hold.end_date, hold.hold_type
            ),
            Some(ip),
        )
        .await;

    Ok(Json(json!(hold)))
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
