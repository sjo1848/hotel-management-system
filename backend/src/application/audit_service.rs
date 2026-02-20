use crate::domain::errors::DomainError;
use crate::domain::models::{AuditEvent, AuditEventPage, BookingPageCursor};
use crate::domain::repositories::AuditRepository;
use std::sync::Arc;
use uuid::Uuid;

pub struct AuditService {
    audit_repo: Arc<dyn AuditRepository>,
}

impl AuditService {
    pub fn new(audit_repo: Arc<dyn AuditRepository>) -> Self {
        Self { audit_repo }
    }

    pub async fn record(
        &self,
        hotel_id: Option<Uuid>,
        user_id: Option<Uuid>,
        action: &str,
        ip_address: Option<String>,
    ) {
        let event = AuditEvent {
            id: Uuid::new_v4(),
            hotel_id,
            user_id,
            action: action.to_string(),
            ip_address,
            created_at: chrono::Utc::now().naive_utc(),
        };

        let _ = self.audit_repo.record(event).await;
    }

    pub async fn list_recent(
        &self,
        hotel_id: Uuid,
        limit: i64,
    ) -> Result<Vec<AuditEvent>, DomainError> {
        self.audit_repo
            .find_recent_by_hotel(hotel_id, limit)
            .await
            .map_err(DomainError::InfrastructureError)
    }

    pub async fn list_recent_page(
        &self,
        hotel_id: Uuid,
        limit: usize,
        cursor: Option<BookingPageCursor>,
    ) -> Result<AuditEventPage, DomainError> {
        self.audit_repo
            .find_recent_page_by_hotel(hotel_id, limit, cursor)
            .await
            .map_err(DomainError::InfrastructureError)
    }
}
