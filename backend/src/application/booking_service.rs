use crate::domain::errors::DomainError;
use crate::domain::models::{Booking, BookingStatus, Invoice};
use crate::domain::repositories::{BookingRepository, RoomRepository, AuditRepository, InvoiceRepository};
use chrono::NaiveDate;
use std::sync::Arc;
use uuid::Uuid;

pub struct BookingService {
    booking_repo: Arc<dyn BookingRepository>,
    room_repo: Arc<dyn RoomRepository>,
    audit_repo: Arc<dyn AuditRepository>,
    invoice_repo: Arc<dyn InvoiceRepository>,
}

impl BookingService {
    pub fn new(
        booking_repo: Arc<dyn BookingRepository>,
        room_repo: Arc<dyn RoomRepository>,
        audit_repo: Arc<dyn AuditRepository>,
        invoice_repo: Arc<dyn InvoiceRepository>,
    ) -> Self {
        Self {
            booking_repo,
            room_repo,
            audit_repo,
            invoice_repo,
        }
    }

    pub async fn execute(
        &self,
        room_id: Uuid,
        guest_id: Option<Uuid>,
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

        self.record_audit(guest_id, &format!("New Booking created: {}", saved_booking.id)).await;
        
        Ok(saved_booking)
    }

    pub async fn update_booking(
        &self,
        booking_id: Uuid,
        guest_id: Option<Uuid>,
        guest_name: Option<String>,
        check_in: Option<NaiveDate>,
        check_out: Option<NaiveDate>,
        status: Option<BookingStatus>,
    ) -> Result<Booking, DomainError> {
        let mut booking = self
            .booking_repo
            .find_by_id(booking_id)
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
            .find_by_id(booking.room_id)
            .await
            .map_err(DomainError::InfrastructureError)?
            .ok_or(DomainError::RoomNotFound)?;

        booking.calculate_total_price(room.price_cents);

        let updated_booking = self.booking_repo
            .update(booking)
            .await
            .map_err(map_repo_error)?;

        // Side effect: Update room status based on booking status
        match updated_booking.status {
            BookingStatus::CheckedIn => {
                let _ = self.room_repo.update_status(updated_booking.room_id, crate::domain::models::RoomStatus::Occupied).await;
                self.record_audit(None, &format!("Check-in: Booking {}", updated_booking.id)).await;
            },
            BookingStatus::CheckedOut => {
                let _ = self.room_repo.update_status(updated_booking.room_id, crate::domain::models::RoomStatus::Dirty).await;
                self.record_audit(None, &format!("Check-out: Booking {}", updated_booking.id)).await;
                
                // Automate Invoice generation
                let invoice = Invoice::new(updated_booking.id, updated_booking.total_price_cents);
                let _ = self.invoice_repo.save(invoice).await;
            },
            BookingStatus::Cancelled => {
                self.record_audit(None, &format!("Cancellation: Booking {}", updated_booking.id)).await;
            },
            _ => {}
        }

        Ok(updated_booking)
    }

    pub async fn list_bookings(&self) -> Result<Vec<Booking>, String> {
        self.booking_repo.find_all().await
    }

    pub async fn list_bookings_in_range(
        &self,
        start: NaiveDate,
        end: NaiveDate,
    ) -> Result<Vec<Booking>, String> {
        self.booking_repo.find_by_range(start, end).await
    }

    async fn record_audit(&self, user_id: Option<Uuid>, action: &str) {
        let event = crate::domain::models::AuditEvent {
            id: Uuid::new_v4(),
            user_id,
            action: action.to_string(),
            ip_address: None,
            created_at: chrono::Utc::now().naive_utc(),
        };
        let _ = self.audit_repo.record(event).await;
    }
}

fn map_repo_error(message: String) -> DomainError {
    if message == "BOOKING_OVERLAP" {
        DomainError::RoomNotAvailable
    } else {
        DomainError::InfrastructureError(message)
    }
}
