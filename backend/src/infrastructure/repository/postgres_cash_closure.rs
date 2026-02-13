use crate::domain::models::CashClosure;
use crate::domain::repositories::CashClosureRepository;
use async_trait::async_trait;
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub struct PostgresCashClosureRepository {
    pool: PgPool,
}

impl PostgresCashClosureRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl CashClosureRepository for PostgresCashClosureRepository {
    async fn create(&self, closure: CashClosure) -> Result<CashClosure, String> {
        sqlx::query(
            "INSERT INTO cash_closures (id, hotel_id, user_id, total_amount_cents, cash_amount_cents, card_amount_cents, opening_time, closing_time, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        )
        .bind(closure.id)
        .bind(closure.hotel_id)
        .bind(closure.user_id)
        .bind(closure.total_amount_cents)
        .bind(closure.cash_amount_cents)
        .bind(closure.card_amount_cents)
        .bind(closure.opening_time)
        .bind(closure.closing_time)
        .bind(&closure.notes)
        .execute(&self.pool)
        .await
        .map_err(map_db_error)?;

        Ok(closure)
    }

    async fn find_all(&self, hotel_id: Uuid) -> Result<Vec<CashClosure>, String> {
        let records = sqlx::query(
            "SELECT id, hotel_id, user_id, total_amount_cents, cash_amount_cents, card_amount_cents, opening_time, closing_time, notes 
             FROM cash_closures WHERE hotel_id = $1 ORDER BY closing_time DESC",
        )
        .bind(hotel_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(records
            .into_iter()
            .map(|row| CashClosure {
                id: row.try_get("id").unwrap(),
                hotel_id: row.try_get("hotel_id").unwrap(),
                user_id: row.try_get("user_id").unwrap(),
                total_amount_cents: row.try_get("total_amount_cents").unwrap(),
                cash_amount_cents: row.try_get("cash_amount_cents").unwrap(),
                card_amount_cents: row.try_get("card_amount_cents").unwrap(),
                opening_time: row.try_get("opening_time").unwrap(),
                closing_time: row.try_get("closing_time").unwrap(),
                notes: row.try_get("notes").ok(),
            })
            .collect())
    }
}

fn map_db_error(error: sqlx::Error) -> String {
    if let sqlx::Error::Database(db_error) = &error {
        if let Some(code) = db_error.code() {
            if code == "23503" {
                let constraint_name = db_error.constraint().unwrap_or_default();
                if constraint_name == "fk_cash_closures_hotel_user" {
                    return "CASH_CLOSURE_USER_NOT_FOUND".to_string();
                }
                if constraint_name == "cash_closures_hotel_id_fkey" {
                    return "CASH_CLOSURE_HOTEL_NOT_FOUND".to_string();
                }
            }
        }
    }
    error.to_string()
}
