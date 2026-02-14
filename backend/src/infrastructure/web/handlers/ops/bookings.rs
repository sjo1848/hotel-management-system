use super::*;

#[utoipa::path(
    post,
    path = "/api/v1/bookings",
    request_body = CreateBookingRequest,
    responses(
        (status = 201, description = "Reserva creada exitosamente", body = Booking),
        (status = 409, description = "Conflicto de fechas")
    ),
    tag = "Reservas"
)]
pub async fn create_booking_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Json(payload): Json<CreateBookingRequest>,
) -> Result<Json<Value>, DomainError> {
    let booking_ctx = state.booking_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    validate_non_empty_trimmed("guest_name", &payload.guest_name)?;
    validate_len_range("guest_name", &payload.guest_name, 1, 100)?;
    validate_booking_dates(payload.check_in, payload.check_out)?;

    let booking: crate::domain::models::Booking = booking_ctx
        .booking_service
        .execute(
            hotel_id,
            payload.room_id,
            payload.guest_id,
            payload.guest_name,
            payload.check_in,
            payload.check_out,
        )
        .await?;

    Ok(Json(json!(booking)))
}

pub async fn list_bookings_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Query(params): Query<BookingFilterParams>,
) -> Result<Json<Value>, DomainError> {
    let booking_ctx = state.booking_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let bookings: Vec<crate::domain::models::Booking> = match (params.start, params.end) {
        (Some(start), Some(end)) => {
            booking_ctx
                .booking_service
                .list_bookings_in_range(hotel_id, start, end)
                .await?
        }
        _ => booking_ctx.booking_service.list_bookings(hotel_id).await?,
    };
    Ok(Json(json!(bookings)))
}

pub async fn update_booking_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(booking_id): Path<Uuid>,
    Json(payload): Json<UpdateBookingRequest>,
) -> Result<Json<Value>, DomainError> {
    let booking_ctx = state.booking_context();
    let actor_user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    if let Some(name) = payload.guest_name.as_deref() {
        validate_non_empty_trimmed("guest_name", name)?;
        validate_len_range("guest_name", name, 1, 100)?;
    }
    if let (Some(check_in), Some(check_out)) = (payload.check_in, payload.check_out) {
        validate_booking_dates(check_in, check_out)?;
    }
    let status = parse_booking_status_input(payload.status.as_deref())?;

    let booking: crate::domain::models::Booking = booking_ctx
        .booking_transaction_service
        .update_booking_transactional(
            hotel_id,
            booking_id,
            Some(actor_user_id),
            payload.guest_id,
            payload.guest_name,
            payload.check_in,
            payload.check_out,
            status,
        )
        .await?;

    Ok(Json(json!(booking)))
}

pub async fn add_extra_charge_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(booking_id): Path<Uuid>,
    Json(payload): Json<AddExtraChargeRequest>,
) -> Result<Json<Value>, DomainError> {
    let booking_ctx = state.booking_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    validate_non_empty_trimmed("description", &payload.description)?;
    validate_len_range("description", &payload.description, 2, 250)?;
    validate_non_empty_trimmed("category", &payload.category)?;
    validate_len_range("category", &payload.category, 2, 50)?;
    validate_positive_amount("amount_cents", payload.amount_cents)?;

    let charge = booking_ctx
        .billing_service
        .add_extra_charge(
            hotel_id,
            booking_id,
            payload.description,
            payload.amount_cents,
            payload.category,
        )
        .await?;

    Ok(Json(json!(charge)))
}

pub async fn list_extra_charges_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<Value>, DomainError> {
    let booking_ctx = state.booking_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;

    let charges = booking_ctx
        .billing_service
        .list_extra_charges(hotel_id, booking_id)
        .await?;
    Ok(Json(json!(charges)))
}

pub async fn list_invoices_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let booking_ctx = state.booking_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let invoices = booking_ctx.invoice_service.list_invoices(hotel_id).await?;
    Ok(Json(json!(invoices)))
}

pub async fn get_invoice_by_booking_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<Value>, DomainError> {
    let booking_ctx = state.booking_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let invoice = booking_ctx
        .invoice_service
        .get_invoice_by_booking(hotel_id, booking_id)
        .await?;
    Ok(Json(json!(invoice)))
}
