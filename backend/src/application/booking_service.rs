use crate::domain::errors::DomainError;
use crate::domain::models::Booking;
use crate::domain::repositories::{BookingRepository, RoomRepository};
use chrono::NaiveDate;
use std::sync::Arc;
use uuid::Uuid;

pub struct BookingService {
    booking_repo: Arc<dyn BookingRepository>,
    room_repo: Arc<dyn RoomRepository>,
}

impl BookingService {
    pub fn new(
        booking_repo: Arc<dyn BookingRepository>,
        room_repo: Arc<dyn RoomRepository>,
    ) -> Self {
        Self {
            booking_repo,
            room_repo,
        }
    }

    pub async fn execute(
        &self,
        room_id: Uuid,
        guest_name: String,
        check_in: NaiveDate,
        check_out: NaiveDate,
    ) -> Result<Booking, DomainError> {
        let room = self
            .room_repo
            .find_by_id(room_id)
            .await
            .map_err(DomainError::InfrastructureError)?
            .ok_or(DomainError::RoomNotFound)?;

        let is_available = self
            .booking_repo
            .check_availability(room_id, check_in, check_out)
            .await
            .map_err(DomainError::InfrastructureError)?;

        if !is_available {
            return Err(DomainError::RoomNotAvailable);
        }

        let mut new_booking = Booking {
            id: Uuid::new_v4(),
            room_id,
            guest_name,
            check_in,
            check_out,
            total_price_cents: 0,
        };

        if !new_booking.is_valid() {
            return Err(DomainError::InvalidBookingDates);
        }

        new_booking.calculate_total_price(room.price_cents);

        self.booking_repo
            .save(new_booking)
            .await
            .map_err(DomainError::InfrastructureError)
    }
}
