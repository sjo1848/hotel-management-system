use super::*;

pub async fn list_cash_closures_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let closures = operations
        .cash_closure_service
        .list_closures(hotel_id)
        .await?;

    Ok(Json(json!(closures)))
}

pub async fn get_current_balance_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let balance = operations
        .cash_closure_service
        .get_current_balance(hotel_id)
        .await?;

    Ok(Json(json!(balance)))
}

#[tracing::instrument(
    name = "cash.close",
    skip(state, claims, payload),
    fields(flow = "close_cash")
)]
pub async fn close_cash_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Json(payload): Json<CashClosureRequest>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    let hotel_id_str = hotel_id.to_string();
    let user_id_str = user_id.to_string();
    let span = tracing::Span::current();
    span.record("tenant_id", hotel_id_str.as_str());
    span.record("user_id", user_id_str.as_str());
    if let Some(notes) = payload.notes.as_deref() {
        validate_len_range("notes", notes, 6, 500)?;
    }
    if let Some(handoff_to) = payload.handoff_to.as_deref() {
        validate_len_range("handoff_to", handoff_to, 2, 120)?;
    }
    if payload
        .expected_cash_amount_cents
        .is_some_and(|amount| amount < 0)
        || payload
            .counted_cash_amount_cents
            .is_some_and(|amount| amount < 0)
    {
        return Err(DomainError::InvalidInput(
            "Los montos de efectivo no pueden ser negativos".to_string(),
        ));
    }

    let closure = operations
        .cash_closure_service
        .close_cash(
            hotel_id,
            user_id,
            payload.notes,
            payload.expected_cash_amount_cents,
            payload.counted_cash_amount_cents,
            payload.handoff_to,
        )
        .await?;

    let audit_action: String = format!(
        "cash.closed closure={} expected={} counted={} diff={} handoff={}",
        closure.id,
        closure.cash_amount_cents,
        closure.counted_cash_amount_cents,
        closure.cash_difference_cents,
        closure.handoff_to,
    )
    .chars()
    .take(120)
    .collect();
    state
        .audit_service
        .record(Some(hotel_id), Some(user_id), &audit_action, None)
        .await;
    tracing::info!(
        tenant_id = %closure.hotel_id,
        user_id = %closure.user_id,
        closure_id = %closure.id,
        "Cash closure completed"
    );

    Ok(Json(json!(closure)))
}
