use crate::domain::models::AuditEvent;
use crate::domain::repositories::AuditRepository;
use async_trait::async_trait;
use sqlx::PgPool;

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
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(())
    }
}
