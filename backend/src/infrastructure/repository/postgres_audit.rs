use crate::domain::models::AuditEvent;
use crate::domain::repositories::AuditRepository;
use crate::infrastructure::repository::tenant_context::begin_tenant_tx;
use async_trait::async_trait;
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub struct PostgresAuditRepository {
    pool: PgPool,
}

impl PostgresAuditRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AuditRepository for PostgresAuditRepository {
    async fn record(&self, event: AuditEvent) -> Result<(), String> {
        let hotel_id = event
            .hotel_id
            .ok_or_else(|| "AUDIT_HOTEL_ID_REQUIRED".to_string())?;
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;

        sqlx::query(
            "INSERT INTO audit_events (id, hotel_id, user_id, action, ip_address, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(event.id)
        .bind(event.hotel_id)
        .bind(event.user_id)
        .bind(event.action)
        .bind(event.ip_address)
        .bind(event.created_at)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(())
    }

    async fn find_recent_by_hotel(
        &self,
        hotel_id: Uuid,
        limit: i64,
    ) -> Result<Vec<AuditEvent>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let safe_limit = limit.clamp(1, 200);
        let records = sqlx::query(
            "SELECT id, hotel_id, user_id, action, ip_address,
                    created_at AT TIME ZONE 'UTC' AS created_at
             FROM audit_events
             WHERE hotel_id = $1
             ORDER BY created_at DESC
             LIMIT $2",
        )
        .bind(hotel_id)
        .bind(safe_limit)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        let events = records
            .into_iter()
            .map(|row| AuditEvent {
                id: row.try_get("id").unwrap(),
                hotel_id: row.try_get("hotel_id").ok(),
                user_id: row.try_get("user_id").ok(),
                action: row.try_get("action").unwrap_or_default(),
                ip_address: row.try_get("ip_address").ok(),
                created_at: row.try_get("created_at").unwrap(),
            })
            .collect();

        Ok(events)
    }
}
