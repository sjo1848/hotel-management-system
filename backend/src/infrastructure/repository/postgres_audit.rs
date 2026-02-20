use crate::domain::models::{AuditEvent, AuditEventPage, BookingPageCursor};
use crate::domain::repositories::AuditRepository;
use crate::infrastructure::repository::tenant_context::begin_tenant_tx;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use sqlx::{PgPool, Postgres, QueryBuilder, Row};
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
            .ok_or_else(|| "TENANT_CONTEXT_REQUIRED".to_string())?;
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

    async fn find_recent_page_by_hotel(
        &self,
        hotel_id: Uuid,
        limit: usize,
        cursor: Option<BookingPageCursor>,
    ) -> Result<AuditEventPage, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let safe_limit = limit.clamp(1, 100);
        let fetch_limit = (safe_limit + 1) as i64;

        let mut query = QueryBuilder::<Postgres>::new(
            "SELECT id, hotel_id, user_id, action, ip_address,
                    created_at AT TIME ZONE 'UTC' AS created_at
             FROM audit_events
             WHERE hotel_id = ",
        );
        query.push_bind(hotel_id);

        if let Some(cursor) = cursor {
            query
                .push(" AND (created_at, id) < (")
                .push_bind(cursor.created_at)
                .push(", ")
                .push_bind(cursor.id)
                .push(")");
        }

        query
            .push(" ORDER BY created_at DESC, id DESC LIMIT ")
            .push_bind(fetch_limit);

        let mut records = query
            .build()
            .fetch_all(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        let has_more = records.len() > safe_limit;
        if has_more {
            records.truncate(safe_limit);
        }

        let mut next_cursor = None;
        let items = records
            .into_iter()
            .map(|row| {
                let id: Uuid = row.try_get("id").unwrap();
                let created_at: NaiveDateTime = row.try_get("created_at").unwrap();
                next_cursor = Some(BookingPageCursor { created_at, id });

                AuditEvent {
                    id,
                    hotel_id: row.try_get("hotel_id").ok(),
                    user_id: row.try_get("user_id").ok(),
                    action: row.try_get("action").unwrap_or_default(),
                    ip_address: row.try_get("ip_address").ok(),
                    created_at,
                }
            })
            .collect();

        if !has_more {
            next_cursor = None;
        }

        Ok(AuditEventPage {
            items,
            next_cursor,
            has_more,
        })
    }
}
