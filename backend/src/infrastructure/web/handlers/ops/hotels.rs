use super::*;

pub async fn list_hotels_handler(
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    let _ = claims;
    let hotels = state.hotel_service.list_hotels().await?;
    Ok(Json(json!(hotels)))
}

#[utoipa::path(
    get,
    path = "/api/v1/feature-flags",
    responses(
        (status = 200, description = "Feature flags por plan del tenant actual", body = crate::domain::models::TenantFeatureFlags)
    ),
    tag = "Operación",
    security(
        ("jwt" = [])
    )
)]
pub async fn get_feature_flags_handler(
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let user_id = Uuid::parse_str(&claims.sub).ok();
    let flags = state.hotel_service.get_feature_flags(hotel_id).await?;
    state
        .audit_service
        .record(Some(hotel_id), user_id, "feature_flags_read", None)
        .await;
    Ok(Json(json!(flags)))
}

#[utoipa::path(
    get,
    path = "/api/v1/hotels/network-kpis",
    responses(
        (status = 200, description = "Resumen consolidado HQ multi-hotel", body = crate::domain::models::HotelNetworkSummary)
    ),
    params(
        ("start" = Option<NaiveDate>, Query, description = "Fecha de inicio (YYYY-MM-DD)"),
        ("end" = Option<NaiveDate>, Query, description = "Fecha de fin (YYYY-MM-DD)")
    ),
    tag = "Operación",
    security(
        ("jwt" = [])
    )
)]
pub async fn get_hotel_network_kpis_handler(
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    State(state): State<Arc<AppState>>,
    Query(params): Query<DateRangeParams>,
) -> Result<Json<Value>, DomainError> {
    let _ = claims;
    let start = params
        .start
        .unwrap_or_else(|| chrono::Utc::now().naive_utc().date() - chrono::Duration::days(30));
    let end = params
        .end
        .unwrap_or_else(|| chrono::Utc::now().naive_utc().date());
    validate_date_range(start, end)?;

    let hotels = state.hotel_service.list_hotels().await?;
    let mut hotel_summaries: Vec<crate::domain::models::HotelNetworkHotelKpi> = Vec::new();
    let mut total_active_bookings = 0_i64;
    let mut total_revenue_cents = 0_i64;
    let mut occupancy_sum = 0_f64;

    for hotel in hotels {
        let dashboard_kpis = state
            .reporting_service
            .get_dashboard_summary(hotel.id)
            .await?;
        let feature_flags = state.hotel_service.get_feature_flags(hotel.id).await?;
        let revenue_report = state
            .reporting_service
            .get_revenue_report(hotel.id, start, end)
            .await?;
        let revenue_cents: i64 = revenue_report.iter().map(|item| item.revenue_cents).sum();

        total_active_bookings += dashboard_kpis.active_bookings_count;
        total_revenue_cents += revenue_cents;
        occupancy_sum += dashboard_kpis.occupancy_rate;

        hotel_summaries.push(crate::domain::models::HotelNetworkHotelKpi {
            hotel_id: hotel.id,
            hotel_name: hotel.name,
            plan_tier: feature_flags.plan_tier,
            occupancy_rate: dashboard_kpis.occupancy_rate,
            active_bookings_count: dashboard_kpis.active_bookings_count,
            revenue_cents,
            adr_cents: dashboard_kpis.adr_cents,
            rev_par_cents: dashboard_kpis.rev_par_cents,
        });
    }

    hotel_summaries.sort_by_key(|hotel| std::cmp::Reverse(hotel.revenue_cents));

    let total_hotels = hotel_summaries.len() as i64;
    let average_occupancy_rate = if total_hotels > 0 {
        occupancy_sum / total_hotels as f64
    } else {
        0.0
    };

    let summary = crate::domain::models::HotelNetworkSummary {
        start,
        end,
        total_hotels,
        total_active_bookings,
        total_revenue_cents,
        average_occupancy_rate,
        hotels: hotel_summaries,
    };
    Ok(Json(json!(summary)))
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

#[utoipa::path(
    patch,
    path = "/api/v1/hotels/{id}/plan",
    params(
        ("id" = Uuid, Path, description = "ID del hotel")
    ),
    request_body = UpdateHotelPlanRequest,
    responses(
        (status = 200, description = "Plan actualizado", body = crate::domain::models::TenantFeatureFlags),
        (status = 400, description = "Plan inválido"),
        (status = 404, description = "Hotel no encontrado")
    ),
    tag = "Operación",
    security(
        ("jwt" = [])
    )
)]
pub async fn update_hotel_plan_handler(
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    State(state): State<Arc<AppState>>,
    Path(hotel_id): Path<Uuid>,
    Json(payload): Json<UpdateHotelPlanRequest>,
) -> Result<Json<Value>, DomainError> {
    let actor_user_id = Uuid::parse_str(&claims.sub).ok();
    validate_non_empty_trimmed("plan_tier", &payload.plan_tier)?;
    let previous_flags = state.hotel_service.get_feature_flags(hotel_id).await?;
    let flags = state
        .hotel_service
        .update_plan_tier(hotel_id, payload.plan_tier)
        .await?;
    let action = if previous_flags.plan_tier.eq_ignore_ascii_case("PRO")
        && flags.plan_tier.eq_ignore_ascii_case("ENTERPRISE")
    {
        "plan_upgrade_pro_to_enterprise".to_string()
    } else {
        format!("plan_tier_updated:{}", flags.plan_tier.to_lowercase())
    };
    state
        .audit_service
        .record(Some(hotel_id), actor_user_id, &action, None)
        .await;
    Ok(Json(json!(flags)))
}
