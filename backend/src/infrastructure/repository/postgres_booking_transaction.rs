use crate::domain::errors::DomainError;
use crate::domain::models::{Booking, BookingStatus, RoomStatus};
use crate::domain::repositories::BookingTransactionRepository;
use crate::infrastructure::repository::tenant_context::apply_tenant_context;
use async_trait::async_trait;
use chrono::NaiveDate;
use sqlx::postgres::PgPool;
use sqlx::Row;
use uuid::Uuid;

pub struct PostgresBookingTransactionRepository {
    pool: PgPool,
}

impl PostgresBookingTransactionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl BookingTransactionRepository for PostgresBookingTransactionRepository {
    #[allow(clippy::too_many_arguments)]
    async fn update_booking_transactional(
        &self,
        hotel_id: Uuid,
        booking_id: Uuid,
        actor_user_id: Option<Uuid>,
        guest_id: Option<Uuid>,
        guest_name: Option<String>,
        check_in: Option<NaiveDate>,
        check_out: Option<NaiveDate>,
        status: Option<BookingStatus>,
    ) -> Result<Booking, DomainError> {
        let mut tx = self.pool.begin().await.map_err(map_sql_error)?;
        let tenant_id = hotel_id.to_string();
        apply_tenant_context(&mut tx, &tenant_id)
            .await
            .map_err(DomainError::InfrastructureError)?;

        let existing = sqlx::query(
            "SELECT id, hotel_id, room_id, guest_id, guest_name, check_in, check_out, total_price_cents, status
             FROM bookings
             WHERE hotel_id = $1 AND id = $2
             FOR UPDATE",
        )
        .bind(hotel_id)
        .bind(booking_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(map_sql_error)?;

        let Some(row) = existing else {
            return Err(DomainError::BookingNotFound);
        };

        let mut booking = Booking {
            id: row.try_get("id").map_err(map_sql_error)?,
            hotel_id: row.try_get("hotel_id").map_err(map_sql_error)?,
            room_id: row.try_get("room_id").map_err(map_sql_error)?,
            guest_id: row.try_get("guest_id").ok(),
            guest_name: row.try_get("guest_name").map_err(map_sql_error)?,
            check_in: row.try_get("check_in").map_err(map_sql_error)?,
            check_out: row.try_get("check_out").map_err(map_sql_error)?,
            total_price_cents: row.try_get("total_price_cents").unwrap_or(0),
            status: parse_booking_status(
                row.try_get::<Option<String>, _>("status")
                    .ok()
                    .flatten()
                    .as_deref(),
            ),
        };

        if let Some(gid) = guest_id {
            let guest_exists = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS (
                    SELECT 1
                    FROM guests
                    WHERE hotel_id = $1 AND id = $2
                )",
            )
            .bind(hotel_id)
            .bind(gid)
            .fetch_one(&mut *tx)
            .await
            .map_err(map_sql_error)?;

            if !guest_exists {
                return Err(DomainError::GuestNotFound);
            }
            booking.guest_id = Some(gid);
        }

        if let Some(name) = guest_name {
            booking.guest_name = name;
        }

        if let Some(new_check_in) = check_in {
            booking.check_in = new_check_in;
        }

        if let Some(new_check_out) = check_out {
            booking.check_out = new_check_out;
        }

        if let Some(new_status) = status {
            booking.status = new_status;
        }

        if !booking.is_valid() {
            return Err(DomainError::InvalidBookingDates);
        }

        let has_overlap = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS (
                SELECT 1
                FROM bookings
                WHERE hotel_id = $1
                  AND id <> $2
                  AND room_id = $3
                  AND status != 'CANCELLED'
                  AND check_in < $5
                  AND check_out > $4
            )",
        )
        .bind(hotel_id)
        .bind(booking.id)
        .bind(booking.room_id)
        .bind(booking.check_in)
        .bind(booking.check_out)
        .fetch_one(&mut *tx)
        .await
        .map_err(map_sql_error)?;

        if has_overlap {
            return Err(DomainError::RoomNotAvailable);
        }

        let room = sqlx::query(
            "SELECT id, hotel_id, room_number, room_type, status, price_cents
             FROM rooms
             WHERE hotel_id = $1 AND id = $2",
        )
        .bind(hotel_id)
        .bind(booking.room_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(map_sql_error)?;

        let Some(room_row) = room else {
            return Err(DomainError::RoomNotFound);
        };

        let room_price_cents: i64 = room_row.try_get("price_cents").map_err(map_sql_error)?;
        booking.calculate_total_price(room_price_cents);

        let result = sqlx::query(
            "UPDATE bookings
             SET guest_id = $1, guest_name = $2, check_in = $3, check_out = $4, total_price_cents = $5, status = $6
             WHERE hotel_id = $7 AND id = $8",
        )
        .bind(booking.guest_id)
        .bind(&booking.guest_name)
        .bind(booking.check_in)
        .bind(booking.check_out)
        .bind(booking.total_price_cents)
        .bind(booking_status_to_db(&booking.status))
        .bind(booking.hotel_id)
        .bind(booking.id)
        .execute(&mut *tx)
        .await
        .map_err(map_sql_error)?;

        if result.rows_affected() == 0 {
            return Err(DomainError::BookingNotFound);
        }

        match booking.status {
            BookingStatus::CheckedIn => {
                update_room_status_tx(&mut tx, hotel_id, booking.room_id, RoomStatus::Occupied)
                    .await?;
                insert_audit_tx(
                    &mut tx,
                    hotel_id,
                    actor_user_id,
                    format!("Check-in: Booking {}", booking.id),
                )
                .await?;
            }
            BookingStatus::CheckedOut => {
                update_room_status_tx(&mut tx, hotel_id, booking.room_id, RoomStatus::Dirty)
                    .await?;
                insert_audit_tx(
                    &mut tx,
                    hotel_id,
                    actor_user_id,
                    format!("Check-out: Booking {}", booking.id),
                )
                .await?;
                insert_invoice_if_missing_tx(
                    &mut tx,
                    hotel_id,
                    booking.id,
                    booking.total_price_cents,
                )
                .await?;
            }
            BookingStatus::Cancelled => {
                insert_audit_tx(
                    &mut tx,
                    hotel_id,
                    actor_user_id,
                    format!("Cancellation: Booking {}", booking.id),
                )
                .await?;
            }
            BookingStatus::Confirmed => {}
        }

        tx.commit().await.map_err(map_sql_error)?;
        Ok(booking)
    }
}

fn parse_booking_status(value: Option<&str>) -> BookingStatus {
    match value {
        Some("CHECKED_IN") => BookingStatus::CheckedIn,
        Some("CHECKED_OUT") => BookingStatus::CheckedOut,
        Some("CANCELLED") => BookingStatus::Cancelled,
        _ => BookingStatus::Confirmed,
    }
}

fn booking_status_to_db(status: &BookingStatus) -> &'static str {
    match status {
        BookingStatus::Confirmed => "CONFIRMED",
        BookingStatus::CheckedIn => "CHECKED_IN",
        BookingStatus::CheckedOut => "CHECKED_OUT",
        BookingStatus::Cancelled => "CANCELLED",
    }
}

fn room_status_to_db(status: &RoomStatus) -> &'static str {
    match status {
        RoomStatus::Available => "AVAILABLE",
        RoomStatus::Occupied => "OCCUPIED",
        RoomStatus::Dirty => "DIRTY",
        RoomStatus::Cleaning => "CLEANING",
        RoomStatus::Maintenance => "MAINTENANCE",
    }
}

async fn update_room_status_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    hotel_id: Uuid,
    room_id: Uuid,
    status: RoomStatus,
) -> Result<(), DomainError> {
    let result = sqlx::query("UPDATE rooms SET status = $1 WHERE hotel_id = $2 AND id = $3")
        .bind(room_status_to_db(&status))
        .bind(hotel_id)
        .bind(room_id)
        .execute(&mut **tx)
        .await
        .map_err(map_sql_error)?;

    if result.rows_affected() == 0 {
        return Err(DomainError::RoomNotFound);
    }
    Ok(())
}

async fn insert_audit_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    hotel_id: Uuid,
    user_id: Option<Uuid>,
    action: String,
) -> Result<(), DomainError> {
    sqlx::query(
        "INSERT INTO audit_events (id, hotel_id, user_id, action, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(Uuid::new_v4())
    .bind(Some(hotel_id))
    .bind(user_id)
    .bind(action)
    .bind(Option::<String>::None)
    .bind(chrono::Utc::now().naive_utc())
    .execute(&mut **tx)
    .await
    .map_err(map_sql_error)?;

    Ok(())
}

async fn insert_invoice_if_missing_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    hotel_id: Uuid,
    booking_id: Uuid,
    amount_cents: i64,
) -> Result<(), DomainError> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (
            SELECT 1
            FROM invoices
            WHERE hotel_id = $1 AND booking_id = $2
        )",
    )
    .bind(hotel_id)
    .bind(booking_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(map_sql_error)?;

    if exists {
        return Ok(());
    }

    sqlx::query(
        "INSERT INTO invoices (id, hotel_id, booking_id, amount_cents, status, payment_method, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(Uuid::new_v4())
    .bind(hotel_id)
    .bind(booking_id)
    .bind(amount_cents)
    .bind("PENDING")
    .bind("CASH")
    .bind(chrono::Utc::now().naive_utc())
    .execute(&mut **tx)
    .await
    .map_err(map_sql_error)?;

    Ok(())
}

fn map_sql_error(error: sqlx::Error) -> DomainError {
    if let sqlx::Error::Database(db_error) = &error {
        if let Some(code) = db_error.code() {
            let constraint_name = db_error.constraint().unwrap_or_default();
            if let Some(mapped) = map_db_constraint_error(code.as_ref(), constraint_name) {
                return mapped;
            }
        }
    }
    DomainError::InfrastructureError(error.to_string())
}

fn map_db_constraint_error(code: &str, constraint_name: &str) -> Option<DomainError> {
    match code {
        "23P01" => Some(DomainError::RoomNotAvailable),
        "23514" if constraint_name == "valid_dates" => Some(DomainError::InvalidBookingDates),
        "23503" if constraint_name == "fk_bookings_hotel_room" => Some(DomainError::RoomNotFound),
        "23503" if constraint_name == "fk_bookings_hotel_guest" => Some(DomainError::GuestNotFound),
        "23503" if constraint_name == "bookings_hotel_id_fkey" => Some(DomainError::HotelNotFound),
        "23503" if constraint_name == "fk_invoices_hotel_booking" => {
            Some(DomainError::BookingNotFound)
        }
        "23503" if constraint_name == "fk_audit_events_hotel_user" => {
            Some(DomainError::UserNotFound)
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_booking_status_defaults_to_confirmed() {
        assert!(matches!(
            parse_booking_status(Some("OTHER")),
            BookingStatus::Confirmed
        ));
    }

    #[test]
    fn booking_status_to_db_maps_expected_values() {
        assert_eq!(
            booking_status_to_db(&BookingStatus::CheckedIn),
            "CHECKED_IN"
        );
        assert_eq!(
            booking_status_to_db(&BookingStatus::CheckedOut),
            "CHECKED_OUT"
        );
    }

    #[test]
    fn map_db_constraint_error_maps_audit_fk_to_user_not_found() {
        assert!(matches!(
            map_db_constraint_error("23503", "fk_audit_events_hotel_user"),
            Some(DomainError::UserNotFound)
        ));
    }
}
