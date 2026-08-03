use crate::domain::models::{Invoice, InvoiceStatus, PaymentMethod};
use crate::domain::repositories::InvoiceRepository;
use crate::infrastructure::repository::tenant_context::begin_tenant_tx;
use async_trait::async_trait;
use chrono::Utc;
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

fn invoice_status_to_db(status: &InvoiceStatus) -> &'static str {
    match status {
        InvoiceStatus::Pending => "PENDING",
        InvoiceStatus::Paid => "PAID",
        InvoiceStatus::Voided => "VOIDED",
    }
}

fn payment_method_to_db(payment_method: &PaymentMethod) -> &'static str {
    match payment_method {
        PaymentMethod::Cash => "CASH",
        PaymentMethod::Card => "CARD",
        PaymentMethod::Transfer => "TRANSFER",
    }
}

fn parse_invoice(row: sqlx::postgres::PgRow) -> Invoice {
    let status_str: String = row.try_get("status").unwrap();
    let pm_str: String = row
        .try_get("payment_method")
        .unwrap_or_else(|_| "CASH".to_string());
    Invoice {
        id: row.try_get("id").unwrap(),
        hotel_id: row.try_get("hotel_id").unwrap(),
        booking_id: row.try_get("booking_id").unwrap(),
        amount_cents: row.try_get("amount_cents").unwrap(),
        paid_amount_cents: row.try_get("paid_amount_cents").unwrap_or(0),
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
        payment_reference: row.try_get("payment_reference").ok(),
        paid_at: row.try_get("paid_at").ok(),
        created_at: row.try_get("created_at").unwrap(),
    }
}

#[async_trait]
impl InvoiceRepository for PostgresInvoiceRepository {
    async fn save(&self, invoice: Invoice) -> Result<Invoice, String> {
        let mut tx = begin_tenant_tx(&self.pool, invoice.hotel_id).await?;
        sqlx::query(
            "INSERT INTO invoices (
                id, hotel_id, booking_id, amount_cents, paid_amount_cents, status, payment_method, payment_reference, paid_at, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
        )
        .bind(invoice.id)
        .bind(invoice.hotel_id)
        .bind(invoice.booking_id)
        .bind(invoice.amount_cents)
        .bind(invoice.paid_amount_cents)
        .bind(invoice_status_to_db(&invoice.status))
        .bind(payment_method_to_db(&invoice.payment_method))
        .bind(&invoice.payment_reference)
        .bind(invoice.paid_at)
        .bind(invoice.created_at)
        .execute(&mut *tx)
        .await
        .map_err(map_db_error)?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(invoice)
    }

    async fn update(&self, invoice: Invoice) -> Result<Invoice, String> {
        let mut tx = begin_tenant_tx(&self.pool, invoice.hotel_id).await?;
        sqlx::query(
            "UPDATE invoices
             SET amount_cents = $1,
                 paid_amount_cents = $2,
                 status = $3,
                 payment_method = $4,
                 payment_reference = $5,
                 paid_at = $6
             WHERE hotel_id = $7 AND id = $8",
        )
        .bind(invoice.amount_cents)
        .bind(invoice.paid_amount_cents)
        .bind(invoice_status_to_db(&invoice.status))
        .bind(payment_method_to_db(&invoice.payment_method))
        .bind(&invoice.payment_reference)
        .bind(invoice.paid_at)
        .bind(invoice.hotel_id)
        .bind(invoice.id)
        .execute(&mut *tx)
        .await
        .map_err(map_db_error)?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(invoice)
    }

    async fn settle_by_booking(
        &self,
        hotel_id: Uuid,
        booking_id: Uuid,
        amount_cents: i64,
        payment_method: PaymentMethod,
        payment_reference: Option<String>,
        paid_at: chrono::NaiveDateTime,
    ) -> Result<Invoice, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let existing = sqlx::query(
            "SELECT id, hotel_id, booking_id, amount_cents, paid_amount_cents, status, payment_method, payment_reference, paid_at, created_at
             FROM invoices
             WHERE hotel_id = $1 AND booking_id = $2
             ORDER BY created_at DESC
             LIMIT 1",
        )
        .bind(hotel_id)
        .bind(booking_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        let invoice = if let Some(row) = existing {
            let current = parse_invoice(row);
            if current.status == InvoiceStatus::Paid {
                return Err("INVOICE_ALREADY_PAID".to_string());
            }

            sqlx::query(
                "UPDATE invoices
                 SET amount_cents = $1,
                     status = 'PAID',
                     payment_method = $2,
                     payment_reference = $3,
                     paid_at = $4
                 WHERE hotel_id = $5 AND id = $6",
            )
            .bind(amount_cents)
            .bind(payment_method_to_db(&payment_method))
            .bind(&payment_reference)
            .bind(paid_at)
            .bind(hotel_id)
            .bind(current.id)
            .execute(&mut *tx)
            .await
            .map_err(map_db_error)?;

            Invoice {
                id: current.id,
                hotel_id,
                booking_id,
                amount_cents,
                paid_amount_cents: amount_cents,
                status: InvoiceStatus::Paid,
                payment_method,
                payment_reference,
                paid_at: Some(paid_at),
                created_at: current.created_at,
            }
        } else {
            let invoice = Invoice {
                id: Uuid::new_v4(),
                hotel_id,
                booking_id,
                amount_cents,
                paid_amount_cents: amount_cents,
                status: InvoiceStatus::Paid,
                payment_method,
                payment_reference,
                paid_at: Some(paid_at),
                created_at: chrono::Utc::now().naive_utc(),
            };

            sqlx::query(
                "INSERT INTO invoices (
                    id, hotel_id, booking_id, amount_cents, paid_amount_cents, status, payment_method, payment_reference, paid_at, created_at
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
            )
            .bind(invoice.id)
            .bind(invoice.hotel_id)
            .bind(invoice.booking_id)
            .bind(invoice.amount_cents)
            .bind(invoice.paid_amount_cents)
            .bind("PAID")
            .bind(payment_method_to_db(&invoice.payment_method))
            .bind(&invoice.payment_reference)
            .bind(invoice.paid_at)
            .bind(invoice.created_at)
            .execute(&mut *tx)
            .await
            .map_err(map_db_error)?;

            invoice
        };

        tx.commit().await.map_err(|e| e.to_string())?;
        Ok(invoice)
    }

    async fn find_by_booking(
        &self,
        hotel_id: Uuid,
        booking_id: Uuid,
    ) -> Result<Option<Invoice>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let record = sqlx::query(
            "SELECT id, hotel_id, booking_id, amount_cents, paid_amount_cents, status, payment_method, payment_reference, paid_at, created_at
             FROM invoices WHERE hotel_id = $1 AND booking_id = $2",
        )
        .bind(hotel_id)
        .bind(booking_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(record.map(parse_invoice))
    }

    async fn find_all(&self, hotel_id: Uuid) -> Result<Vec<Invoice>, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let records = sqlx::query(
            "SELECT id, hotel_id, booking_id, amount_cents, paid_amount_cents, status, payment_method, payment_reference, paid_at, created_at
             FROM invoices WHERE hotel_id = $1 ORDER BY created_at DESC",
        )
        .bind(hotel_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(records.into_iter().map(parse_invoice).collect())
    }

    async fn get_unclosed_total(&self, hotel_id: Uuid) -> Result<(i64, i64, i64), String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        // Use UNIX epoch when there is no prior closure, but do not hide DB failures.
        let start_time = sqlx::query_scalar::<_, Option<chrono::DateTime<Utc>>>(
            "SELECT MAX(closing_time) as last_time FROM cash_closures WHERE hotel_id = $1",
        )
        .bind(hotel_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| chrono::DateTime::<Utc>::from_timestamp(0, 0).unwrap());

        let result = sqlx::query(
            "SELECT 
                COALESCE(SUM(amount_cents), 0)::BIGINT as total,
                COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN amount_cents ELSE 0 END), 0)::BIGINT as cash,
                COALESCE(SUM(CASE WHEN payment_method <> 'CASH' THEN amount_cents ELSE 0 END), 0)::BIGINT as card
             FROM invoices 
             WHERE hotel_id = $1 AND status = 'PAID' AND COALESCE(paid_at, created_at) > $2"
        )
        .bind(hotel_id)
        .bind(start_time)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        tx.commit().await.map_err(|e| e.to_string())?;

        Ok((
            result.try_get("total").map_err(|e| e.to_string())?,
            result.try_get("cash").map_err(|e| e.to_string())?,
            result.try_get("card").map_err(|e| e.to_string())?,
        ))
    }

    async fn get_outstanding_summary(&self, hotel_id: Uuid) -> Result<(i64, i64), String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let row = sqlx::query(
            "SELECT
                COALESCE(SUM(GREATEST(amount_cents - paid_amount_cents, 0)), 0)::BIGINT AS pending_amount_cents,
                COUNT(*) FILTER (WHERE GREATEST(amount_cents - paid_amount_cents, 0) > 0)::BIGINT AS pending_bookings_count
             FROM invoices
             WHERE hotel_id = $1 AND status <> 'VOIDED'",
        )
        .bind(hotel_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok((
            row.try_get("pending_amount_cents")
                .map_err(|e| e.to_string())?,
            row.try_get("pending_bookings_count")
                .map_err(|e| e.to_string())?,
        ))
    }
}

fn map_db_error(error: sqlx::Error) -> String {
    if let sqlx::Error::Database(db_error) = &error {
        if let Some(code) = db_error.code() {
            if code == "23503" {
                let constraint_name = db_error.constraint().unwrap_or_default();
                if constraint_name == "fk_invoices_hotel_booking" {
                    return "INVOICE_BOOKING_NOT_FOUND".to_string();
                }
                if constraint_name == "invoices_hotel_id_fkey" {
                    return "INVOICE_HOTEL_NOT_FOUND".to_string();
                }
            }
        }
    }
    error.to_string()
}
