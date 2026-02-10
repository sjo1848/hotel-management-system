use crate::domain::models::{Booking, BookingStatus};
use crate::domain::repositories::BookingRepository;
use async_trait::async_trait;
use chrono::NaiveDate;
use sqlx::PgPool;
use uuid::Uuid;

pub struct PostgresBookingRepository {
    pool: PgPool,
}

impl PostgresBookingRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl BookingRepository for PostgresBookingRepository {
    async fn save(&self, booking: Booking) -> Result<Booking, String> {
        let status = match booking.status {
            BookingStatus::Confirmed => "CONFIRMED",
            BookingStatus::Cancelled => "CANCELLED",
        };

        sqlx::query!(
            "INSERT INTO bookings (id, room_id, guest_name, check_in, check_out, total_price_cents, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
            booking.id,
            booking.room_id,
            booking.guest_name,
            booking.check_in,
            booking.check_out,
            booking.total_price_cents,
            status
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(booking)
    }

    async fn find_all(&self) -> Result<Vec<Booking>, String> {
        let records = sqlx::query!(
            "SELECT id, room_id, guest_name, check_in, check_out, total_price_cents, status FROM bookings ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let bookings = records
            .into_iter()
            .map(|row| Booking {
                id: row.id,
                room_id: row.room_id,
                guest_name: row.guest_name,
                check_in: row.check_in,
                check_out: row.check_out,
                total_price_cents: row.total_price_cents.unwrap_or(0),
                status: match row.status.as_deref() {
                    Some("CANCELLED") => BookingStatus::Cancelled,
                    _ => BookingStatus::Confirmed,
                },
            })
            .collect();

        Ok(bookings)
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<Booking>, String> {
        let record = sqlx::query!(
            "SELECT id, room_id, guest_name, check_in, check_out, total_price_cents, status FROM bookings WHERE id = $1",
            id
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(record.map(|row| Booking {
            id: row.id,
            room_id: row.room_id,
            guest_name: row.guest_name,
            check_in: row.check_in,
            check_out: row.check_out,
            total_price_cents: row.total_price_cents.unwrap_or(0),
            status: match row.status.as_deref() {
                Some("CANCELLED") => BookingStatus::Cancelled,
                _ => BookingStatus::Confirmed,
            },
        }))
    }

    async fn update(&self, booking: Booking) -> Result<Booking, String> {
        let status = match booking.status {
            BookingStatus::Confirmed => "CONFIRMED",
            BookingStatus::Cancelled => "CANCELLED",
        };

        sqlx::query!(
            "UPDATE bookings
             SET guest_name = $1, check_in = $2, check_out = $3, total_price_cents = $4, status = $5
             WHERE id = $6",
            booking.guest_name,
            booking.check_in,
            booking.check_out,
            booking.total_price_cents,
            status,
            booking.id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(booking)
    }

    async fn find_by_room(&self, room_id: Uuid) -> Result<Vec<Booking>, String> {
        let records = sqlx::query!(
            "SELECT id, room_id, guest_name, check_in, check_out, total_price_cents, status FROM bookings WHERE room_id = $1",
            room_id
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let bookings = records
            .into_iter()
            .map(|row| Booking {
                id: row.id,
                room_id: row.room_id,
                guest_name: row.guest_name,
                check_in: row.check_in,
                check_out: row.check_out,
                total_price_cents: row.total_price_cents.unwrap_or(0),
                status: match row.status.as_deref() {
                    Some("CANCELLED") => BookingStatus::Cancelled,
                    _ => BookingStatus::Confirmed,
                },
            })
            .collect();

        Ok(bookings)
    }

    async fn check_availability(
        &self,
        room_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<bool, String> {
        let overlap = sqlx::query!(
            r#"
            SELECT EXISTS (
                SELECT 1 FROM bookings
                WHERE room_id = $1
                AND check_in < $3
                AND check_out > $2
            ) as has_overlap
            "#,
            room_id,
            start,
            end
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(!overlap.has_overlap.unwrap_or(false))
    }

    async fn check_availability_excluding(
        &self,
        booking_id: Uuid,
        room_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<bool, String> {
        let overlap = sqlx::query!(
            r#"
            SELECT EXISTS (
                SELECT 1 FROM bookings
                WHERE room_id = $1
                AND id != $2
                AND check_in < $4
                AND check_out > $3
            ) as has_overlap
            "#,
            room_id,
            booking_id,
            start,
            end
        )
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(!overlap.has_overlap.unwrap_or(false))
    }
}
