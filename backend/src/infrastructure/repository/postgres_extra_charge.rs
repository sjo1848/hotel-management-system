use crate::domain::models::ExtraCharge;
use crate::domain::repositories::ExtraChargeRepository;
use crate::infrastructure::repository::tenant_context::begin_tenant_tx;
use async_trait::async_trait;
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub struct PostgresExtraChargeRepository {
    pool: PgPool,
}

impl PostgresExtraChargeRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl ExtraChargeRepository for PostgresExtraChargeRepository {
    async fn add(&self, charge: ExtraCharge) -> Result<ExtraCharge, String> {
        let mut tx = begin_tenant_tx(&self.pool, charge.hotel_id).await?;
        sqlx::query(
            "INSERT INTO extra_charges (id, hotel_id, booking_id, description, amount_cents, category)
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(charge.id)
        .bind(charge.hotel_id)
        .bind(charge.booking_id)
        .bind(&charge.description)
        .bind(charge.amount_cents)
        .bind(&charge.category)
        .execute(&mut *tx)
        .await
        .map_err(map_db_error)?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(charge)
    }

    async fn find_by_booking(
        &self,
        hotel_id: Uuid,
        booking_id: Uuid,
    ) -> Result<Vec<ExtraCharge>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let records = sqlx::query(
            "SELECT id, hotel_id, booking_id, description, amount_cents, category, created_at 
             FROM extra_charges 
             WHERE hotel_id = $1 AND booking_id = $2 
             ORDER BY created_at ASC",
        )
        .bind(hotel_id)
        .bind(booking_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(records
            .into_iter()
            .map(|row| ExtraCharge {
                id: row.try_get("id").unwrap(),
                hotel_id: row.try_get("hotel_id").unwrap(),
                booking_id: row.try_get("booking_id").unwrap(),
                description: row.try_get("description").unwrap(),
                amount_cents: row.try_get("amount_cents").unwrap(),
                category: row
                    .try_get("category")
                    .unwrap_or_else(|_| "GENERAL".to_string()),
                created_at: row.try_get("created_at").unwrap(),
            })
            .collect())
    }

    async fn delete(&self, hotel_id: Uuid, id: Uuid) -> Result<(), String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        sqlx::query("DELETE FROM extra_charges WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn map_db_error(error: sqlx::Error) -> String {
    if let sqlx::Error::Database(db_error) = &error {
        if let Some(code) = db_error.code() {
            if code == "23503" {
                let constraint_name = db_error.constraint().unwrap_or_default();
                if constraint_name == "fk_extra_charges_hotel_booking" {
                    return "EXTRA_CHARGE_BOOKING_NOT_FOUND".to_string();
                }
                if constraint_name == "extra_charges_hotel_id_fkey" {
                    return "EXTRA_CHARGE_HOTEL_NOT_FOUND".to_string();
                }
            }
        }
    }
    error.to_string()
}
