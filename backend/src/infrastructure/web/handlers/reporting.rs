use super::*;

const DEFAULT_AUDIT_PAGE_LIMIT: usize = 50;
const MAX_AUDIT_PAGE_LIMIT: usize = 100;

pub async fn health_check() -> Json<Value> {
    Json(json!({ "status": "operational" }))
}

pub async fn readiness_check(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    // Readiness must validate DB connectivity without requiring tenant context.
    let _: Vec<crate::domain::models::Hotel> = state.hotel_service.list_hotels().await?;
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

pub async fn get_automation_insights_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let hotel = state.hotel_service.get_hotel(hotel_id).await?;
    let feature_flags = resolve_plan_feature_flags(hotel.plan_tier);

    let kpis = state
        .reporting_service
        .get_dashboard_summary(hotel_id)
        .await?;
    let room_backlog = state
        .housekeeping_service
        .list_dirty_rooms(hotel_id)
        .await?;

    let dirty_rooms_count = room_backlog
        .iter()
        .filter(|room| matches!(room.status, crate::domain::models::RoomStatus::Dirty))
        .count();
    let cleaning_rooms_count = room_backlog
        .iter()
        .filter(|room| matches!(room.status, crate::domain::models::RoomStatus::Cleaning))
        .count();
    let overdue_rooms_count = dirty_rooms_count.saturating_sub(5);

    let housekeeping_recommendation = if !feature_flags.housekeeping_sla_alerts {
        "Upgrade a plan PRO para alertas SLA de limpieza y priorización automática.".to_string()
    } else if overdue_rooms_count > 0 {
        "Hay backlog de limpieza por encima de umbral. Reasignar personal al bloque crítico."
            .to_string()
    } else {
        "SLA de limpieza bajo control para el turno actual.".to_string()
    };

    let (pricing_urgency, pricing_recommendation) = if !feature_flags.pricing_assistant {
        (
            "upgrade_required".to_string(),
            "Pricing assistant disponible desde plan PRO.".to_string(),
        )
    } else if kpis.occupancy_rate < 60.0 {
        (
            "high".to_string(),
            "Ocupación baja: activar promo 72h y revisar paridad de tarifas.".to_string(),
        )
    } else if kpis.rev_par_cents < 8_000 {
        (
            "medium".to_string(),
            "RevPAR bajo: ajustar mix de tarifa y upselling en reservas activas.".to_string(),
        )
    } else {
        (
            "low".to_string(),
            "Pricing en zona saludable. Mantener estrategia y monitorear tendencia semanal."
                .to_string(),
        )
    };

    let mut exception_notifications: Vec<AutomationNotification> = Vec::new();
    if feature_flags.exception_notifications {
        if overdue_rooms_count > 0 {
            exception_notifications.push(AutomationNotification {
                code: "HOUSEKEEPING_SLA_RISK".to_string(),
                severity: "high".to_string(),
                message: format!(
                    "Backlog de limpieza: {} habitaciones fuera de umbral.",
                    overdue_rooms_count
                ),
                action_route: "/housekeeping".to_string(),
            });
        }
        if kpis.occupancy_rate < 55.0 {
            exception_notifications.push(AutomationNotification {
                code: "LOW_OCCUPANCY_ALERT".to_string(),
                severity: "medium".to_string(),
                message: "Ocupación por debajo de 55%. Revisar estrategia comercial hoy."
                    .to_string(),
                action_route: "/reports".to_string(),
            });
        }
        if kpis.departures_today.len() > 8 {
            exception_notifications.push(AutomationNotification {
                code: "CHECKOUT_LOAD_SPIKE".to_string(),
                severity: "medium".to_string(),
                message: "Pico de check-outs hoy. Alinear checkout e invoice para evitar retrasos."
                    .to_string(),
                action_route: "/bookings".to_string(),
            });
        }
    } else {
        exception_notifications.push(AutomationNotification {
            code: "PLAN_UPGRADE_REQUIRED".to_string(),
            severity: "info".to_string(),
            message: "Notificaciones automáticas de excepción habilitadas desde plan PRO."
                .to_string(),
            action_route: "/network".to_string(),
        });
    }

    if exception_notifications.is_empty() {
        exception_notifications.push(AutomationNotification {
            code: "NO_EXCEPTIONS_DETECTED".to_string(),
            severity: "low".to_string(),
            message: "Sin excepciones críticas detectadas en este momento.".to_string(),
            action_route: "/".to_string(),
        });
    }

    let housekeeping_enabled = feature_flags.housekeeping_sla_alerts;
    let pricing_enabled = feature_flags.pricing_assistant;

    Ok(Json(json!(AutomationInsightsResponse {
        plan_tier: hotel.plan_tier,
        housekeeping_sla: HousekeepingSlaInsight {
            enabled: housekeeping_enabled,
            dirty_rooms_count,
            cleaning_rooms_count,
            overdue_rooms_count,
            recommendation: housekeeping_recommendation,
        },
        pricing_assistant: PricingAssistantInsight {
            enabled: pricing_enabled,
            occupancy_rate: kpis.occupancy_rate,
            adr_cents: kpis.adr_cents,
            rev_par_cents: kpis.rev_par_cents,
            urgency: pricing_urgency,
            recommendation: pricing_recommendation,
        },
        exception_notifications,
        feature_flags,
    })))
}

#[utoipa::path(
    get,
    path = "/api/v1/hotels/network/summary",
    responses(
        (status = 200, description = "Resumen consolidado de red multi-hotel", body = HotelNetworkSummaryResponse),
        (status = 400, description = "Rango de fechas inválido"),
        (status = 404, description = "Hotel no encontrado")
    ),
    params(
        ("start" = Option<NaiveDate>, Query, description = "Fecha de inicio (YYYY-MM-DD)"),
        ("end" = Option<NaiveDate>, Query, description = "Fecha de fin (YYYY-MM-DD)"),
        ("hotel_id" = Option<Uuid>, Query, description = "Filtrar por propiedad específica")
    ),
    tag = "Análisis",
    security(
        ("jwt" = [])
    )
)]
pub async fn get_hotel_network_summary_handler(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HotelNetworkSummaryParams>,
) -> Result<Json<Value>, DomainError> {
    let start = params
        .start
        .unwrap_or_else(|| chrono::Utc::now().naive_utc().date() - chrono::Duration::days(30));
    let end = params
        .end
        .unwrap_or_else(|| chrono::Utc::now().naive_utc().date());
    validate_date_range(start, end)?;

    let mut hotels = state.hotel_service.list_hotels().await?;
    if let Some(selected_hotel_id) = params.hotel_id {
        hotels.retain(|hotel| hotel.id == selected_hotel_id);
        if hotels.is_empty() {
            return Err(DomainError::HotelNotFound);
        }
    }

    let mut summaries: Vec<HotelNetworkHotelSummary> = Vec::with_capacity(hotels.len());
    for hotel in hotels {
        let dashboard = state
            .reporting_service
            .get_dashboard_summary(hotel.id)
            .await?;
        let revenue_rows = state
            .reporting_service
            .get_revenue_report(hotel.id, start, end)
            .await?;
        let occupancy_rows = state
            .reporting_service
            .get_occupancy_report(hotel.id, start, end)
            .await?;
        let bookings = state
            .booking_service
            .list_bookings_in_range(hotel.id, start, end)
            .await?;

        let revenue_cents = revenue_rows
            .iter()
            .map(|entry| entry.revenue_cents)
            .sum::<i64>();
        let bookings_count = bookings.len() as i64;
        let occupancy_rate = if occupancy_rows.is_empty() {
            0.0
        } else {
            occupancy_rows
                .iter()
                .map(|entry| entry.occupancy_rate)
                .sum::<f64>()
                / occupancy_rows.len() as f64
        };
        let adr_cents = if bookings_count > 0 {
            revenue_cents / bookings_count
        } else {
            0
        };
        let rev_par_cents = ((occupancy_rate * adr_cents as f64) / 100.0).round() as i64;

        summaries.push(HotelNetworkHotelSummary {
            hotel_id: hotel.id,
            hotel_name: hotel.name,
            hotel_address: hotel.address,
            plan_tier: hotel.plan_tier,
            revenue_cents,
            bookings_count,
            active_bookings_count: dashboard.active_bookings_count,
            today_check_ins: dashboard.today_check_ins,
            occupancy_rate,
            adr_cents,
            rev_par_cents,
        });
    }

    summaries.sort_by(|left, right| right.revenue_cents.cmp(&left.revenue_cents));

    let hotels_count = summaries.len() as i64;
    let totals = HotelNetworkTotals {
        hotels_count,
        revenue_cents: summaries.iter().map(|item| item.revenue_cents).sum::<i64>(),
        bookings_count: summaries
            .iter()
            .map(|item| item.bookings_count)
            .sum::<i64>(),
        active_bookings_count: summaries
            .iter()
            .map(|item| item.active_bookings_count)
            .sum::<i64>(),
        today_check_ins: summaries
            .iter()
            .map(|item| item.today_check_ins)
            .sum::<i64>(),
        avg_occupancy_rate: if hotels_count > 0 {
            summaries
                .iter()
                .map(|item| item.occupancy_rate)
                .sum::<f64>()
                / hotels_count as f64
        } else {
            0.0
        },
        avg_adr_cents: if hotels_count > 0 {
            summaries.iter().map(|item| item.adr_cents).sum::<i64>() / hotels_count
        } else {
            0
        },
        avg_rev_par_cents: if hotels_count > 0 {
            summaries.iter().map(|item| item.rev_par_cents).sum::<i64>() / hotels_count
        } else {
            0
        },
    };

    let benchmarks = HotelNetworkBenchmarks {
        top_revenue_hotel_id: summaries
            .iter()
            .max_by_key(|item| item.revenue_cents)
            .map(|item| item.hotel_id),
        top_occupancy_hotel_id: summaries
            .iter()
            .max_by(|left, right| left.occupancy_rate.total_cmp(&right.occupancy_rate))
            .map(|item| item.hotel_id),
        top_rev_par_hotel_id: summaries
            .iter()
            .max_by_key(|item| item.rev_par_cents)
            .map(|item| item.hotel_id),
    };

    Ok(Json(json!(HotelNetworkSummaryResponse {
        start,
        end,
        selected_hotel_id: params.hotel_id,
        totals,
        benchmarks,
        hotels: summaries,
    })))
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
    path = "/api/v1/audit/events/page",
    responses(
        (status = 200, description = "Página de eventos de auditoría", body = AuditEventPageResponse),
        (status = 400, description = "Cursor inválido")
    ),
    params(
        ("limit" = Option<usize>, Query, description = "Tamaño de página (1-100)"),
        ("cursor" = Option<String>, Query, description = "Cursor opaco de paginación keyset")
    ),
    tag = "Análisis",
    security(
        ("jwt" = [])
    )
)]
pub async fn get_audit_events_page_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Query(params): Query<CursorPageParams>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let cursor = match params.cursor.as_deref() {
        Some(encoded) if !encoded.trim().is_empty() => Some(decode_page_cursor(encoded)?),
        _ => None,
    };
    let limit = params
        .limit
        .unwrap_or(DEFAULT_AUDIT_PAGE_LIMIT)
        .clamp(1, MAX_AUDIT_PAGE_LIMIT);

    let page = state
        .audit_service
        .list_recent_page(hotel_id, limit, cursor)
        .await?;

    Ok(Json(json!(AuditEventPageResponse {
        items: page.items,
        next_cursor: page.next_cursor.as_ref().map(encode_page_cursor),
        has_more: page.has_more,
    })))
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
