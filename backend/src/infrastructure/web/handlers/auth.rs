use super::*;

#[utoipa::path(
    post,
    path = "/api/v1/auth/login",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Login exitoso", body = LoginResponse)
    ),
    tag = "Autenticación"
)]
pub async fn login_handler(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(payload): Json<LoginRequest>,
) -> Result<Response, DomainError> {
    let auth_ctx = state.auth_context();
    let ip = addr.ip().to_string();
    let hotel_id_input = payload.hotel_id.trim();
    validate_non_empty_trimmed("hotel_id", hotel_id_input)?;
    validate_non_empty_trimmed("username", &payload.username)?;
    validate_len_range("username", &payload.username, 3, 80)?;
    validate_non_empty_trimmed("password", &payload.password)?;
    validate_len_range("password", &payload.password, 8, 128)?;

    let hotel_id = if let Ok(uuid) = Uuid::parse_str(hotel_id_input) {
        uuid
    } else {
        state
            .hotel_service
            .find_hotel_id_by_name_ci(hotel_id_input)
            .await?
            .ok_or_else(|| {
                DomainError::InvalidInput("Hotel inválido. Usá ID o nombre existente.".to_string())
            })?
    };

    let user = match auth_ctx
        .auth_service
        .verify_user(hotel_id, &payload.username, &payload.password)
        .await
    {
        Ok(u) => u,
        Err(e) => {
            tracing::warn!(
                ip = %ip,
                username = %payload.username,
                "Intento de login fallido"
            );
            return Err(e);
        }
    };

    let device_id = resolve_device_id(payload.device_id.as_deref(), &headers);
    auth_ctx
        .auth_service
        .revoke_user_device_tokens(user.hotel_id, user.id, &device_id)
        .await?;

    let exp = auth_ctx.auth_service.access_exp();

    let claims = crate::infrastructure::web::jwt::Claims {
        sub: user.id.to_string(),
        hotel_id: user.hotel_id.to_string(),
        role: user.role.clone(),
        exp,
    };

    let access_token = crate::infrastructure::web::jwt::encode_token(
        &claims,
        &state.config.jwt_secret,
        &state.config.jwt_kid,
    )
    .map_err(DomainError::InfrastructureError)?;

    let (refresh_token, _): (String, crate::domain::models::RefreshToken) = auth_ctx
        .auth_service
        .issue_refresh_token(user.hotel_id, user.id, device_id, None)
        .await?;
    let refresh_cookie = build_refresh_cookie(&refresh_token, &state.config);
    let access_cookie = build_access_cookie(&access_token, &state.config);
    let csrf_token = generate_csrf_token();
    let csrf_cookie = build_csrf_cookie(&csrf_token, &state.config);

    state
        .audit_service
        .record(Some(user.hotel_id), Some(user.id), "auth.login", Some(ip))
        .await;

    Ok((
        StatusCode::OK,
        AppendHeaders([
            (header::SET_COOKIE, refresh_cookie),
            (header::SET_COOKIE, access_cookie),
            (header::SET_COOKIE, csrf_cookie),
        ]),
        Json(json!(LoginResponse {
            access_token,
            expires_in: auth_ctx.auth_service.access_ttl_seconds(),
            hotel_id: user.hotel_id,
            role: user.role,
        })),
    )
        .into_response())
}

pub async fn refresh_handler(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    payload: Option<Json<RefreshRequest>>,
) -> Result<Response, DomainError> {
    let auth_ctx = state.auth_context();
    // CSRF check is now performed by auth_middleware for this endpoint

    let refresh_token = payload
        .as_ref()
        .and_then(|value| value.0.refresh_token.as_ref().cloned())
        .or_else(|| extract_refresh_cookie(&headers))
        .unwrap_or_default();

    if refresh_token.trim().is_empty() {
        return Err(DomainError::Unauthorized);
    }

    let (hotel_id, user_id, new_refresh, _): (
        Uuid,
        Uuid,
        String,
        crate::domain::models::RefreshToken,
    ) = auth_ctx
        .auth_service
        .rotate_refresh_token(&refresh_token)
        .await?;

    let user: crate::domain::models::User = auth_ctx
        .auth_service
        .get_session_user(hotel_id, user_id)
        .await?;

    let exp = auth_ctx.auth_service.access_exp();
    let claims = crate::infrastructure::web::jwt::Claims {
        sub: user.id.to_string(),
        hotel_id: user.hotel_id.to_string(),
        role: user.role.clone(),
        exp,
    };

    let access_token = crate::infrastructure::web::jwt::encode_token(
        &claims,
        &state.config.jwt_secret,
        &state.config.jwt_kid,
    )
    .map_err(DomainError::InfrastructureError)?;

    let refresh_cookie = build_refresh_cookie(&new_refresh, &state.config);
    let access_cookie = build_access_cookie(&access_token, &state.config);
    let csrf_token = generate_csrf_token();
    let csrf_cookie = build_csrf_cookie(&csrf_token, &state.config);

    Ok((
        StatusCode::OK,
        AppendHeaders([
            (header::SET_COOKIE, refresh_cookie),
            (header::SET_COOKIE, access_cookie),
            (header::SET_COOKIE, csrf_cookie),
        ]),
        Json(json!(LoginResponse {
            access_token,
            expires_in: auth_ctx.auth_service.access_ttl_seconds(),
            hotel_id: user.hotel_id,
            role: user.role,
        })),
    )
        .into_response())
}

pub async fn logout_handler(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    payload: Option<Json<RefreshRequest>>,
) -> Result<Response, DomainError> {
    let auth_ctx = state.auth_context();
    let ip = addr.ip().to_string();
    // CSRF check is now performed by auth_middleware for this endpoint

    let refresh_token = payload
        .as_ref()
        .and_then(|value| value.0.refresh_token.as_ref().cloned())
        .or_else(|| extract_refresh_cookie(&headers))
        .unwrap_or_default();

    if refresh_token.trim().is_empty() {
        // If no token, just clear cookies and return OK (idempotent logout)
        let expired_cookie = clear_refresh_cookie(&state.config);
        let expired_access = clear_access_cookie(&state.config);
        let expired_csrf = clear_csrf_cookie(&state.config);
        return Ok((
            StatusCode::OK,
            AppendHeaders([
                (header::SET_COOKIE, expired_cookie),
                (header::SET_COOKIE, expired_access),
                (header::SET_COOKIE, expired_csrf),
            ]),
            Json(json!({ "status": "ok" })),
        )
            .into_response());
    }

    let logout_all_devices = payload
        .as_ref()
        .and_then(|value| value.0.all_devices)
        .unwrap_or(false);
    let revoked = auth_ctx
        .auth_service
        .revoke_refresh_token_with_context(&refresh_token)
        .await?;
    if logout_all_devices {
        auth_ctx
            .auth_service
            .revoke_user_tokens(revoked.hotel_id, revoked.user_id)
            .await?;
    } else {
        auth_ctx
            .auth_service
            .revoke_session_tokens(revoked.hotel_id, revoked.user_id, revoked.session_id)
            .await?;
    }
    let expired_cookie = clear_refresh_cookie(&state.config);
    let expired_access = clear_access_cookie(&state.config);
    let expired_csrf = clear_csrf_cookie(&state.config);
    state
        .audit_service
        .record(
            Some(revoked.hotel_id),
            Some(revoked.user_id),
            "auth.logout",
            Some(ip),
        )
        .await;
    Ok((
        StatusCode::OK,
        AppendHeaders([
            (header::SET_COOKIE, expired_cookie),
            (header::SET_COOKIE, expired_access),
            (header::SET_COOKIE, expired_csrf),
        ]),
        Json(json!({ "status": "ok" })),
    )
        .into_response())
}

pub async fn me_handler(
    Extension(claims): Extension<crate::infrastructure::web::jwt::Claims>,

    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, DomainError> {
    let auth_ctx = state.auth_context();
    let user_id = uuid::Uuid::parse_str(&claims.sub).map_err(|_| DomainError::Unauthorized)?;

    let hotel_id =
        uuid::Uuid::parse_str(&claims.hotel_id).map_err(|_| DomainError::Unauthorized)?;

    let user: crate::domain::models::User = auth_ctx
        .auth_service
        .get_session_user(hotel_id, user_id)
        .await?;

    Ok(Json(json!({

        "id": user.id,

        "username": user.username,

        "hotel_id": user.hotel_id,

        "role": user.role

    })))
}
