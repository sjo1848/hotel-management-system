use super::*;

pub async fn health_check() -> Json<Value> {
    Json(json!({ "status": "operational" }))
}

pub async fn readiness_check(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    let dummy_hotel = Uuid::nil(); // Solo para verificar conexión
    let _: Vec<crate::domain::models::Room> = state.room_service.list_rooms(dummy_hotel).await?;
    Ok(Json(json!({ "status": "ready" })))
}

pub async fn root_handler() -> Json<Value> {
    Json(json!({ "message": "HMS Elite Backend (Hexagonal) activo" }))
}

#[utoipa::path(
    post,
    path = "/api/v1/telemetry/ui",
    request_body = UiTelemetryEventRequest,
    responses(
        (status = 200, description = "Evento de telemetría UI aceptado"),
        (status = 400, description = "Evento inválido")
    ),
    tag = "Análisis"
)]
pub async fn track_ui_telemetry_handler(
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Json(payload): Json<UiTelemetryEventRequest>,
) -> Result<Json<Value>, DomainError> {
    const ALLOWED_EVENTS: &[&str] = &[
        "dashboard_load_failed",
        "dashboard_retry_clicked",
        "close_cash_success",
        "close_cash_failure",
        "revenue_cockpit_viewed",
        "revenue_cockpit_cta_clicked",
        "automation_alert_clicked",
        "network_kpis_viewed",
        "network_plan_upgrade_submitted",
        "network_plan_upgrade_succeeded",
        "network_plan_upgrade_failed",
    ];

    if !ALLOWED_EVENTS.contains(&payload.event.as_str()) {
        return Err(DomainError::InvalidInput(format!(
            "Evento de telemetría UI inválido: {}",
            payload.event
        )));
    }

    counter!(
        "ui_telemetry_events_total",
        "event" => payload.event.clone()
    )
    .increment(1);

    tracing::info!(
        event = %payload.event,
        hotel_id = %claims.hotel_id,
        has_payload = payload.payload.is_some(),
        has_timestamp = payload.timestamp.is_some(),
        "ui telemetry event ingested"
    );

    Ok(Json(json!({ "status": "ok" })))
}

#[utoipa::path(
    get,
    path = "/api/v1/analytics/kpis",
    responses(
        (status = 200, description = "KPIs del dashboard", body = DashboardKpis)
    ),
    tag = "Análisis",
    security(
        ("jwt" = [])
    )
)]
pub async fn get_dashboard_kpis_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let kpis = state
        .reporting_service
        .get_dashboard_summary(hotel_id)
        .await?;
    Ok(Json(json!(kpis)))
}

#[utoipa::path(
    get,
    path = "/api/v1/audit/events",
    responses(
        (status = 200, description = "Eventos de auditoría recientes del tenant", body = [crate::domain::models::AuditEvent])
    ),
    params(
        ("limit" = Option<usize>, Query, description = "Máximo de eventos (1-200, por defecto 50)")
    ),
    tag = "Análisis",
    security(
        ("jwt" = [])
    )
)]
pub async fn get_audit_events_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Query(params): Query<AuditQueryParams>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let limit = params.limit.unwrap_or(50).clamp(1, 200) as i64;
    let events = state.audit_service.list_recent(hotel_id, limit).await?;
    Ok(Json(json!(events)))
}

#[utoipa::path(
    get,
    path = "/api/v1/reports/revenue",
    responses(
        (status = 200, description = "Reporte de ingresos por día", body = [RevenueReport])
    ),
    params(
        ("start" = Option<NaiveDate>, Query, description = "Fecha de inicio (YYYY-MM-DD)"),
        ("end" = Option<NaiveDate>, Query, description = "Fecha de fin (YYYY-MM-DD)")
    ),
    tag = "Análisis"
)]
pub async fn get_revenue_report_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Query(params): Query<DateRangeParams>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let start = params
        .start
        .unwrap_or_else(|| chrono::Utc::now().naive_utc().date() - chrono::Duration::days(30));
    let end = params
        .end
        .unwrap_or_else(|| chrono::Utc::now().naive_utc().date());
    validate_date_range(start, end)?;

    let report = state
        .reporting_service
        .get_revenue_report(hotel_id, start, end)
        .await?;

    Ok(Json(json!(report)))
}

#[utoipa::path(
    get,
    path = "/api/v1/reports/occupancy",
    responses(
        (status = 200, description = "Reporte de ocupación por día", body = [OccupancyReport])
    ),
    params(
        ("start" = Option<NaiveDate>, Query, description = "Fecha de inicio (YYYY-MM-DD)"),
        ("end" = Option<NaiveDate>, Query, description = "Fecha de fin (YYYY-MM-DD)")
    ),
    tag = "Análisis"
)]
pub async fn get_occupancy_report_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Query(params): Query<DateRangeParams>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let start = params
        .start
        .unwrap_or_else(|| chrono::Utc::now().naive_utc().date() - chrono::Duration::days(30));
    let end = params
        .end
        .unwrap_or_else(|| chrono::Utc::now().naive_utc().date());
    validate_date_range(start, end)?;

    let report = state
        .reporting_service
        .get_occupancy_report(hotel_id, start, end)
        .await?;

    Ok(Json(json!(report)))
}
