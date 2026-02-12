use crate::domain::models::AuditEvent;
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
        user_id: Option<Uuid>,
        action: &str,
        ip_address: Option<String>,
    ) {
        let event = AuditEvent {
            id: Uuid::new_v4(),
            user_id,
            action: action.to_string(),
            ip_address,
            created_at: chrono::Utc::now().naive_utc(),
        };

        let _ = self.audit_repo.record(event).await;
    }
}
