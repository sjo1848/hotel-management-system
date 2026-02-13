use crate::domain::errors::DomainError;
use crate::domain::models::CashClosure;
use crate::domain::repositories::{CashClosureRepository, InvoiceRepository};
use std::sync::Arc;
use uuid::Uuid;

pub struct CashClosureService {
    closure_repo: Arc<dyn CashClosureRepository>,
    invoice_repo: Arc<dyn InvoiceRepository>,
}

impl CashClosureService {
    pub fn new(
        closure_repo: Arc<dyn CashClosureRepository>,
        invoice_repo: Arc<dyn InvoiceRepository>,
    ) -> Self {
        Self {
            closure_repo,
            invoice_repo,
        }
    }

    pub async fn get_current_balance(
        &self,
        hotel_id: Uuid,
    ) -> Result<(i64, i64, i64), DomainError> {
        self.invoice_repo
            .get_unclosed_total(hotel_id)
            .await
            .map_err(map_invoice_repo_error)
    }

    pub async fn close_cash(
        &self,
        hotel_id: Uuid,
        user_id: Uuid,
        notes: Option<String>,
    ) -> Result<CashClosure, DomainError> {
        let (total, cash, card) = self.get_current_balance(hotel_id).await?;

        // Obtenemos el tiempo del último cierre para marcar el inicio de este periodo
        // Por simplicidad, usaremos el mismo método que get_unclosed_total pero devolviendo la fecha
        // Por ahora, asumiremos que el periodo es desde el último cierre hasta ahora.

        let closure = CashClosure {
            id: Uuid::new_v4(),
            hotel_id,
            user_id,
            total_amount_cents: total,
            cash_amount_cents: cash,
            card_amount_cents: card,
            opening_time: chrono::Utc::now().naive_utc(), // Simplificado: debería ser la fecha del último cierre
            closing_time: chrono::Utc::now().naive_utc(),
            notes,
        };

        let result: Result<CashClosure, String> = self.closure_repo.create(closure).await;
        result.map_err(map_cash_closure_repo_error)
    }

    pub async fn list_closures(&self, hotel_id: Uuid) -> Result<Vec<CashClosure>, DomainError> {
        let result: Result<Vec<CashClosure>, String> = self.closure_repo.find_all(hotel_id).await;
        result.map_err(map_cash_closure_repo_error)
    }
}

fn map_cash_closure_repo_error(message: String) -> DomainError {
    match message.as_str() {
        "CASH_CLOSURE_USER_NOT_FOUND" => DomainError::UserNotFound,
        "CASH_CLOSURE_HOTEL_NOT_FOUND" => DomainError::HotelNotFound,
        _ => DomainError::InfrastructureError(message),
    }
}

fn map_invoice_repo_error(message: String) -> DomainError {
    match message.as_str() {
        "INVOICE_HOTEL_NOT_FOUND" => DomainError::HotelNotFound,
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
}
