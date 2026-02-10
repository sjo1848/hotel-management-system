use crate::domain::models::{Booking, Room};
use async_trait::async_trait;
use chrono::NaiveDate;
use uuid::Uuid;

#[async_trait]
pub trait RoomRepository: Send + Sync {
    /// Obtiene todas las habitaciones registradas
    async fn find_all(&self) -> Result<Vec<Room>, String>;

    /// Busca una habitación específica por su identificador único
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Room>, String>;
}

#[async_trait]
pub trait BookingRepository: Send + Sync {
    /// Guarda una nueva reserva en el sistema
    async fn save(&self, booking: Booking) -> Result<Booking, String>;

    /// Busca todas las reservas asociadas a una habitación específica
    async fn find_by_room(&self, room_id: Uuid) -> Result<Vec<Booking>, String>;

    /// Verifica si existe algún solapamiento para una habitación en un rango de fechas
    /// Devuelve true si está disponible, false si hay colisión
    async fn check_availability(
        &self,
        room_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<bool, String>;
}
