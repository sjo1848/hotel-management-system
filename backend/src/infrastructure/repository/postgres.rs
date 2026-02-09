use crate::domain::models::{Room, RoomStatus};
use crate::domain::repositories::RoomRepository;
use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid; // Importante

pub struct PostgresRoomRepository {
    pool: PgPool,
}

impl PostgresRoomRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait] // Aplicar aquí también
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

    async fn find_by_id(&self, _id: Uuid) -> Result<Option<Room>, String> {
        // Usamos _id para que el compilador no se queje de que no se usa
        todo!()
    }
}
