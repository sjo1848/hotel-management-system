use crate::domain::models::{PaymentEntry, PaymentMethod};
use crate::domain::repositories::PaymentEntryRepository;
use crate::infrastructure::repository::tenant_context::begin_tenant_tx;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub struct PostgresPaymentEntryRepository {
    pool: PgPool,
}

impl PostgresPaymentEntryRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

fn payment_method_to_db(payment_method: &PaymentMethod) -> &'static str {
    match payment_method {
        PaymentMethod::Cash => "CASH",
        PaymentMethod::Card => "CARD",
        PaymentMethod::Transfer => "TRANSFER",
    }
}

fn parse_payment_method(value: &str) -> PaymentMethod {
    match value {
        "CARD" => PaymentMethod::Card,
        "TRANSFER" => PaymentMethod::Transfer,
        _ => PaymentMethod::Cash,
    }
}

fn parse_payment_entry(row: sqlx::postgres::PgRow) -> PaymentEntry {
    let payment_method: String = row
        .try_get("payment_method")
        .unwrap_or_else(|_| "CASH".to_string());
    let received_at = row
        .try_get::<DateTime<Utc>, _>("received_at")
        .unwrap()
        .naive_utc();

    PaymentEntry {
        id: row.try_get("id").unwrap(),
        hotel_id: row.try_get("hotel_id").unwrap(),
        invoice_id: row.try_get("invoice_id").unwrap(),
        booking_id: row.try_get("booking_id").unwrap(),
        amount_cents: row.try_get("amount_cents").unwrap(),
        payment_method: parse_payment_method(payment_method.as_str()),
        payment_reference: row.try_get("payment_reference").ok(),
        note: row.try_get("note").ok(),
        received_by_user_id: row.try_get("received_by_user_id").ok(),
        received_at,
    }
}

#[async_trait]
impl PaymentEntryRepository for PostgresPaymentEntryRepository {
    async fn add(&self, mut entry: PaymentEntry) -> Result<PaymentEntry, String> {
        let mut tx = begin_tenant_tx(&self.pool, entry.hotel_id).await?;
        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))")
            .bind(entry.hotel_id)
            .execute(&mut *tx)
            .await
            .map_err(|error| error.to_string())?;
        let shift_floor = sqlx::query_scalar::<_, Option<DateTime<Utc>>>(
            "SELECT MAX(closing_time) FROM cash_closures WHERE hotel_id = $1",
        )
        .bind(entry.hotel_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|error| error.to_string())?
        .map(|value| value.naive_utc());
        if let Some(floor) = shift_floor {
            if entry.received_at <= floor {
                entry.received_at = floor + chrono::Duration::microseconds(1);
            }
        }
        sqlx::query(
            "INSERT INTO payment_entries (
                id, hotel_id, invoice_id, booking_id, amount_cents, payment_method,
                payment_reference, note, received_by_user_id, received_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        )
        .bind(entry.id)
        .bind(entry.hotel_id)
        .bind(entry.invoice_id)
        .bind(entry.booking_id)
        .bind(entry.amount_cents)
        .bind(payment_method_to_db(&entry.payment_method))
        .bind(&entry.payment_reference)
        .bind(&entry.note)
        .bind(entry.received_by_user_id)
        .bind(entry.received_at)
        .execute(&mut *tx)
        .await
        .map_err(map_db_error)?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(entry)
    }

    async fn find_by_booking(
        &self,
        hotel_id: Uuid,
        booking_id: Uuid,
    ) -> Result<Vec<PaymentEntry>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let rows = sqlx::query(
            "SELECT id, hotel_id, invoice_id, booking_id, amount_cents, payment_method,
                    payment_reference, note, received_by_user_id, received_at
             FROM payment_entries
             WHERE hotel_id = $1 AND booking_id = $2
             ORDER BY received_at DESC, created_at DESC",
        )
        .bind(hotel_id)
        .bind(booking_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(rows.into_iter().map(parse_payment_entry).collect())
    }

    async fn get_unclosed_summary(
        &self,
        hotel_id: Uuid,
        opening_time: chrono::NaiveDateTime,
    ) -> Result<(i64, i64, i64, i64), String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let row = sqlx::query(
            "SELECT
                COALESCE(SUM(amount_cents), 0)::BIGINT AS total,
                COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN amount_cents ELSE 0 END), 0)::BIGINT AS cash,
                COALESCE(SUM(CASE WHEN payment_method <> 'CASH' THEN amount_cents ELSE 0 END), 0)::BIGINT AS card,
                COUNT(*)::BIGINT AS payment_count
             FROM payment_entries
             WHERE hotel_id = $1 AND received_at >= $2",
        )
        .bind(hotel_id)
        .bind(opening_time)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok((
            row.try_get("total").map_err(|e| e.to_string())?,
            row.try_get("cash").map_err(|e| e.to_string())?,
            row.try_get("card").map_err(|e| e.to_string())?,
            row.try_get("payment_count").map_err(|e| e.to_string())?,
        ))
    }

    async fn get_earliest_unclosed_payment_at(
        &self,
        hotel_id: Uuid,
        opening_time: chrono::NaiveDateTime,
    ) -> Result<Option<chrono::NaiveDateTime>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let received_at = sqlx::query_scalar::<_, Option<DateTime<Utc>>>(
            "SELECT MIN(received_at)
             FROM payment_entries
             WHERE hotel_id = $1 AND received_at > $2",
        )
        .bind(hotel_id)
        .bind(opening_time)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(received_at.map(|value| value.naive_utc()))
    }
}

fn map_db_error(error: sqlx::Error) -> String {
    if let sqlx::Error::Database(db_error) = &error {
        if let Some(code) = db_error.code() {
            if code == "23503" {
                let constraint_name = db_error.constraint().unwrap_or_default();
                if constraint_name == "fk_payment_entries_hotel_invoice" {
                    return "PAYMENT_ENTRY_INVOICE_NOT_FOUND".to_string();
                }
                if constraint_name == "fk_payment_entries_hotel_booking" {
                    return "PAYMENT_ENTRY_BOOKING_NOT_FOUND".to_string();
                }
                if constraint_name == "fk_payment_entries_hotel_user" {
                    return "PAYMENT_ENTRY_USER_NOT_FOUND".to_string();
                }
            }
        }
    }
    error.to_string()
}
