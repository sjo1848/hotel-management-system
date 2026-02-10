use crate::domain::models::{Booking, Room};
use async_trait::async_trait;
use chrono::NaiveDate;
use uuid::Uuid;

#[async_trait]
pub trait RoomRepository: Send + Sync {
    async fn find_all(&self) -> Result<Vec<Room>, String>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Room>, String>;
    // Nuevo puerto para búsqueda por fechas
    async fn find_available(&self, start: NaiveDate, end: NaiveDate) -> Result<Vec<Room>, String>;
}

#[async_trait]
pub trait BookingRepository: Send + Sync {
    async fn save(&self, booking: Booking) -> Result<Booking, String>;
    async fn find_by_room(&self, room_id: Uuid) -> Result<Vec<Booking>, String>;
    async fn check_availability(
        &self,
        room_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<bool, String>;
}
