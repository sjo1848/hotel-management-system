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
            "INSERT INTO rooms (id, hotel_id, room_number, room_type, status, price_cents) VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(room.id)
        .bind(room.hotel_id)
        .bind(&room.room_number)
        .bind(&room.room_type)
        .bind(match room.status {
            RoomStatus::Available => "AVAILABLE",
            RoomStatus::Occupied => "OCCUPIED",
            RoomStatus::Dirty => "DIRTY",
            RoomStatus::Cleaning => "CLEANING",
            RoomStatus::Maintenance => "MAINTENANCE",
        })
        .bind(room.price_cents)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(room)
    }

    async fn find_all(&self, hotel_id: Uuid) -> Result<Vec<Room>, String> {
        let records = sqlx::query(
            "SELECT id, hotel_id, room_number, room_type, status, price_cents FROM rooms WHERE hotel_id = $1",
        )
        .bind(hotel_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(records
            .into_iter()
            .map(|rec| {
                let status: Option<String> = rec.try_get("status").ok();
                Room {
                    id: rec.try_get("id").unwrap(),
                    hotel_id: rec.try_get("hotel_id").unwrap(),
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

    async fn find_by_id(&self, hotel_id: Uuid, id: Uuid) -> Result<Option<Room>, String> {
        let record = sqlx::query(
            "SELECT id, hotel_id, room_number, room_type, status, price_cents FROM rooms WHERE hotel_id = $1 AND id = $2",
        )
        .bind(hotel_id)
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(record.map(|rec| {
            let status: Option<String> = rec.try_get("status").ok();
            Room {
                id: rec.try_get("id").unwrap(),
                hotel_id: rec.try_get("hotel_id").unwrap(),
                room_number: rec.try_get("room_number").unwrap(),
                room_type: rec.try_get("room_type").unwrap(),
                status: match status.as_deref() {
                    Some("AVAILABLE") => RoomStatus::Available,
                    Some("OCCUPIED") => RoomStatus::Occupied,
                    Some("DIRTY") => RoomStatus::Dirty,
                    Some("CLEANING") => RoomStatus::Cleaning,
                    _ => RoomStatus::Maintenance,
                },
                price_cents: rec.try_get("price_cents").unwrap(),
            }
        }))
    }

    async fn find_by_room_number(
        &self,
        hotel_id: Uuid,
        room_number: &str,
    ) -> Result<Option<Room>, String> {
        let record = sqlx::query(
            "SELECT id, hotel_id, room_number, room_type, status, price_cents FROM rooms WHERE hotel_id = $1 AND room_number = $2",
        )
        .bind(hotel_id)
        .bind(room_number)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(record.map(|rec| {
            let status: Option<String> = rec.try_get("status").ok();
            Room {
                id: rec.try_get("id").unwrap(),
                hotel_id: rec.try_get("hotel_id").unwrap(),
                room_number: rec.try_get("room_number").unwrap(),
                room_type: rec.try_get("room_type").unwrap(),
                status: match status.as_deref() {
                    Some("AVAILABLE") => RoomStatus::Available,
                    Some("OCCUPIED") => RoomStatus::Occupied,
                    Some("DIRTY") => RoomStatus::Dirty,
                    Some("CLEANING") => RoomStatus::Cleaning,
                    _ => RoomStatus::Maintenance,
                },
                price_cents: rec.try_get("price_cents").unwrap(),
            }
        }))
    }

    async fn update_status(
        &self,
        hotel_id: Uuid,
        id: Uuid,
        status: RoomStatus,
    ) -> Result<(), String> {
        let status_str = match status {
            RoomStatus::Available => "AVAILABLE",
            RoomStatus::Occupied => "OCCUPIED",
            RoomStatus::Dirty => "DIRTY",
            RoomStatus::Cleaning => "CLEANING",
            RoomStatus::Maintenance => "MAINTENANCE",
        };

        let result = sqlx::query("UPDATE rooms SET status = $1 WHERE hotel_id = $2 AND id = $3")
            .bind(status_str)
            .bind(hotel_id)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        if result.rows_affected() == 0 {
            return Err("ROOM_NOT_FOUND".to_string());
        }

        Ok(())
    }

    async fn find_available(
        &self,
        hotel_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<Vec<Room>, String> {
        let records = sqlx::query(
            r#"
            SELECT r.id, r.hotel_id, r.room_number, r.room_type, r.status, r.price_cents
            FROM rooms r
            WHERE r.hotel_id = $1
              AND r.status = 'AVAILABLE'
              AND NOT EXISTS (
                  SELECT 1
                  FROM bookings b
                  WHERE b.hotel_id = $1
                    AND b.room_id = r.id
                    AND b.check_in < $3
                    AND b.check_out > $2
                    AND b.status != 'CANCELLED'
              )
            "#,
        )
        .bind(hotel_id)
        .bind(start)
        .bind(end)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(records
            .into_iter()
            .map(|rec| {
                let status: Option<String> = rec.try_get("status").ok();
                Room {
                    id: rec.try_get("id").unwrap(),
                    hotel_id: rec.try_get("hotel_id").unwrap(),
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
}
