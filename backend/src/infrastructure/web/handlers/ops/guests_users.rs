use super::*;

pub async fn list_guests_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;

    let guests = operations.guest_service.list_guests(hotel_id).await?;

    Ok(Json(json!(guests)))
}

pub async fn create_guest_handler(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    Json(payload): Json<CreateGuestRequest>,
) -> Result<Json<Value>, DomainError> {
    let operations = state.operations_context();
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    validate_non_empty_trimmed("full_name", &payload.full_name)?;
    validate_len_range("full_name", &payload.full_name, 2, 120)?;
    validate_email(&payload.email)?;
    validate_len_range("email", &payload.email, 5, 150)?;

    let created = operations
        .guest_service
        .create_guest(hotel_id, payload.full_name, payload.email, payload.phone)
        .await?;

    Ok(Json(json!(created)))
}

pub async fn list_users_handler(
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    let users: Vec<crate::domain::models::User> = state.user_service.list_users(hotel_id).await?;

    Ok(Json(json!(users
        .into_iter()
        .map(|user| json!({ "id": user.id, "username": user.username, "role": user.role }))
        .collect::<Vec<_>>())))
}

pub async fn delete_user_handler(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<Uuid>,
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
) -> Result<Json<Value>, DomainError> {
    let current_user_id = Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;

    if user_id == current_user_id {
        return Err(DomainError::InvalidInput(
            "No puedes eliminar tu propia cuenta".to_string(),
        ));
    }

    state.user_service.delete_user(hotel_id, user_id).await?;

    state
        .audit_service
        .record(
            Some(hotel_id),
            Some(current_user_id),
            &format!("user.deleted: {}", user_id),
            None,
        )
        .await;

    Ok(Json(json!({ "status": "ok" })))
}

pub async fn create_user_handler(
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateUserRequest>,
) -> Result<Json<Value>, DomainError> {
    let hotel_id = Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;
    validate_non_empty_trimmed("username", &payload.username)?;
    validate_len_range("username", &payload.username, 3, 80)?;
    validate_non_empty_trimmed("password", &payload.password)?;
    validate_len_range("password", &payload.password, 8, 128)?;
    validate_non_empty_trimmed("role", &payload.role)?;
    validate_role(&payload.role)?;

    let created: crate::domain::models::User = state
        .user_service
        .create_user(hotel_id, payload.username, payload.password, payload.role)
        .await?;

    state
        .audit_service
        .record(Some(hotel_id), Some(created.id), "user.created", None)
        .await;

    Ok(Json(
        json!({ "id": created.id, "username": created.username, "role": created.role }),
    ))
}
