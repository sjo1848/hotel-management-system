use crate::domain::models::{
    BookingPageCursor, Invoice, InvoicePage, InvoiceStatus, PaymentMethod,
};
use crate::domain::repositories::InvoiceRepository;
use crate::infrastructure::repository::tenant_context::begin_tenant_tx;
use async_trait::async_trait;
use chrono::{NaiveDateTime, Utc};
use sqlx::{PgPool, Postgres, QueryBuilder, Row};
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
        let mut tx = begin_tenant_tx(&self.pool, invoice.hotel_id).await?;
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
        .execute(&mut *tx)
        .await
        .map_err(map_db_error)?;
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
            "SELECT id, hotel_id, booking_id, amount_cents, status, created_at FROM invoices WHERE hotel_id = $1 AND booking_id = $2",
        )
        .bind(hotel_id)
        .bind(booking_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(record.map(|row| {
            let status_str: String = row.try_get("status").unwrap();
            let pm_str: String = row
                .try_get("payment_method")
                .unwrap_or_else(|_| "CASH".to_string());
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
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let records = sqlx::query(
            "SELECT id, hotel_id, booking_id, amount_cents, status, payment_method, created_at FROM invoices WHERE hotel_id = $1 ORDER BY created_at DESC",
        )
        .bind(hotel_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(records
            .into_iter()
            .map(|row| {
                let status_str: String = row.try_get("status").unwrap();
                let pm_str: String = row
                    .try_get("payment_method")
                    .unwrap_or_else(|_| "CASH".to_string());
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

    async fn find_page(
        &self,
        hotel_id: Uuid,
        limit: usize,
        cursor: Option<BookingPageCursor>,
    ) -> Result<InvoicePage, String> {
        let mut tx = begin_tenant_tx(&self.pool, hotel_id).await?;
        let safe_limit = limit.clamp(1, 100);
        let fetch_limit = (safe_limit + 1) as i64;

        let mut query = QueryBuilder::<Postgres>::new(
            "SELECT id, hotel_id, booking_id, amount_cents, status, payment_method, created_at,
                    created_at AS created_at_cursor
             FROM invoices
             WHERE hotel_id = ",
        );
        query.push_bind(hotel_id);

        if let Some(cursor) = cursor {
            query
                .push(" AND (created_at, id) < (")
                .push_bind(cursor.created_at)
                .push(", ")
                .push_bind(cursor.id)
                .push(")");
        }

        query
            .push(" ORDER BY created_at DESC, id DESC LIMIT ")
            .push_bind(fetch_limit);

        let mut records = query
            .build()
            .fetch_all(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;

        let has_more = records.len() > safe_limit;
        if has_more {
            records.truncate(safe_limit);
        }

        let mut next_cursor = None;
        let items = records
            .into_iter()
            .map(|row| {
                let id: Uuid = row.try_get("id").unwrap();
                let created_at_cursor: NaiveDateTime = row.try_get("created_at_cursor").unwrap();
                let status_str: String = row.try_get("status").unwrap();
                let pm_str: String = row
                    .try_get("payment_method")
                    .unwrap_or_else(|_| "CASH".to_string());
                next_cursor = Some(BookingPageCursor {
                    created_at: created_at_cursor,
                    id,
                });

                Invoice {
                    id,
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
            .collect();

        if !has_more {
            next_cursor = None;
        }

        Ok(InvoicePage {
            items,
            next_cursor,
            has_more,
        })
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
                COALESCE(SUM(CASE WHEN payment_method = 'CARD' THEN amount_cents ELSE 0 END), 0)::BIGINT as card
             FROM invoices 
             WHERE hotel_id = $1 AND status = 'PAID' AND created_at > $2"
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
