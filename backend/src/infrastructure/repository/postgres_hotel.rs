use crate::domain::models::{Hotel, PlanTier};
use crate::domain::repositories::HotelRepository;
use async_trait::async_trait;
use sqlx::{postgres::PgRow, PgPool, Row};
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
        sqlx::query("INSERT INTO hotels (id, name, address, plan_tier) VALUES ($1, $2, $3, $4)")
            .bind(hotel.id)
            .bind(&hotel.name)
            .bind(&hotel.address)
            .bind(hotel.plan_tier.as_db_value())
            .execute(&self.pool)
            .await
            .map_err(map_db_error)?;
        Ok(hotel)
    }

    async fn find_all(&self) -> Result<Vec<Hotel>, String> {
        let records =
            sqlx::query("SELECT id, name, address, plan_tier FROM hotels ORDER BY created_at DESC")
                .fetch_all(&self.pool)
                .await
                .map_err(|e| e.to_string())?;

        records
            .into_iter()
            .map(hotel_from_row)
            .collect::<Result<Vec<_>, String>>()
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<Hotel>, String> {
        let record = sqlx::query("SELECT id, name, address, plan_tier FROM hotels WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        record.map(hotel_from_row).transpose()
    }

    async fn find_by_name_ci(&self, name: &str) -> Result<Option<Hotel>, String> {
        let record = sqlx::query(
            "SELECT id, name, address, plan_tier FROM hotels WHERE LOWER(name) = LOWER($1) LIMIT 1",
        )
        .bind(name)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        record.map(hotel_from_row).transpose()
    }

    async fn update(&self, hotel: Hotel) -> Result<Hotel, String> {
        let affected = sqlx::query("UPDATE hotels SET name = $1, address = $2 WHERE id = $3")
            .bind(&hotel.name)
            .bind(&hotel.address)
            .bind(hotel.id)
            .execute(&self.pool)
            .await
            .map_err(map_db_error)?;
        if affected.rows_affected() == 0 {
            return Err("HOTEL_NOT_FOUND".to_string());
        }
        Ok(hotel)
    }

    async fn update_plan_tier(&self, id: Uuid, plan_tier: PlanTier) -> Result<Hotel, String> {
        let record = sqlx::query(
            "UPDATE hotels SET plan_tier = $1 WHERE id = $2 RETURNING id, name, address, plan_tier",
        )
        .bind(plan_tier.as_db_value())
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_db_error)?;

        let row = record.ok_or_else(|| "HOTEL_NOT_FOUND".to_string())?;
        hotel_from_row(row)
    }
}

fn hotel_from_row(row: PgRow) -> Result<Hotel, String> {
    let plan_tier_raw = row
        .try_get::<String, _>("plan_tier")
        .map_err(|error| error.to_string())?;
    let plan_tier = PlanTier::parse_input(&plan_tier_raw)
        .ok_or_else(|| format!("Invalid plan_tier stored in DB: {plan_tier_raw}"))?;

    let id = row.try_get("id").map_err(|error| error.to_string())?;
    let name = row.try_get("name").map_err(|error| error.to_string())?;
    let address = row
        .try_get::<Option<String>, _>("address")
        .map_err(|error| error.to_string())?;

    Ok(Hotel {
        id,
        name,
        address,
        plan_tier,
    })
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
                    return "INVALID_PLAN_TIER".to_string();
                }
            }
        }
    }
    error.to_string()
}
