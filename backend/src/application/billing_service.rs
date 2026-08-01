use crate::domain::errors::DomainError;
use crate::domain::models::{ExtraCharge, Invoice, InvoiceStatus, PaymentEntry, PaymentMethod};
use crate::domain::repositories::{
    BookingRepository, ExtraChargeRepository, InvoiceRepository, PaymentEntryRepository,
};
use std::sync::Arc;
use uuid::Uuid;

pub struct BillingService {
    extra_charge_repo: Arc<dyn ExtraChargeRepository>,
    booking_repo: Arc<dyn BookingRepository>,
    invoice_repo: Arc<dyn InvoiceRepository>,
    payment_entry_repo: Arc<dyn PaymentEntryRepository>,
}

impl BillingService {
    pub fn new(
        extra_charge_repo: Arc<dyn ExtraChargeRepository>,
        booking_repo: Arc<dyn BookingRepository>,
        invoice_repo: Arc<dyn InvoiceRepository>,
        payment_entry_repo: Arc<dyn PaymentEntryRepository>,
    ) -> Self {
        Self {
            extra_charge_repo,
            booking_repo,
            invoice_repo,
            payment_entry_repo,
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
            .map_err(map_booking_repo_error)?
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

        if let Err(update_error) = self.booking_repo.update(updated_booking).await {
            // Intento de compensación para evitar inconsistencias silenciosas:
            // si falló actualizar booking, revertimos el cargo recién creado.
            let _ = self.extra_charge_repo.delete(hotel_id, saved.id).await;
            return Err(map_booking_repo_error(update_error));
        }

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

    pub async fn settle_booking_payment(
        &self,
        hotel_id: Uuid,
        booking_id: Uuid,
        payment_method: PaymentMethod,
        payment_reference: Option<String>,
    ) -> Result<Invoice, DomainError> {
        let booking = self
            .booking_repo
            .find_by_id(hotel_id, booking_id)
            .await
            .map_err(map_booking_repo_error)?
            .ok_or(DomainError::BookingNotFound)?;
        let invoice = self
            .invoice_repo
            .find_by_booking(hotel_id, booking_id)
            .await
            .map_err(map_invoice_repo_error)?;
        let remaining = invoice
            .as_ref()
            .map(|item| item.amount_cents - item.paid_amount_cents)
            .unwrap_or(booking.total_price_cents);

        if remaining <= 0 {
            return Err(DomainError::InvalidInput(
                "La reserva ya tiene una factura cobrada".to_string(),
            ));
        }

        self.register_booking_payment(
            hotel_id,
            booking_id,
            remaining,
            payment_method,
            payment_reference,
            None,
            None,
        )
        .await
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn register_booking_payment(
        &self,
        hotel_id: Uuid,
        booking_id: Uuid,
        amount_cents: i64,
        payment_method: PaymentMethod,
        payment_reference: Option<String>,
        note: Option<String>,
        received_by_user_id: Option<Uuid>,
    ) -> Result<Invoice, DomainError> {
        if amount_cents <= 0 {
            return Err(DomainError::InvalidInput(
                "El monto del cobro debe ser mayor a 0".to_string(),
            ));
        }

        let booking = self
            .booking_repo
            .find_by_id(hotel_id, booking_id)
            .await
            .map_err(map_booking_repo_error)?
            .ok_or(DomainError::BookingNotFound)?;

        let now = chrono::Utc::now().naive_utc();
        let invoice = match self
            .invoice_repo
            .find_by_booking(hotel_id, booking_id)
            .await
            .map_err(map_invoice_repo_error)?
        {
            Some(existing) => existing,
            None => self
                .invoice_repo
                .save(Invoice::new(
                    hotel_id,
                    booking_id,
                    booking.total_price_cents,
                ))
                .await
                .map_err(map_invoice_repo_error)?,
        };

        let remaining = invoice.amount_cents - invoice.paid_amount_cents;
        if remaining <= 0 {
            return Err(DomainError::InvalidInput(
                "La factura ya no tiene saldo pendiente".to_string(),
            ));
        }
        if amount_cents > remaining {
            return Err(DomainError::InvalidInput(
                "El cobro excede el saldo pendiente de la factura".to_string(),
            ));
        }

        let payment = PaymentEntry {
            id: Uuid::new_v4(),
            hotel_id,
            invoice_id: invoice.id,
            booking_id,
            amount_cents,
            payment_method: payment_method.clone(),
            payment_reference: payment_reference.clone(),
            note,
            received_by_user_id,
            received_at: now,
        };
        self.payment_entry_repo
            .add(payment)
            .await
            .map_err(map_payment_entry_repo_error)?;

        let paid_amount_cents = invoice.paid_amount_cents + amount_cents;
        let is_fully_paid = paid_amount_cents >= invoice.amount_cents;
        let updated_invoice = Invoice {
            id: invoice.id,
            hotel_id,
            booking_id,
            amount_cents: invoice.amount_cents,
            paid_amount_cents,
            status: if is_fully_paid {
                InvoiceStatus::Paid
            } else {
                InvoiceStatus::Pending
            },
            payment_method,
            payment_reference,
            paid_at: if is_fully_paid { Some(now) } else { None },
            created_at: invoice.created_at,
        };

        self.invoice_repo
            .update(updated_invoice)
            .await
            .map_err(map_invoice_repo_error)
    }

    pub async fn list_booking_payments(
        &self,
        hotel_id: Uuid,
        booking_id: Uuid,
    ) -> Result<Vec<PaymentEntry>, DomainError> {
        self.payment_entry_repo
            .find_by_booking(hotel_id, booking_id)
            .await
            .map_err(map_payment_entry_repo_error)
    }
}

fn map_extra_charge_repo_error(message: String) -> DomainError {
    match message.as_str() {
        "EXTRA_CHARGE_BOOKING_NOT_FOUND" => DomainError::BookingNotFound,
        "EXTRA_CHARGE_HOTEL_NOT_FOUND" => DomainError::HotelNotFound,
        _ => DomainError::InfrastructureError(message),
    }
}

fn map_booking_repo_error(message: String) -> DomainError {
    match message.as_str() {
        "BOOKING_NOT_FOUND" => DomainError::BookingNotFound,
        "BOOKING_HOTEL_NOT_FOUND" => DomainError::HotelNotFound,
        "BOOKING_ROOM_NOT_FOUND" => DomainError::RoomNotFound,
        "BOOKING_GUEST_NOT_FOUND" => DomainError::GuestNotFound,
        "BOOKING_INVALID_DATES" => DomainError::InvalidBookingDates,
        "BOOKING_OVERLAP" => DomainError::RoomNotAvailable,
        _ => DomainError::InfrastructureError(message),
    }
}

fn map_invoice_repo_error(message: String) -> DomainError {
    match message.as_str() {
        "INVOICE_BOOKING_NOT_FOUND" => DomainError::BookingNotFound,
        "INVOICE_HOTEL_NOT_FOUND" => DomainError::HotelNotFound,
        "INVOICE_ALREADY_PAID" => {
            DomainError::InvalidInput("La reserva ya tiene una factura cobrada".to_string())
        }
        _ => DomainError::InfrastructureError(message),
    }
}

fn map_payment_entry_repo_error(message: String) -> DomainError {
    match message.as_str() {
        "PAYMENT_ENTRY_BOOKING_NOT_FOUND" => DomainError::BookingNotFound,
        "PAYMENT_ENTRY_INVOICE_NOT_FOUND" => DomainError::InvoiceNotFound,
        "PAYMENT_ENTRY_USER_NOT_FOUND" => DomainError::UserNotFound,
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

    #[test]
    fn map_booking_repo_error_maps_functional_markers() {
        assert!(matches!(
            map_booking_repo_error("BOOKING_NOT_FOUND".to_string()),
            DomainError::BookingNotFound
        ));
        assert!(matches!(
            map_booking_repo_error("BOOKING_HOTEL_NOT_FOUND".to_string()),
            DomainError::HotelNotFound
        ));
        assert!(matches!(
            map_booking_repo_error("BOOKING_ROOM_NOT_FOUND".to_string()),
            DomainError::RoomNotFound
        ));
        assert!(matches!(
            map_booking_repo_error("BOOKING_GUEST_NOT_FOUND".to_string()),
            DomainError::GuestNotFound
        ));
        assert!(matches!(
            map_booking_repo_error("BOOKING_INVALID_DATES".to_string()),
            DomainError::InvalidBookingDates
        ));
        assert!(matches!(
            map_booking_repo_error("BOOKING_OVERLAP".to_string()),
            DomainError::RoomNotAvailable
        ));
    }

    #[test]
    fn map_invoice_repo_error_maps_functional_markers() {
        assert!(matches!(
            map_invoice_repo_error("INVOICE_BOOKING_NOT_FOUND".to_string()),
            DomainError::BookingNotFound
        ));
        assert!(matches!(
            map_invoice_repo_error("INVOICE_HOTEL_NOT_FOUND".to_string()),
            DomainError::HotelNotFound
        ));
        assert!(matches!(
            map_invoice_repo_error("INVOICE_ALREADY_PAID".to_string()),
            DomainError::InvalidInput(_)
        ));
    }

    #[test]
    fn map_payment_entry_repo_error_maps_functional_markers() {
        assert!(matches!(
            map_payment_entry_repo_error("PAYMENT_ENTRY_BOOKING_NOT_FOUND".to_string()),
            DomainError::BookingNotFound
        ));
        assert!(matches!(
            map_payment_entry_repo_error("PAYMENT_ENTRY_INVOICE_NOT_FOUND".to_string()),
            DomainError::InvoiceNotFound
        ));
        assert!(matches!(
            map_payment_entry_repo_error("PAYMENT_ENTRY_USER_NOT_FOUND".to_string()),
            DomainError::UserNotFound
        ));
    }
}
