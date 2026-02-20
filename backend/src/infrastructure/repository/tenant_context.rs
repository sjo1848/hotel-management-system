use metrics::counter;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

const ALLOWED_BYPASS_REASONS: &[&str] = &["refresh_token_lookup_pre_auth"];

fn ensure_tenant_id(hotel_id: Uuid) -> Result<String, String> {
    if hotel_id.is_nil() {
        return Err("TENANT_CONTEXT_REQUIRED".to_string());
    }
    Ok(hotel_id.to_string())
}

fn bypass_reason_allowed(reason: &str) -> bool {
    ALLOWED_BYPASS_REASONS.contains(&reason)
}

pub async fn begin_tenant_tx<'a>(
    pool: &'a PgPool,
    hotel_id: Uuid,
) -> Result<Transaction<'a, Postgres>, String> {
    let tenant_id = ensure_tenant_id(hotel_id)?;
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    apply_tenant_context(&mut tx, &tenant_id).await?;
    Ok(tx)
}

pub async fn apply_tenant_context(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: &str,
) -> Result<(), String> {
    sqlx::query(
        "SELECT
            set_config('app.rls_bypass', 'false', true),
            set_config('app.current_hotel_id', $1, true),
            set_config('app.hotel_id', $1, true)",
    )
    .bind(tenant_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn begin_bypass_tx<'a>(
    pool: &'a PgPool,
    reason: &'static str,
) -> Result<Transaction<'a, Postgres>, String> {
    let normalized_reason = reason.trim();
    if normalized_reason.is_empty() {
        return Err("TENANT_BYPASS_REASON_REQUIRED".to_string());
    }

    if !bypass_reason_allowed(normalized_reason) {
        counter!(
            "tenant_rls_bypass_denied_total",
            &[("reason", normalized_reason.to_string())]
        )
        .increment(1);
        tracing::error!(
            reason = normalized_reason,
            "Denied RLS bypass for unknown reason"
        );
        return Err("TENANT_BYPASS_REASON_NOT_ALLOWED".to_string());
    }

    counter!(
        "tenant_rls_bypass_total",
        &[("reason", normalized_reason.to_string())]
    )
    .increment(1);
    tracing::warn!(
        reason = normalized_reason,
        "Starting RLS bypass transaction for controlled flow"
    );

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::query(
        "SELECT
            set_config('app.rls_bypass', 'true', true),
            set_config('app.rls_bypass_reason', $1, true)",
    )
    .bind(normalized_reason)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    Ok(tx)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bypass_reason_allowlist_is_strict() {
        assert!(bypass_reason_allowed("refresh_token_lookup_pre_auth"));
        assert!(!bypass_reason_allowed("any_other_reason"));
    }
}
