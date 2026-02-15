use super::*;

pub async fn get_current_balance_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let (total, cash, card) = operations
        .cash_closure_service
        .get_current_balance(hotel_id)
        .await?;

    Ok(Json(json!({
        "total_amount_cents": total,
        "cash_amount_cents": cash,
        "card_amount_cents": card
    })))
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
        validate_len_range("notes", notes, 0, 500)?;
    }

    let closure = operations
        .cash_closure_service
        .close_cash(hotel_id, user_id, payload.notes)
        .await?;

    state
        .audit_service
        .record(Some(hotel_id), Some(user_id), "cash.closed", None)
        .await;
    tracing::info!(
        tenant_id = %closure.hotel_id,
        user_id = %closure.user_id,
        closure_id = %closure.id,
        "Cash closure completed"
    );

    Ok(Json(json!(closure)))
}
