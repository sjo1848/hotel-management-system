use crate::domain::models::Hotel;
use crate::domain::repositories::HotelRepository;
use async_trait::async_trait;
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub struct PostgresHotelRepository {
    pool: PgPool,
}

impl PostgresHotelRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl HotelRepository for PostgresHotelRepository {
    async fn create(&self, hotel: Hotel) -> Result<Hotel, String> {
        sqlx::query("INSERT INTO hotels (id, name, address) VALUES ($1, $2, $3)")
            .bind(hotel.id)
            .bind(&hotel.name)
            .bind(&hotel.address)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(hotel)
    }

    async fn find_all(&self) -> Result<Vec<Hotel>, String> {
        let records = sqlx::query("SELECT id, name, address FROM hotels ORDER BY created_at DESC")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(records.into_iter().map(|row| Hotel {
            id: row.try_get("id").unwrap(),
            name: row.try_get("name").unwrap(),
            address: row.try_get("address").ok(),
        }).collect())
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<Hotel>, String> {
        let record = sqlx::query("SELECT id, name, address FROM hotels WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(record.map(|row| Hotel {
            id: row.try_get("id").unwrap(),
            name: row.try_get("name").unwrap(),
            address: row.try_get("address").ok(),
        }))
    }

    async fn update(&self, hotel: Hotel) -> Result<Hotel, String> {
        sqlx::query("UPDATE hotels SET name = $1, address = $2 WHERE id = $3")
            .bind(&hotel.name)
            .bind(&hotel.address)
            .bind(hotel.id)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(hotel)
    }
}
