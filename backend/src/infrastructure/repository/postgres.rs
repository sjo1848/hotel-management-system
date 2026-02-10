use crate::domain::models::{Room, RoomStatus};
use crate::domain::repositories::RoomRepository;
use async_trait::async_trait;
use chrono::NaiveDate;
use sqlx::{PgPool, Row};
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
    async fn create(&self, room: Room) -> Result<Room, String> {
        sqlx::query(
            "INSERT INTO rooms (id, room_number, room_type, status, price_cents) VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(room.id)
        .bind(&room.room_number)
        .bind(&room.room_type)
        .bind(match room.status {
            RoomStatus::Available => "AVAILABLE",
            RoomStatus::Occupied => "OCCUPIED",
            RoomStatus::Dirty => "DIRTY",
            RoomStatus::Maintenance => "MAINTENANCE",
        })
        .bind(room.price_cents)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(room)
    }

    async fn find_all(&self) -> Result<Vec<Room>, String> {
        let records = sqlx::query(
            "SELECT id, room_number, room_type, status, price_cents FROM rooms",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(records
            .into_iter()
            .map(|rec| {
                let status: Option<String> = rec.try_get("status").ok();
                Room {
                    id: rec.try_get("id").unwrap(),
                    room_number: rec.try_get("room_number").unwrap(),
                    room_type: rec.try_get("room_type").unwrap(),
                    status: match status.as_deref() {
                        Some("AVAILABLE") => RoomStatus::Available,
                        Some("OCCUPIED") => RoomStatus::Occupied,
                        Some("DIRTY") => RoomStatus::Dirty,
                        _ => RoomStatus::Maintenance,
                    },
                    price_cents: rec.try_get("price_cents").unwrap(),
                }
            })
            .collect())
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<Room>, String> {
        let record = sqlx::query(
            "SELECT id, room_number, room_type, status, price_cents FROM rooms WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(record.map(|rec| {
            let status: Option<String> = rec.try_get("status").ok();
            Room {
                id: rec.try_get("id").unwrap(),
                room_number: rec.try_get("room_number").unwrap(),
                room_type: rec.try_get("room_type").unwrap(),
                status: match status.as_deref() {
                    Some("AVAILABLE") => RoomStatus::Available,
                    _ => RoomStatus::Maintenance,
                },
                price_cents: rec.try_get("price_cents").unwrap(),
            }
        }))
    }

    async fn find_available(&self, start: NaiveDate, end: NaiveDate) -> Result<Vec<Room>, String> {
        let records = sqlx::query(
            r#"
            SELECT id, room_number, room_type, status, price_cents
            FROM rooms
            WHERE id NOT IN (
                SELECT room_id FROM bookings
                WHERE check_in < $2 AND check_out > $1
            )
            AND status = 'AVAILABLE'
            "#,
        )
        .bind(start)
        .bind(end)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(records
            .into_iter()
            .map(|rec| Room {
                id: rec.try_get("id").unwrap(),
                room_number: rec.try_get("room_number").unwrap(),
                room_type: rec.try_get("room_type").unwrap(),
                status: RoomStatus::Available,
                price_cents: rec.try_get("price_cents").unwrap(),
            })
            .collect())
    }
}
