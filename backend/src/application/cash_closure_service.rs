use crate::domain::errors::DomainError;
use crate::domain::models::{CashBalanceSnapshot, CashClosure};
use crate::domain::repositories::{
    CashClosureRepository, InvoiceRepository, PaymentEntryRepository,
};
use std::sync::Arc;
use uuid::Uuid;

pub struct CashClosureService {
    closure_repo: Arc<dyn CashClosureRepository>,
    invoice_repo: Arc<dyn InvoiceRepository>,
    payment_entry_repo: Arc<dyn PaymentEntryRepository>,
}

impl CashClosureService {
    pub fn new(
        closure_repo: Arc<dyn CashClosureRepository>,
        invoice_repo: Arc<dyn InvoiceRepository>,
        payment_entry_repo: Arc<dyn PaymentEntryRepository>,
    ) -> Self {
        Self {
            closure_repo,
            invoice_repo,
            payment_entry_repo,
        }
    }

    pub async fn get_current_balance(
        &self,
        hotel_id: Uuid,
    ) -> Result<CashBalanceSnapshot, DomainError> {
        let opening_time = self.get_current_shift_opening(hotel_id).await?;
        let (total, cash, card, payment_count) = self
            .payment_entry_repo
            .get_unclosed_summary(hotel_id, opening_time)
            .await
            .map_err(map_payment_entry_repo_error)?;
        let (pending_amount_cents, pending_bookings_count) = self
            .invoice_repo
            .get_outstanding_summary(hotel_id)
            .await
            .map_err(map_invoice_repo_error)?;

        Ok(CashBalanceSnapshot {
            total_amount_cents: total,
            cash_amount_cents: cash,
            card_amount_cents: card,
            payment_count,
            opening_time,
            pending_amount_cents,
            pending_bookings_count,
        })
    }

    pub async fn close_cash(
        &self,
        hotel_id: Uuid,
        user_id: Uuid,
        notes: Option<String>,
        expected_cash_amount_cents: Option<i64>,
        counted_cash_amount_cents: Option<i64>,
        handoff_to: Option<String>,
    ) -> Result<CashClosure, DomainError> {
        let balance = self.get_current_balance(hotel_id).await?;
        if expected_cash_amount_cents.is_some_and(|expected| expected != balance.cash_amount_cents)
        {
            return Err(DomainError::InvalidInput(
                "El efectivo esperado cambio; recarga el balance antes de cerrar".to_string(),
            ));
        }
        let closing_time = chrono::Utc::now().naive_utc();
        let counted_cash_amount_cents =
            counted_cash_amount_cents.unwrap_or(balance.cash_amount_cents);
        if counted_cash_amount_cents < 0 {
            return Err(DomainError::InvalidInput(
                "counted_cash_amount_cents no puede ser negativo".to_string(),
            ));
        }
        let handoff_to = handoff_to.unwrap_or_else(|| "Siguiente turno".to_string());
        if handoff_to.trim().is_empty() {
            return Err(DomainError::InvalidInput(
                "handoff_to no puede estar vacio".to_string(),
            ));
        }

        let closure = CashClosure {
            id: Uuid::new_v4(),
            hotel_id,
            user_id,
            total_amount_cents: balance.total_amount_cents,
            cash_amount_cents: balance.cash_amount_cents,
            card_amount_cents: balance.card_amount_cents,
            payment_count: balance.payment_count,
            counted_cash_amount_cents,
            cash_difference_cents: counted_cash_amount_cents - balance.cash_amount_cents,
            opening_time: balance.opening_time,
            closing_time,
            handoff_to,
            notes,
        };

        let result: Result<CashClosure, String> = self.closure_repo.create(closure).await;
        result.map_err(map_cash_closure_repo_error)
    }

    pub async fn list_closures(&self, hotel_id: Uuid) -> Result<Vec<CashClosure>, DomainError> {
        let result: Result<Vec<CashClosure>, String> = self.closure_repo.find_all(hotel_id).await;
        result.map_err(map_cash_closure_repo_error)
    }

    async fn get_current_shift_opening(
        &self,
        hotel_id: Uuid,
    ) -> Result<chrono::NaiveDateTime, DomainError> {
        let last_closure = self
            .closure_repo
            .find_latest(hotel_id)
            .await
            .map_err(map_cash_closure_repo_error)?;
        let has_prior_closure = last_closure.is_some();
        let baseline = last_closure
            .map(|closure| closure.closing_time)
            .unwrap_or_else(|| {
                chrono::DateTime::<chrono::Utc>::from_timestamp(0, 0)
                    .unwrap()
                    .naive_utc()
            });
        let first_payment = self
            .payment_entry_repo
            .get_earliest_unclosed_payment_at(hotel_id, baseline)
            .await
            .map_err(map_payment_entry_repo_error)?;
        Ok(first_payment.unwrap_or_else(|| {
            if !has_prior_closure {
                chrono::Utc::now().naive_utc()
            } else {
                baseline
            }
        }))
    }
}

fn map_cash_closure_repo_error(message: String) -> DomainError {
    match message.as_str() {
        "CASH_CLOSURE_USER_NOT_FOUND" => DomainError::UserNotFound,
        "CASH_CLOSURE_HOTEL_NOT_FOUND" => DomainError::HotelNotFound,
        "CASH_SHIFT_ALREADY_CLOSED" => DomainError::InvalidInput(
            "El turno ya fue cerrado por otro proceso; recarga el balance".to_string(),
        ),
        "CASH_SHIFT_BALANCE_CHANGED" => DomainError::InvalidInput(
            "El balance cambio durante el cierre; recarga antes de confirmar".to_string(),
        ),
        _ => DomainError::InfrastructureError(message),
    }
}

fn map_invoice_repo_error(message: String) -> DomainError {
    match message.as_str() {
        "INVOICE_HOTEL_NOT_FOUND" => DomainError::HotelNotFound,
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
    fn map_cash_closure_repo_error_maps_functional_markers() {
        assert!(matches!(
            map_cash_closure_repo_error("CASH_CLOSURE_USER_NOT_FOUND".to_string()),
            DomainError::UserNotFound
        ));
        assert!(matches!(
            map_cash_closure_repo_error("CASH_CLOSURE_HOTEL_NOT_FOUND".to_string()),
            DomainError::HotelNotFound
        ));
    }

    #[test]
    fn map_invoice_repo_error_maps_functional_markers() {
        assert!(matches!(
            map_invoice_repo_error("INVOICE_HOTEL_NOT_FOUND".to_string()),
            DomainError::HotelNotFound
        ));
    }

    #[test]
    fn map_payment_entry_repo_error_maps_functional_markers() {
        assert!(matches!(
            map_payment_entry_repo_error("PAYMENT_ENTRY_INVOICE_NOT_FOUND".to_string()),
            DomainError::InvoiceNotFound
        ));
    }
}
