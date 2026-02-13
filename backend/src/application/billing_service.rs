use crate::domain::errors::DomainError;
use crate::domain::models::ExtraCharge;
use crate::domain::repositories::{BookingRepository, ExtraChargeRepository};
use std::sync::Arc;
use uuid::Uuid;

pub struct BillingService {
    extra_charge_repo: Arc<dyn ExtraChargeRepository>,
    booking_repo: Arc<dyn BookingRepository>,
}

impl BillingService {
    pub fn new(
        extra_charge_repo: Arc<dyn ExtraChargeRepository>,
        booking_repo: Arc<dyn BookingRepository>,
    ) -> Self {
        Self {
            extra_charge_repo,
            booking_repo,
        }
    }

    pub async fn add_extra_charge(
        &self,
        hotel_id: Uuid,
        booking_id: Uuid,
        description: String,
        amount_cents: i64,
        category: String,
    ) -> Result<ExtraCharge, DomainError> {
        // Verificar que la reserva existe y pertenece al hotel
        let booking = self
            .booking_repo
            .find_by_id(hotel_id, booking_id)
            .await
            .map_err(DomainError::InfrastructureError)?
            .ok_or(DomainError::BookingNotFound)?;

        let charge = ExtraCharge {
            id: Uuid::new_v4(),
            hotel_id,
            booking_id,
            description,
            amount_cents,
            category,
            created_at: chrono::Utc::now().naive_utc(),
        };

        let result: Result<ExtraCharge, String> = self.extra_charge_repo.add(charge).await;
        let saved = result.map_err(map_extra_charge_repo_error)?;

        // Actualizar el total_price_cents de la reserva sumando el nuevo cargo
        let mut updated_booking = booking;
        updated_booking.total_price_cents += amount_cents;

        let _: Result<crate::domain::models::Booking, String> =
            self.booking_repo.update(updated_booking).await;

        Ok(saved)
    }

    pub async fn list_extra_charges(
        &self,
        hotel_id: Uuid,
        booking_id: Uuid,
    ) -> Result<Vec<ExtraCharge>, DomainError> {
        let result: Result<Vec<ExtraCharge>, String> = self
            .extra_charge_repo
            .find_by_booking(hotel_id, booking_id)
            .await;
        result.map_err(DomainError::InfrastructureError)
    }
}

fn map_extra_charge_repo_error(message: String) -> DomainError {
    match message.as_str() {
        "EXTRA_CHARGE_BOOKING_NOT_FOUND" => DomainError::BookingNotFound,
        "EXTRA_CHARGE_HOTEL_NOT_FOUND" => DomainError::HotelNotFound,
        _ => DomainError::InfrastructureError(message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn map_extra_charge_repo_error_maps_functional_markers() {
        assert!(matches!(
            map_extra_charge_repo_error("EXTRA_CHARGE_BOOKING_NOT_FOUND".to_string()),
            DomainError::BookingNotFound
        ));
        assert!(matches!(
            map_extra_charge_repo_error("EXTRA_CHARGE_HOTEL_NOT_FOUND".to_string()),
            DomainError::HotelNotFound
        ));
    }
}
