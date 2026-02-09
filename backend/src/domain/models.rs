use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub enum RoomStatus {
    Available,
    Occupied,
    Dirty,
    Maintenance,
}

#[derive(Debug, Clone, Serialize)]
pub struct Room {
    pub id: Uuid,
    pub room_number: String,
    pub room_type: String,
    pub status: RoomStatus,
    pub price_cents: i64,
}
