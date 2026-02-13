use crate::domain::errors::DomainError;
use crate::domain::models::{Booking, BookingStatus, Invoice, RoomStatus};
use crate::domain::repositories::{BookingRepository, RoomRepository, InvoiceRepository};
use crate::application::room_service::RoomService;
use crate::application::audit_service::AuditService;
use chrono::NaiveDate;
use std::sync::Arc;
use uuid::Uuid;

pub struct BookingService {
    booking_repo: Arc<dyn BookingRepository>,
    room_repo: Arc<dyn RoomRepository>,
    room_service: Arc<RoomService>,
    audit_service: Arc<AuditService>,
    invoice_repo: Arc<dyn InvoiceRepository>,
}

impl BookingService {
    pub fn new(
        booking_repo: Arc<dyn BookingRepository>,
        room_repo: Arc<dyn RoomRepository>,
        room_service: Arc<RoomService>,
        audit_service: Arc<AuditService>,
        invoice_repo: Arc<dyn InvoiceRepository>,
    ) -> Self {
        Self {
            booking_repo,
            room_repo,
            room_service,
            audit_service,
            invoice_repo,
        }
    }

    pub async fn execute(
        &self,
        hotel_id: Uuid,
        room_id: Uuid,
        guest_id: Option<Uuid>,
        guest_name: String,
        check_in: NaiveDate,
        check_out: NaiveDate,
    ) -> Result<Booking, DomainError> {
        let room = self
            .room_repo
            .find_by_id(hotel_id, room_id)
            .await
            .map_err(DomainError::InfrastructureError)?
            .ok_or(DomainError::RoomNotFound)?;

        // Validación según mandato: La habitación debe estar disponible
        if room.status != RoomStatus::Available {
            return Err(DomainError::RoomNotAvailable);
        }

        let is_available = self
            .booking_repo
            .check_availability(hotel_id, room_id, check_in, check_out)
            .await
            .map_err(DomainError::InfrastructureError)?;

        if !is_available {
            return Err(DomainError::RoomNotAvailable);
        }

        let mut new_booking = Booking {
            id: Uuid::new_v4(),
            hotel_id,
            room_id,
            guest_id,
            guest_name,
            check_in,
            check_out,
            total_price_cents: 0,
            status: BookingStatus::Confirmed,
        };

        if !new_booking.is_valid() {
            return Err(DomainError::InvalidBookingDates);
        }

        new_booking.calculate_total_price(room.price_cents);

        let saved_booking = self.booking_repo
            .save(new_booking)
            .await
            .map_err(map_repo_error)?;

        self.audit_service.record(Some(hotel_id), guest_id, &format!("New Booking created: {}", saved_booking.id), None).await;
        
        Ok(saved_booking)
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn update_booking(
        &self,
        hotel_id: Uuid,
        booking_id: Uuid,
        guest_id: Option<Uuid>,
        guest_name: Option<String>,
        check_in: Option<NaiveDate>,
        check_out: Option<NaiveDate>,
        status: Option<BookingStatus>,
    ) -> Result<Booking, DomainError> {
        let mut booking = self
            .booking_repo
            .find_by_id(hotel_id, booking_id)
            .await
            .map_err(DomainError::InfrastructureError)?
            .ok_or(DomainError::BookingNotFound)?;

        if let Some(gid) = guest_id {
            booking.guest_id = Some(gid);
        }

        if let Some(name) = guest_name {
            booking.guest_name = name;
        }

        if let Some(new_check_in) = check_in {
            booking.check_in = new_check_in;
        }

        if let Some(new_check_out) = check_out {
            booking.check_out = new_check_out;
        }

        if let Some(new_status) = status {
            booking.status = new_status;
        }

        if !booking.is_valid() {
            return Err(DomainError::InvalidBookingDates);
        }

        let is_available = self
            .booking_repo
            .check_availability_excluding(
                hotel_id,
                booking.id,
                booking.room_id,
                booking.check_in,
                booking.check_out,
            )
            .await
            .map_err(DomainError::InfrastructureError)?;

        if !is_available {
            return Err(DomainError::RoomNotAvailable);
        }

        let room = self
            .room_repo
            .find_by_id(hotel_id, booking.room_id)
            .await
            .map_err(DomainError::InfrastructureError)?
            .ok_or(DomainError::RoomNotFound)?;

        booking.calculate_total_price(room.price_cents);

        let updated_booking = self.booking_repo
            .update(booking)
            .await
            .map_err(map_repo_error)?;

        // Side effect: Update room status based on booking status using RoomService
        match updated_booking.status {
            BookingStatus::CheckedIn => {
                let _ = self.room_service.update_room_status(hotel_id, updated_booking.room_id, RoomStatus::Occupied).await;
                self.audit_service.record(Some(hotel_id), None, &format!("Check-in: Booking {}", updated_booking.id), None).await;
            },
            BookingStatus::CheckedOut => {
                let _ = self.room_service.update_room_status(hotel_id, updated_booking.room_id, RoomStatus::Dirty).await;
                self.audit_service.record(Some(hotel_id), None, &format!("Check-out: Booking {}", updated_booking.id), None).await;
                
                // Automate Invoice generation
                let invoice = Invoice::new(hotel_id, updated_booking.id, updated_booking.total_price_cents);
                let _ = self.invoice_repo.save(invoice).await;
            },
            BookingStatus::Cancelled => {
                self.audit_service.record(Some(hotel_id), None, &format!("Cancellation: Booking {}", updated_booking.id), None).await;
            },
            _ => {}
        }

        Ok(updated_booking)
    }

    pub async fn list_bookings(&self, hotel_id: Uuid) -> Result<Vec<Booking>, String> {
        self.booking_repo.find_all(hotel_id).await
    }

    pub async fn list_bookings_in_range(
        &self,
        hotel_id: Uuid,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<Vec<Booking>, String> {
        self.booking_repo.find_by_range(hotel_id, start, end).await
    }
}

fn map_repo_error(message: String) -> DomainError {
    if message == "BOOKING_OVERLAP" {
        DomainError::RoomNotAvailable
    } else {
        DomainError::InfrastructureError(message)
    }
}
