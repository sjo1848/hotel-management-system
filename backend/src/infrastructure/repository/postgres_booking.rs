use crate::domain::models::{Booking, BookingStatus};
use crate::domain::repositories::BookingRepository;
use async_trait::async_trait;
use chrono::NaiveDate;
use sqlx::{PgPool, Row};
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

        sqlx::query(
            "INSERT INTO bookings (id, room_id, guest_name, check_in, check_out, total_price_cents, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(booking.id)
        .bind(booking.room_id)
        .bind(&booking.guest_name)
        .bind(booking.check_in)
        .bind(booking.check_out)
        .bind(booking.total_price_cents)
        .bind(status)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(booking)
    }

    async fn find_all(&self) -> Result<Vec<Booking>, String> {
        let records = sqlx::query(
            "SELECT id, room_id, guest_name, check_in, check_out, total_price_cents, status FROM bookings ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let bookings = records
            .into_iter()
            .map(|row| {
                let status: Option<String> = row.try_get("status").ok();
                Booking {
                    id: row.try_get("id").unwrap(),
                    room_id: row.try_get("room_id").unwrap(),
                    guest_name: row.try_get("guest_name").unwrap(),
                    check_in: row.try_get("check_in").unwrap(),
                    check_out: row.try_get("check_out").unwrap(),
                    total_price_cents: row.try_get("total_price_cents").unwrap_or(0),
                    status: match status.as_deref() {
                        Some("CANCELLED") => BookingStatus::Cancelled,
                        _ => BookingStatus::Confirmed,
                    },
                }
            })
            .collect();

        Ok(bookings)
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<Booking>, String> {
        let record = sqlx::query(
            "SELECT id, room_id, guest_name, check_in, check_out, total_price_cents, status FROM bookings WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(record.map(|row| {
            let status: Option<String> = row.try_get("status").ok();
            Booking {
                id: row.try_get("id").unwrap(),
                room_id: row.try_get("room_id").unwrap(),
                guest_name: row.try_get("guest_name").unwrap(),
                check_in: row.try_get("check_in").unwrap(),
                check_out: row.try_get("check_out").unwrap(),
                total_price_cents: row.try_get("total_price_cents").unwrap_or(0),
                status: match status.as_deref() {
                    Some("CANCELLED") => BookingStatus::Cancelled,
                    _ => BookingStatus::Confirmed,
                },
            }
        }))
    }

    async fn update(&self, booking: Booking) -> Result<Booking, String> {
        let status = match booking.status {
            BookingStatus::Confirmed => "CONFIRMED",
            BookingStatus::Cancelled => "CANCELLED",
        };

        sqlx::query(
            "UPDATE bookings
             SET guest_name = $1, check_in = $2, check_out = $3, total_price_cents = $4, status = $5
             WHERE id = $6",
        )
        .bind(&booking.guest_name)
        .bind(booking.check_in)
        .bind(booking.check_out)
        .bind(booking.total_price_cents)
        .bind(status)
        .bind(booking.id)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(booking)
    }

    async fn find_by_room(&self, room_id: Uuid) -> Result<Vec<Booking>, String> {
        let records = sqlx::query(
            "SELECT id, room_id, guest_name, check_in, check_out, total_price_cents, status FROM bookings WHERE room_id = $1",
        )
        .bind(room_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let bookings = records
            .into_iter()
            .map(|row| {
                let status: Option<String> = row.try_get("status").ok();
                Booking {
                    id: row.try_get("id").unwrap(),
                    room_id: row.try_get("room_id").unwrap(),
                    guest_name: row.try_get("guest_name").unwrap(),
                    check_in: row.try_get("check_in").unwrap(),
                    check_out: row.try_get("check_out").unwrap(),
                    total_price_cents: row.try_get("total_price_cents").unwrap_or(0),
                    status: match status.as_deref() {
                        Some("CANCELLED") => BookingStatus::Cancelled,
                        _ => BookingStatus::Confirmed,
                    },
                }
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
        let overlap = sqlx::query(
            r#"
            SELECT EXISTS (
                SELECT 1 FROM bookings
                WHERE room_id = $1
                AND check_in < $3
                AND check_out > $2
            ) as has_overlap
            "#,
        )
        .bind(room_id)
        .bind(start)
        .bind(end)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let has_overlap: Option<bool> = overlap.try_get("has_overlap").ok();
        Ok(!has_overlap.unwrap_or(false))
    }

    async fn check_availability_excluding(
        &self,
        booking_id: Uuid,
        room_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<bool, String> {
        let overlap = sqlx::query(
            r#"
            SELECT EXISTS (
                SELECT 1 FROM bookings
                WHERE room_id = $1
                AND id != $2
                AND check_in < $4
                AND check_out > $3
            ) as has_overlap
            "#,
        )
        .bind(room_id)
        .bind(booking_id)
        .bind(start)
        .bind(end)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let has_overlap: Option<bool> = overlap.try_get("has_overlap").ok();
        Ok(!has_overlap.unwrap_or(false))
    }
}
