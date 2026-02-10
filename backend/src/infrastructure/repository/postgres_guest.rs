use crate::domain::models::Guest;
use crate::domain::repositories::GuestRepository;
use async_trait::async_trait;
use sqlx::PgPool;
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
    async fn find_all(&self) -> Result<Vec<Guest>, String> {
        let records = sqlx::query!(
            "SELECT id, full_name, email, phone FROM guests ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(records
            .into_iter()
            .map(|row| Guest {
                id: row.id,
                full_name: row.full_name,
                email: row.email,
                phone: row.phone,
            })
            .collect())
    }

    async fn create(&self, guest: Guest) -> Result<Guest, String> {
        sqlx::query!(
            "INSERT INTO guests (id, full_name, email, phone)
             VALUES ($1, $2, $3, $4)",
            guest.id,
            guest.full_name,
            guest.email,
            guest.phone
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(guest)
    }
}
