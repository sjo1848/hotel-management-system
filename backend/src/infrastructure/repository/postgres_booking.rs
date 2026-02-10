use crate::domain::models::Booking;
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
        sqlx::query!(
            "INSERT INTO bookings (id, room_id, guest_name, check_in, check_out) VALUES ($1, $2, $3, $4, $5)",
            booking.id,
            booking.room_id,
            booking.guest_name,
            booking.check_in,
            booking.check_out
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(booking)
    }

    async fn find_by_room(&self, room_id: Uuid) -> Result<Vec<Booking>, String> {
        let records = sqlx::query_as!(
            Booking,
            "SELECT id, room_id, guest_name, check_in, check_out FROM bookings WHERE room_id = $1",
            room_id
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(records)
    }

    async fn check_availability(
        &self,
        room_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<bool, String> {
        // Si existe alguna fila que se solape, el resultado es FALSE (no disponible)
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
}
