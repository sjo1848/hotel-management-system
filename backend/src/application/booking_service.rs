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
    ) -> Result<Booking, String> {
        // 1. Validar que la habitación existe y obtener su precio
        let room = self
            .room_repo
            .find_by_id(room_id)
            .await?
            .ok_or_else(|| "La habitación no existe".to_string())?;

        // 2. Validar disponibilidad
        let is_available = self
            .booking_repo
            .check_availability(room_id, check_in, check_out)
            .await?;
        if !is_available {
            return Err("La habitación ya está reservada para esas fechas".to_string());
        }

        // 3. Instanciar la reserva (mutable para poder calcular el precio)
        let mut use crate::domain::models::Booking;
        use crate::domain::repositories::{BookingRepository, RoomRepository};
        use crate::domain::errors::DomainError;
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
                // 1. Validar existencia y mapear error técnico a Dominio
                let room = self.room_repo.find_by_id(room_id).await
                    .map_err(DomainError::InfrastructureError)?
                    .ok_or(DomainError::RoomNotFound)?;

                // 2. Validar disponibilidad
                let is_available = self.booking_repo.check_availability(room_id, check_in, check_out).await
                    .map_err(DomainError::InfrastructureError)?;

                if !is_available {
                    return Err(DomainError::RoomNotAvailable);
                }

                // 3. Instanciar reserva
                let mut new_booking = Booking {
                    id: Uuid::new_v4(),
                    room_id,
                    guest_name,
                    check_in,
                    check_out,
                    total_price_cents: 0,
                };

                // 4. Validar consistencia de fechas
                if !new_booking.is_valid() {
                    return Err(DomainError::InvalidBookingDates);
                }

                // 5. Calcular precio
                new_booking.calculate_total_price(room.price_cents);

                // 6. Persistir y mapear error
                self.booking_repo.save(new_booking).await
                    .map_err(DomainError::InfrastructureError)
            }
        }new_booking = Booking {
            id: Uuid::new_v4(),
            room_id,
            guest_name,
            check_in,
            check_out,
            total_price_cents: 0,
        };

        // 4. Validaciones de consistencia de fechas
        if !new_booking.is_valid() {
            return Err("La fecha de salida debe ser posterior a la de entrada".to_string());
        }

        // 5. Calcular precio total usando la lógica del Dominio
        new_booking.calculate_total_price(room.price_cents);

        // 6. Persistir
        self.booking_repo.save(new_booking).await
    }
}
