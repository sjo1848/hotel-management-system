use crate::domain::models::Guest;
use crate::domain::repositories::GuestRepository;
use async_trait::async_trait;
use sqlx::{PgPool, Row};
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
        let records = sqlx::query(
            "SELECT id, hotel_id, full_name, email, phone, created_at FROM guests WHERE hotel_id = $1 ORDER BY created_at DESC",
        )
        .bind(hotel_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

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
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(guest)
    }
}
