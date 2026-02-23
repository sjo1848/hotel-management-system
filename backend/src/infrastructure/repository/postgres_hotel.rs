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
            .map_err(map_db_error)?;
        Ok(hotel)
    }

    async fn find_all(&self) -> Result<Vec<Hotel>, String> {
        let records = sqlx::query("SELECT id, name, address FROM hotels ORDER BY created_at DESC")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(records
            .into_iter()
            .map(|row| Hotel {
                id: row.try_get("id").unwrap(),
                name: row.try_get("name").unwrap(),
                address: row.try_get("address").ok(),
            })
            .collect())
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

    async fn find_by_name_ci(&self, name: &str) -> Result<Option<Hotel>, String> {
        let record = sqlx::query(
            "SELECT id, name, address FROM hotels WHERE LOWER(name) = LOWER($1) LIMIT 1",
        )
        .bind(name)
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
            .map_err(map_db_error)?;
        Ok(hotel)
    }

    async fn find_plan_tier(&self, hotel_id: Uuid) -> Result<String, String> {
        let record = sqlx::query("SELECT plan_tier FROM hotels WHERE id = $1")
            .bind(hotel_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        let Some(row) = record else {
            return Err("HOTEL_NOT_FOUND".to_string());
        };

        row.try_get("plan_tier").map_err(|e| e.to_string())
    }

    async fn update_plan_tier(&self, hotel_id: Uuid, plan_tier: &str) -> Result<(), String> {
        let result = sqlx::query("UPDATE hotels SET plan_tier = $1 WHERE id = $2")
            .bind(plan_tier)
            .bind(hotel_id)
            .execute(&self.pool)
            .await
            .map_err(map_db_error)?;

        if result.rows_affected() == 0 {
            return Err("HOTEL_NOT_FOUND".to_string());
        }
        Ok(())
    }
}

fn map_db_error(error: sqlx::Error) -> String {
    if let sqlx::Error::Database(db_error) = &error {
        if let Some(code) = db_error.code() {
            if code == "23505" {
                let constraint_name = db_error.constraint().unwrap_or_default();
                if constraint_name == "ux_hotels_name_ci" || constraint_name == "hotels_name_key" {
                    return "HOTEL_ALREADY_EXISTS".to_string();
                }
            }
            if code == "23514" {
                let constraint_name = db_error.constraint().unwrap_or_default();
                if constraint_name == "ck_hotels_plan_tier" {
                    return "PLAN_TIER_INVALID".to_string();
                }
            }
        }
    }
    error.to_string()
}
