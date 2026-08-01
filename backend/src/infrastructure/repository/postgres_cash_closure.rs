use crate::domain::models::CashClosure;
use crate::domain::repositories::CashClosureRepository;
use crate::infrastructure::repository::tenant_context::begin_tenant_tx;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
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

fn parse_cash_closure(row: sqlx::postgres::PgRow) -> CashClosure {
    let opening_time = row
        .try_get::<DateTime<Utc>, _>("opening_time")
        .unwrap()
        .naive_utc();
    let closing_time = row
        .try_get::<DateTime<Utc>, _>("closing_time")
        .unwrap()
        .naive_utc();

    CashClosure {
        id: row.try_get("id").unwrap(),
        hotel_id: row.try_get("hotel_id").unwrap(),
        user_id: row.try_get("user_id").unwrap(),
        total_amount_cents: row.try_get("total_amount_cents").unwrap(),
        cash_amount_cents: row.try_get("cash_amount_cents").unwrap(),
        card_amount_cents: row.try_get("card_amount_cents").unwrap(),
        payment_count: row.try_get("payment_count").unwrap_or(0),
        counted_cash_amount_cents: row
            .try_get("counted_cash_amount_cents")
            .unwrap_or_else(|_| row.try_get("cash_amount_cents").unwrap_or(0)),
        cash_difference_cents: row.try_get("cash_difference_cents").unwrap_or(0),
        opening_time,
        closing_time,
        handoff_to: row
            .try_get("handoff_to")
            .unwrap_or_else(|_| "Siguiente turno".to_string()),
        notes: row.try_get("notes").ok(),
    }
}

#[async_trait]
impl CashClosureRepository for PostgresCashClosureRepository {
    async fn create(&self, mut closure: CashClosure) -> Result<CashClosure, String> {
        let mut tx = begin_tenant_tx(&self.pool, closure.hotel_id).await?;
        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))")
            .bind(closure.hotel_id)
            .execute(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;

        let latest_closing_time = sqlx::query_scalar::<_, Option<DateTime<Utc>>>(
            "SELECT MAX(closing_time) FROM cash_closures WHERE hotel_id = $1",
        )
        .bind(closure.hotel_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|error| error.to_string())?
        .map(|value| value.naive_utc());
        if latest_closing_time.is_some_and(|latest| latest > closure.opening_time) {
            return Err("CASH_SHIFT_ALREADY_CLOSED".to_string());
        }

        let expected_total = closure.total_amount_cents;
        let expected_cash = closure.cash_amount_cents;
        let expected_card = closure.card_amount_cents;
        let expected_payment_count = closure.payment_count;
        let summary = sqlx::query(
            "SELECT
                COALESCE(SUM(amount_cents), 0)::BIGINT AS total,
                COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN amount_cents ELSE 0 END), 0)::BIGINT AS cash,
                COALESCE(SUM(CASE WHEN payment_method <> 'CASH' THEN amount_cents ELSE 0 END), 0)::BIGINT AS card,
                COUNT(*)::BIGINT AS payment_count
             FROM payment_entries
             WHERE hotel_id = $1 AND received_at >= $2 AND received_at <= $3",
        )
        .bind(closure.hotel_id)
        .bind(closure.opening_time)
        .bind(closure.closing_time)
        .fetch_one(&mut *tx)
        .await
        .map_err(|error| error.to_string())?;
        let actual_total = summary
            .try_get("total")
            .map_err(|error| error.to_string())?;
        let actual_cash = summary.try_get("cash").map_err(|error| error.to_string())?;
        let actual_card = summary.try_get("card").map_err(|error| error.to_string())?;
        let actual_payment_count = summary
            .try_get("payment_count")
            .map_err(|error| error.to_string())?;
        if (
            expected_total,
            expected_cash,
            expected_card,
            expected_payment_count,
        ) != (actual_total, actual_cash, actual_card, actual_payment_count)
        {
            return Err("CASH_SHIFT_BALANCE_CHANGED".to_string());
        }
        closure.total_amount_cents = actual_total;
        closure.cash_amount_cents = actual_cash;
        closure.card_amount_cents = actual_card;
        closure.payment_count = actual_payment_count;
        closure.cash_difference_cents =
            closure.counted_cash_amount_cents - closure.cash_amount_cents;

        sqlx::query(
            "INSERT INTO cash_closures (
                id, hotel_id, user_id, total_amount_cents, cash_amount_cents,
                card_amount_cents, payment_count, counted_cash_amount_cents,
                cash_difference_cents, opening_time, closing_time, handoff_to, notes
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
        )
        .bind(closure.id)
        .bind(closure.hotel_id)
        .bind(closure.user_id)
        .bind(closure.total_amount_cents)
        .bind(closure.cash_amount_cents)
        .bind(closure.card_amount_cents)
        .bind(closure.payment_count)
        .bind(closure.counted_cash_amount_cents)
        .bind(closure.cash_difference_cents)
        .bind(closure.opening_time)
        .bind(closure.closing_time)
        .bind(&closure.handoff_to)
        .bind(&closure.notes)
        .execute(&mut *tx)
        .await
        .map_err(map_db_error)?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(closure)
    }

    async fn find_all(&self, hotel_id: Uuid) -> Result<Vec<CashClosure>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let records = sqlx::query(
            "SELECT id, hotel_id, user_id, total_amount_cents, cash_amount_cents, card_amount_cents, payment_count,
                    counted_cash_amount_cents, cash_difference_cents, opening_time, closing_time, handoff_to, notes
             FROM cash_closures WHERE hotel_id = $1 ORDER BY closing_time DESC",
        )
        .bind(hotel_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(records.into_iter().map(parse_cash_closure).collect())
    }

    async fn find_latest(&self, hotel_id: Uuid) -> Result<Option<CashClosure>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let row = sqlx::query(
            "SELECT id, hotel_id, user_id, total_amount_cents, cash_amount_cents, card_amount_cents, payment_count,
                    counted_cash_amount_cents, cash_difference_cents, opening_time, closing_time, handoff_to, notes
             FROM cash_closures
             WHERE hotel_id = $1
             ORDER BY closing_time DESC
             LIMIT 1",
        )
        .bind(hotel_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(row.map(parse_cash_closure))
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
