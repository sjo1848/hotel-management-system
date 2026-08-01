use super::*;
use chrono::NaiveDate;
use serde::Deserialize;
use utoipa::IntoParams;

#[derive(Debug, Deserialize, IntoParams)]
pub struct HousekeepingBoardParams {
    pub date: Option<NaiveDate>,
}

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
    get,
    path = "/api/v1/housekeeping/board",
    params(HousekeepingBoardParams),
    responses(
        (status = 200, description = "Tablero operativo de housekeeping", body = HousekeepingBoard)
    ),
    tag = "Housekeeping"
)]
pub async fn housekeeping_board_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Query(params): Query<HousekeepingBoardParams>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let date = params
        .date
        .unwrap_or_else(|| chrono::Utc::now().date_naive());
    let board = operations
        .housekeeping_service
        .get_board(hotel_id, date)
        .await?;
    Ok(Json(json!(board)))
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

#[utoipa::path(
    post,
    path = "/api/v1/housekeeping/{room_id}/maintenance",
    params(
        ("room_id" = Uuid, Path, description = "ID de la habitación")
    ),
    responses(
        (status = 200, description = "Caso de mantenimiento abierto", body = crate::domain::models::MaintenanceCase)
    ),
    tag = "Housekeeping"
)]
pub async fn mark_maintenance_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(room_id): Path<Uuid>,
    payload: Option<Json<MarkMaintenanceRequest>>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let actor_user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    let payload = payload.map(|Json(value)| value).unwrap_or_default();
    let priority = parse_maintenance_priority(payload.priority.as_deref())?;
    let maintenance_case = operations
        .housekeeping_service
        .mark_maintenance(
            hotel_id,
            room_id,
            actor_user_id,
            priority,
            payload
                .reason
                .unwrap_or_else(|| "Incidencia reportada desde housekeeping".to_string()),
            payload.assigned_to.unwrap_or_else(|| "ops".to_string()),
        )
        .await?;
    Ok(Json(json!(maintenance_case)))
}

#[utoipa::path(
    post,
    path = "/api/v1/housekeeping/{room_id}/dirty",
    params(
        ("room_id" = Uuid, Path, description = "ID de la habitación")
    ),
    responses(
        (status = 200, description = "Caso resuelto y habitación devuelta a Dirty", body = crate::domain::models::MaintenanceCase)
    ),
    tag = "Housekeeping"
)]
pub async fn return_room_to_dirty_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(room_id): Path<Uuid>,
    payload: Option<Json<ResolveMaintenanceRequest>>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let actor_user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    let payload = payload.map(|Json(value)| value).unwrap_or_default();
    let maintenance_case = operations
        .housekeeping_service
        .return_to_dirty(
            hotel_id,
            room_id,
            actor_user_id,
            payload
                .resolution_note
                .unwrap_or_else(|| "Resolucion registrada desde housekeeping".to_string()),
        )
        .await?;
    Ok(Json(json!(maintenance_case)))
}

fn parse_maintenance_priority(
    value: Option<&str>,
) -> Result<crate::domain::models::MaintenancePriority, DomainError> {
    match value
        .unwrap_or("MEDIUM")
        .trim()
        .to_ascii_uppercase()
        .as_str()
    {
        "LOW" => Ok(crate::domain::models::MaintenancePriority::Low),
        "MEDIUM" => Ok(crate::domain::models::MaintenancePriority::Medium),
        "HIGH" => Ok(crate::domain::models::MaintenancePriority::High),
        "URGENT" => Ok(crate::domain::models::MaintenancePriority::Urgent),
        _ => Err(DomainError::InvalidInput(
            "La prioridad de mantenimiento es invalida".to_string(),
        )),
    }
}
