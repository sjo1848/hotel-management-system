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
            occupancy_rate: dashboard_kpis.occupancy_rate,
            active_bookings_count: dashboard_kpis.active_bookings_count,
            revenue_cents,
            adr_cents: dashboard_kpis.adr_cents,
            rev_par_cents: dashboard_kpis.rev_par_cents,
        });
    }

    hotel_summaries.sort_by(|a, b| b.revenue_cents.cmp(&a.revenue_cents));

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
