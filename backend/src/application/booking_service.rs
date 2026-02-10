use std::sync::Arc;
use crate::domain::models::Booking;
use crate::domain::repositories::{BookingRepository, RoomRepository};
use uuid::Uuid;
use chrono::NaiveDate;

pub struct BookingService {
    booking_repo: Arc<dyn BookingRepository>,
    room_repo: Arc<dyn RoomRepository>,
}

impl BookingService {
    pub fn new(booking_repo: Arc<dyn BookingRepository>, room_repo: Arc<dyn RoomRepository>) -> Self {
        Self { booking_repo, room_repo }
    }

    pub async fn execute(&self, room_id: Uuid, guest_name: String, check_in: NaiveDate, check_out: NaiveDate) -> Result<Booking, String> {
        // 1. Validar que la habitación existe
        let room = self.room_repo.find_by_id(room_id).await?;
        if room.is_none() {
            return Err("La habitación no existe".to_string());
        }

        // 2. Validar disponibilidad (Regla de negocio crítica)
        let is_available = self.booking_repo.check_availability(room_id, check_in, check_out).await?;
        if !is_available {
            return Err("La habitación ya está reservada para esas fechas".to_string());
        }

        // 3. Crear y guardar la reserva
        let new_booking = Booking {
            id: Uuid::new_v4(),
            room_id,
            guest_name,
            check_in,
            check_out,
        };

        self.booking_repo.save(new_booking).await
    }
}
