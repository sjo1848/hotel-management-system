use crate::domain::models::{BookingPageCursor, Guest, GuestPage};
use crate::domain::repositories::GuestRepository;
use crate::infrastructure::repository::tenant_context::begin_tenant_tx;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use sqlx::{PgPool, Postgres, QueryBuilder, Row};
use uuid::Uuid;

pub struct PostgresGuestRepository {
    pool: PgPool,
}

impl PostgresGuestRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl GuestRepository for PostgresGuestRepository {
    async fn find_all(&self, hotel_id: Uuid) -> Result<Vec<Guest>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let records = sqlx::query(
            "SELECT id, hotel_id, full_name, email, phone, created_at FROM guests WHERE hotel_id = $1 ORDER BY created_at DESC",
        )
        .bind(hotel_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(records
            .into_iter()
            .map(|row| Guest {
                id: row.try_get("id").unwrap(),
                hotel_id: row.try_get("hotel_id").unwrap(),
                full_name: row.try_get("full_name").unwrap(),
                email: row.try_get("email").unwrap(),
                phone: row.try_get("phone").ok(),
                created_at: row.try_get("created_at").ok(),
            })
            .collect())
    }

    async fn create(&self, guest: Guest) -> Result<Guest, String> {
        let mut tx = begin_tenant_tx(&self.pool, guest.hotel_id).await?;
        let phone = guest.phone.clone();
        sqlx::query(
            "INSERT INTO guests (id, hotel_id, full_name, email, phone)
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(guest.id)
        .bind(guest.hotel_id)
        .bind(&guest.full_name)
        .bind(&guest.email)
        .bind(phone)
        .execute(&mut *tx)
        .await
        .map_err(map_db_error)?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(guest)
    }

    async fn find_page(
        &self,
        hotel_id: Uuid,
        limit: usize,
        cursor: Option<BookingPageCursor>,
    ) -> Result<GuestPage, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let safe_limit = limit.clamp(1, 100);
        let fetch_limit = (safe_limit + 1) as i64;

        let mut query = QueryBuilder::<Postgres>::new(
            "SELECT id, hotel_id, full_name, email, phone, created_at,
                    COALESCE(created_at, '1970-01-01 00:00:00+00'::timestamptz) AT TIME ZONE 'UTC' AS created_at_cursor
             FROM guests
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
                let created_at_cursor: NaiveDateTime = row.try_get("created_at_cursor").unwrap();
                next_cursor = Some(BookingPageCursor {
                    created_at: created_at_cursor,
                    id,
                });
                Guest {
                    id,
                    hotel_id: row.try_get("hotel_id").unwrap(),
                    full_name: row.try_get("full_name").unwrap(),
                    email: row.try_get("email").unwrap(),
                    phone: row.try_get("phone").ok(),
                    created_at: row.try_get("created_at").ok(),
                }
            })
            .collect();

        if !has_more {
            next_cursor = None;
        }

        Ok(GuestPage {
            items,
            next_cursor,
            has_more,
        })
    }

    async fn find_by_id(&self, hotel_id: Uuid, id: Uuid) -> Result<Option<Guest>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let record = sqlx::query(
            "SELECT id, hotel_id, full_name, email, phone, created_at
             FROM guests
             WHERE hotel_id = $1 AND id = $2",
        )
        .bind(hotel_id)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(record.map(|row| Guest {
            id: row.try_get("id").unwrap(),
            hotel_id: row.try_get("hotel_id").unwrap(),
            full_name: row.try_get("full_name").unwrap(),
            email: row.try_get("email").unwrap(),
            phone: row.try_get("phone").ok(),
            created_at: row.try_get("created_at").ok(),
        }))
    }
}

fn map_db_error(error: sqlx::Error) -> String {
    if let sqlx::Error::Database(db_error) = &error {
        if let Some(code) = db_error.code() {
            if code == "23505" {
                let constraint_name = db_error.constraint().unwrap_or_default();
                if constraint_name == "ux_guests_hotel_email"
                    || constraint_name == "guests_email_key"
                {
                    return "GUEST_ALREADY_EXISTS".to_string();
                }
            }
            if code == "23503" {
                let constraint_name = db_error.constraint().unwrap_or_default();
                if constraint_name == "guests_hotel_id_fkey" {
                    return "GUEST_HOTEL_NOT_FOUND".to_string();
                }
            }
        }
    }
    error.to_string()
}
