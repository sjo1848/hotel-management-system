use crate::domain::errors::DomainError;
use crate::domain::models::Invoice;
use crate::domain::repositories::InvoiceRepository;
use std::sync::Arc;
use uuid::Uuid;

pub struct InvoiceService {
    invoice_repo: Arc<dyn InvoiceRepository>,
}

impl InvoiceService {
    pub fn new(invoice_repo: Arc<dyn InvoiceRepository>) -> Self {
        Self { invoice_repo }
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
}
