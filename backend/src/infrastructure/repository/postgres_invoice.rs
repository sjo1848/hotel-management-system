use crate::domain::models::{Invoice, InvoiceStatus};
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

        sqlx::query(
            "INSERT INTO invoices (id, booking_id, amount_cents, status, created_at)
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(invoice.id)
        .bind(invoice.booking_id)
        .bind(invoice.amount_cents)
        .bind(status)
        .bind(invoice.created_at)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(invoice)
    }

    async fn find_by_booking(&self, booking_id: Uuid) -> Result<Option<Invoice>, String> {
        let record = sqlx::query(
            "SELECT id, booking_id, amount_cents, status, created_at FROM invoices WHERE booking_id = $1",
        )
        .bind(booking_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(record.map(|row| {
            let status_str: String = row.try_get("status").unwrap();
            Invoice {
                id: row.try_get("id").unwrap(),
                booking_id: row.try_get("booking_id").unwrap(),
                amount_cents: row.try_get("amount_cents").unwrap(),
                status: match status_str.as_str() {
                    "PAID" => InvoiceStatus::Paid,
                    "VOIDED" => InvoiceStatus::Voided,
                    _ => InvoiceStatus::Pending,
                },
                created_at: row.try_get("created_at").unwrap(),
            }
        }))
    }

    async fn find_all(&self) -> Result<Vec<Invoice>, String> {
        let records = sqlx::query(
            "SELECT id, booking_id, amount_cents, status, created_at FROM invoices ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let invoices = records
            .into_iter()
            .map(|row| {
                let status_str: String = row.try_get("status").unwrap();
                Invoice {
                    id: row.try_get("id").unwrap(),
                    booking_id: row.try_get("booking_id").unwrap(),
                    amount_cents: row.try_get("amount_cents").unwrap(),
                    status: match status_str.as_str() {
                        "PAID" => InvoiceStatus::Paid,
                        "VOIDED" => InvoiceStatus::Voided,
                        _ => InvoiceStatus::Pending,
                    },
                    created_at: row.try_get("created_at").unwrap(),
                }
            })
            .collect();

        Ok(invoices)
    }
}
