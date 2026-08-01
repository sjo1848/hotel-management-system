use crate::domain::errors::DomainError;
use crate::domain::models::{Invoice, PaymentEntry};
use crate::domain::repositories::{InvoiceRepository, PaymentEntryRepository};
use std::sync::Arc;
use uuid::Uuid;

pub struct InvoiceService {
    invoice_repo: Arc<dyn InvoiceRepository>,
    payment_entry_repo: Arc<dyn PaymentEntryRepository>,
}

impl InvoiceService {
    pub fn new(
        invoice_repo: Arc<dyn InvoiceRepository>,
        payment_entry_repo: Arc<dyn PaymentEntryRepository>,
    ) -> Self {
        Self {
            invoice_repo,
            payment_entry_repo,
        }
    }

    pub async fn list_invoices(&self, hotel_id: Uuid) -> Result<Vec<Invoice>, DomainError> {
        self.invoice_repo
            .find_all(hotel_id)
            .await
            .map_err(DomainError::InfrastructureError)
    }

    pub async fn get_invoice_by_booking(
        &self,
        hotel_id: Uuid,
        booking_id: Uuid,
    ) -> Result<Invoice, DomainError> {
        self.invoice_repo
            .find_by_booking(hotel_id, booking_id)
            .await
            .map_err(DomainError::InfrastructureError)?
            .ok_or(DomainError::InvoiceNotFound)
    }

    pub async fn list_payments_by_booking(
        &self,
        hotel_id: Uuid,
        booking_id: Uuid,
    ) -> Result<Vec<PaymentEntry>, DomainError> {
        self.payment_entry_repo
            .find_by_booking(hotel_id, booking_id)
            .await
            .map_err(DomainError::InfrastructureError)
    }
}
