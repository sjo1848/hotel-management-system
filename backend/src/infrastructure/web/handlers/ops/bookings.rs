use super::*;
use crate::domain::models::BookingOperationalUpdate;
use crate::domain::models::PaymentMethod;
use crate::infrastructure::web::middleware::rbac::role_has_capability;

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
#[tracing::instrument(
    name = "booking.create",
    skip(state, claims, payload),
    fields(flow = "create_booking")
)]
pub async fn create_booking_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Json(payload): Json<CreateBookingRequest>,
) -> Result<Json<Value>, DomainError> {
    let booking_ctx = state.booking_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let hotel_id_str = hotel_id.to_string();
    tracing::Span::current().record("tenant_id", hotel_id_str.as_str());
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
    tracing::info!(
        tenant_id = %booking.hotel_id,
        booking_id = %booking.id,
        room_id = %booking.room_id,
        "Booking created"
    );

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

#[utoipa::path(
    get,
    path = "/api/v1/front-desk/board",
    params(
        ("date" = Option<NaiveDate>, Query, description = "Fecha operativa del tablero")
    ),
    responses(
        (status = 200, description = "Tablero operativo unificado de recepcion", body = crate::domain::models::FrontDeskBoard),
        (status = 401, description = "No autorizado")
    ),
    tag = "Reservas",
    security(
        ("jwt" = [])
    )
)]
pub async fn front_desk_board_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Query(params): Query<FrontDeskBoardQueryParams>,
) -> Result<Json<Value>, DomainError> {
    let booking_ctx = state.booking_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let date = params
        .date
        .unwrap_or_else(|| chrono::Utc::now().date_naive());
    let board = booking_ctx
        .front_desk_service
        .get_board(hotel_id, date)
        .await?;
    Ok(Json(json!(board)))
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
    if let Some(note) = payload.operational_note.as_deref() {
        validate_non_empty_trimmed("operational_note", note)?;
        validate_len_range("operational_note", note, 6, 250)?;
    }
    let operational_update = payload
        .front_desk
        .as_ref()
        .map(build_operational_update)
        .transpose()?;
    if payload
        .front_desk
        .as_ref()
        .and_then(|front_desk| front_desk.check_out_payment_policy.as_deref())
        == Some("pending-approved")
        && !role_has_capability(&claims.role, "bookings.checkout.override")
    {
        return Err(DomainError::Forbidden);
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
            payload.room_id,
            payload.check_in,
            payload.check_out,
            status,
            payload.operational_note,
            operational_update,
        )
        .await?;

    Ok(Json(json!(booking)))
}

fn build_operational_update(
    payload: &BookingFrontDeskUpdateRequest,
) -> Result<BookingOperationalUpdate, DomainError> {
    if let Some(count) = payload.check_in_guests_count {
        if count <= 0 {
            return Err(DomainError::InvalidInput(
                "La cantidad final de huespedes debe ser mayor a 0".to_string(),
            ));
        }
    }

    if let Some(reference) = payload.check_in_reference.as_deref() {
        validate_len_range("check_in_reference", reference, 3, 120)?;
    }

    if let Some(reference) = payload.check_out_reference.as_deref() {
        validate_len_range("check_out_reference", reference, 6, 120)?;
    }

    if let Some(reason) = payload.terminal_reason.as_deref() {
        validate_non_empty_trimmed("terminal_reason", reason)?;
        validate_len_range("terminal_reason", reason, 6, 250)?;
    }

    if let Some(note) = payload.late_arrival_note.as_deref() {
        validate_non_empty_trimmed("late_arrival_note", note)?;
        validate_len_range("late_arrival_note", note, 6, 250)?;
    }

    if let Some(policy) = payload.check_out_payment_policy.as_deref() {
        match policy {
            "settled" | "pending-approved" => {}
            _ => {
                return Err(DomainError::InvalidInput(
                    "La politica de saldo es invalida".to_string(),
                ))
            }
        }
    }

    Ok(BookingOperationalUpdate {
        check_in_guests_count: payload.check_in_guests_count,
        check_in_reference: payload.check_in_reference.clone(),
        check_in_document_verified: payload.check_in_document_verified,
        check_in_contact_confirmed: payload.check_in_contact_confirmed,
        check_in_stay_confirmed: payload.check_in_stay_confirmed,
        check_out_payment_policy: payload.check_out_payment_policy.clone(),
        check_out_reference: payload.check_out_reference.clone(),
        check_out_charges_reviewed: payload.check_out_charges_reviewed,
        check_out_room_release_confirmed: payload.check_out_room_release_confirmed,
        check_out_housekeeping_handoff: payload.check_out_housekeeping_handoff,
        terminal_reason: payload.terminal_reason.clone(),
        late_arrival_eta: payload.late_arrival_eta,
        late_arrival_note: payload.late_arrival_note.clone(),
    })
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

pub async fn list_booking_payments_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(booking_id): Path<Uuid>,
) -> Result<Json<Value>, DomainError> {
    let booking_ctx = state.booking_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let payments = booking_ctx
        .invoice_service
        .list_payments_by_booking(hotel_id, booking_id)
        .await?;
    Ok(Json(json!(payments)))
}

#[utoipa::path(
    post,
    path = "/api/v1/bookings/{id}/payments",
    request_body = RegisterBookingPaymentRequest,
    responses(
        (status = 200, description = "Cobro registrado y factura actualizada", body = Invoice),
        (status = 400, description = "Cobro invalido"),
        (status = 404, description = "Reserva no encontrada")
    ),
    tag = "Reservas",
    security(
        ("jwt" = [])
    )
)]
pub async fn register_booking_payment_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(booking_id): Path<Uuid>,
    Json(payload): Json<RegisterBookingPaymentRequest>,
) -> Result<Json<Value>, DomainError> {
    let booking_ctx = state.booking_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    let payment_method = parse_payment_method_input(payload.payment_method.as_str())?;
    validate_positive_amount("amount_cents", payload.amount_cents)?;
    if let Some(reference) = payload.payment_reference.as_deref() {
        validate_len_range("payment_reference", reference, 3, 120)?;
    }
    if let Some(note) = payload.note.as_deref() {
        validate_len_range("note", note, 3, 250)?;
    }

    let invoice = booking_ctx
        .billing_service
        .register_booking_payment(
            hotel_id,
            booking_id,
            payload.amount_cents,
            payment_method,
            payload.payment_reference.clone(),
            payload.note.clone(),
            Some(user_id),
        )
        .await?;

    state
        .audit_service
        .record(
            Some(hotel_id),
            Some(user_id),
            &format!("invoice.payment_recorded: booking {}", booking_id),
            None,
        )
        .await;

    Ok(Json(json!(invoice)))
}

#[utoipa::path(
    post,
    path = "/api/v1/bookings/{id}/settle-payment",
    request_body = SettleBookingPaymentRequest,
    responses(
        (status = 200, description = "Factura liquidada y cobrada", body = Invoice),
        (status = 400, description = "Liquidacion invalida"),
        (status = 404, description = "Reserva no encontrada")
    ),
    tag = "Reservas",
    security(
        ("jwt" = [])
    )
)]
pub async fn settle_booking_payment_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Path(booking_id): Path<Uuid>,
    Json(payload): Json<SettleBookingPaymentRequest>,
) -> Result<Json<Value>, DomainError> {
    let booking_ctx = state.booking_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    let payment_method = parse_payment_method_input(payload.payment_method.as_str())?;
    if let Some(reference) = payload.payment_reference.as_deref() {
        validate_len_range("payment_reference", reference, 3, 120)?;
    }

    let invoice = booking_ctx
        .billing_service
        .settle_booking_payment(
            hotel_id,
            booking_id,
            payment_method,
            payload.payment_reference.clone(),
        )
        .await?;

    state
        .audit_service
        .record(
            Some(hotel_id),
            Some(user_id),
            &format!("invoice.settled: booking {}", booking_id),
            None,
        )
        .await;

    Ok(Json(json!(invoice)))
}

fn parse_payment_method_input(value: &str) -> Result<PaymentMethod, DomainError> {
    match value {
        "CASH" => Ok(PaymentMethod::Cash),
        "CARD" => Ok(PaymentMethod::Card),
        "TRANSFER" => Ok(PaymentMethod::Transfer),
        _ => Err(DomainError::InvalidInput(
            "El medio de pago es invalido".to_string(),
        )),
    }
}
