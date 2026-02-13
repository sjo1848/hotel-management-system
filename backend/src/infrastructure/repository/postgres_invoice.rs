use crate::domain::models::{Invoice, InvoiceStatus, PaymentMethod};
use crate::domain::repositories::InvoiceRepository;
use async_trait::async_trait;
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub struct PostgresInvoiceRepository {
    pool: PgPool,
}

impl PostgresInvoiceRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl InvoiceRepository for PostgresInvoiceRepository {
    async fn save(&self, invoice: Invoice) -> Result<Invoice, String> {
        let status = match invoice.status {
            InvoiceStatus::Pending => "PENDING",
            InvoiceStatus::Paid => "PAID",
            InvoiceStatus::Voided => "VOIDED",
        };

        let payment_method = match invoice.payment_method {
            PaymentMethod::Cash => "CASH",
            PaymentMethod::Card => "CARD",
            PaymentMethod::Transfer => "TRANSFER",
        };

        sqlx::query(
            "INSERT INTO invoices (id, hotel_id, booking_id, amount_cents, status, payment_method, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(invoice.id)
        .bind(invoice.hotel_id)
        .bind(invoice.booking_id)
        .bind(invoice.amount_cents)
        .bind(status)
        .bind(payment_method)
        .bind(invoice.created_at)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(invoice)
    }

    async fn find_by_booking(&self, hotel_id: Uuid, booking_id: Uuid) -> Result<Option<Invoice>, String> {
        let record = sqlx::query(
            "SELECT id, hotel_id, booking_id, amount_cents, status, created_at FROM invoices WHERE hotel_id = $1 AND booking_id = $2",
        )
        .bind(hotel_id)
        .bind(booking_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(record.map(|row| {
            let status_str: String = row.try_get("status").unwrap();
            let pm_str: String = row.try_get("payment_method").unwrap_or_else(|_| "CASH".to_string());
            Invoice {
                id: row.try_get("id").unwrap(),
                hotel_id: row.try_get("hotel_id").unwrap(),
                booking_id: row.try_get("booking_id").unwrap(),
                amount_cents: row.try_get("amount_cents").unwrap(),
                status: match status_str.as_str() {
                    "PAID" => InvoiceStatus::Paid,
                    "VOIDED" => InvoiceStatus::Voided,
                    _ => InvoiceStatus::Pending,
                },
                payment_method: match pm_str.as_str() {
                    "CARD" => PaymentMethod::Card,
                    "TRANSFER" => PaymentMethod::Transfer,
                    _ => PaymentMethod::Cash,
                },
                created_at: row.try_get("created_at").unwrap(),
            }
        }))
    }

    async fn find_all(&self, hotel_id: Uuid) -> Result<Vec<Invoice>, String> {
        let records = sqlx::query(
            "SELECT id, hotel_id, booking_id, amount_cents, status, payment_method, created_at FROM invoices WHERE hotel_id = $1 ORDER BY created_at DESC",
        )
        .bind(hotel_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(records
            .into_iter()
            .map(|row| {
                let status_str: String = row.try_get("status").unwrap();
                let pm_str: String = row.try_get("payment_method").unwrap_or_else(|_| "CASH".to_string());
                Invoice {
                    id: row.try_get("id").unwrap(),
                    hotel_id: row.try_get("hotel_id").unwrap(),
                    booking_id: row.try_get("booking_id").unwrap(),
                    amount_cents: row.try_get("amount_cents").unwrap(),
                    status: match status_str.as_str() {
                        "PAID" => InvoiceStatus::Paid,
                        "VOIDED" => InvoiceStatus::Voided,
                        _ => InvoiceStatus::Pending,
                    },
                    payment_method: match pm_str.as_str() {
                        "CARD" => PaymentMethod::Card,
                        "TRANSFER" => PaymentMethod::Transfer,
                        _ => PaymentMethod::Cash,
                    },
                    created_at: row.try_get("created_at").unwrap(),
                }
            })
            .collect())
    }

    async fn get_unclosed_total(&self, hotel_id: Uuid) -> Result<(i64, i64, i64), String> {
        // Obtenemos facturas pagadas después del último cierre de caja
        let last_closure_time = sqlx::query("SELECT MAX(closing_time) as last_time FROM cash_closures WHERE hotel_id = $1")
            .bind(hotel_id)
            .fetch_one(&self.pool)
            .await;
        
        let start_time = match last_closure_time {
            Ok(row) => row.try_get("last_time").unwrap_or(chrono::NaiveDateTime::MIN),
            Err(_) => chrono::NaiveDateTime::MIN,
        };

        let result = sqlx::query(
            "SELECT 
                COALESCE(SUM(amount_cents), 0) as total,
                COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN amount_cents ELSE 0 END), 0) as cash,
                COALESCE(SUM(CASE WHEN payment_method = 'CARD' THEN amount_cents ELSE 0 END), 0) as card
             FROM invoices 
             WHERE hotel_id = $1 AND status = 'PAID' AND created_at > $2"
        )
        .bind(hotel_id)
        .bind(start_time)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok((
            result.try_get("total").unwrap_or(0),
            result.try_get("cash").unwrap_or(0),
            result.try_get("card").unwrap_or(0)
        ))
    }
}
