use crate::domain::models::{Room, RoomStatus};
use crate::domain::repositories::RoomRepository;
use async_trait::async_trait;
use chrono::NaiveDate;
use sqlx::PgPool;
use uuid::Uuid;

pub struct PostgresRoomRepository {
    pool: PgPool,
}

impl PostgresRoomRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl RoomRepository for PostgresRoomRepository {
    async fn find_all(&self) -> Result<Vec<Room>, String> {
        let records =
            sqlx::query!("SELECT id, room_number, room_type, status, price_cents FROM rooms")
                .fetch_all(&self.pool)
                .await
                .map_err(|e| e.to_string())?;

        Ok(records
            .into_iter()
            .map(|rec| Room {
                id: rec.id,
                room_number: rec.room_number,
                room_type: rec.room_type,
                status: match rec.status.as_deref() {
                    Some("AVAILABLE") => RoomStatus::Available,
                    Some("OCCUPIED") => RoomStatus::Occupied,
                    Some("DIRTY") => RoomStatus::Dirty,
                    _ => RoomStatus::Maintenance,
                },
                price_cents: rec.price_cents,
            })
            .collect())
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<Room>, String> {
        let record = sqlx::query!(
            "SELECT id, room_number, room_type, status, price_cents FROM rooms WHERE id = $1",
            id
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(record.map(|rec| Room {
            id: rec.id,
            room_number: rec.room_number,
            room_type: rec.room_type,
            status: match rec.status.as_deref() {
                Some("AVAILABLE") => RoomStatus::Available,
                _ => RoomStatus::Maintenance,
            },
            price_cents: rec.price_cents,
        }))
    }

    async fn find_available(&self, start: NaiveDate, end: NaiveDate) -> Result<Vec<Room>, String> {
        let records = sqlx::query!(
            r#"
            SELECT id, room_number, room_type, status, price_cents
            FROM rooms
            WHERE id NOT IN (
                SELECT room_id FROM bookings
                WHERE check_in < $2 AND check_out > $1
            )
            AND status = 'AVAILABLE'
            "#,
            start,
            end
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(records
            .into_iter()
            .map(|rec| Room {
                id: rec.id,
                room_number: rec.room_number,
                room_type: rec.room_type,
                status: RoomStatus::Available,
                price_cents: rec.price_cents,
            })
            .collect())
    }
}
