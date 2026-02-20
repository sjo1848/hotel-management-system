use metrics::counter;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

fn ensure_tenant_id(hotel_id: Uuid) -> Result<String, String> {
    if hotel_id.is_nil() {
        return Err("TENANT_CONTEXT_REQUIRED".to_string());
    }
    Ok(hotel_id.to_string())
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
    if reason.trim().is_empty() {
        return Err("TENANT_BYPASS_REASON_REQUIRED".to_string());
    }
    counter!("tenant_rls_bypass_total", &[("reason", reason.to_string())]).increment(1);
    tracing::warn!(
        reason,
        "Starting RLS bypass transaction for controlled flow"
    );

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::query("SELECT set_config('app.rls_bypass', 'true', true)")
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    Ok(tx)
}
