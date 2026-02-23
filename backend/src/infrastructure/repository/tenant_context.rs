use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

fn ensure_tenant_id(hotel_id: Uuid) -> Result<String, String> {
    if hotel_id.is_nil() {
        return Err("TENANT_CONTEXT_REQUIRED".to_string());
    }
    Ok(hotel_id.to_string())
}

fn ensure_token_hash(token_hash: &str) -> Result<String, String> {
    let normalized = token_hash.trim();
    if normalized.is_empty() {
        return Err("REFRESH_TOKEN_HASH_REQUIRED".to_string());
    }
    Ok(normalized.to_string())
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
            set_config('app.refresh_token_hash', '', true),
            set_config('app.current_hotel_id', $1, true),
            set_config('app.hotel_id', $1, true)",
    )
    .bind(tenant_id)
    .execute(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn begin_refresh_token_lookup_tx<'a>(
    pool: &'a PgPool,
    token_hash: &str,
) -> Result<Transaction<'a, Postgres>, String> {
    let normalized_hash = ensure_token_hash(token_hash)?;

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::query(
        "SELECT
            set_config('app.rls_bypass', 'false', true),
            set_config('app.current_hotel_id', '', true),
            set_config('app.hotel_id', '', true),
            set_config('app.refresh_token_hash', $1, true)",
    )
    .bind(normalized_hash)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    Ok(tx)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refresh_lookup_rejects_empty_hash() {
        let err = ensure_token_hash("   ").expect_err("empty hash must fail");
        assert_eq!(err, "REFRESH_TOKEN_HASH_REQUIRED");
    }

    #[test]
    fn refresh_lookup_accepts_non_empty_hash() {
        let normalized = ensure_token_hash("hash-value").expect("hash should be accepted");
        assert_eq!(normalized, "hash-value");
    }
}
