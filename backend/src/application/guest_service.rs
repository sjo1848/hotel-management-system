use crate::domain::errors::DomainError;
use crate::domain::models::Guest;
use crate::domain::repositories::GuestRepository;
use std::sync::Arc;
use uuid::Uuid;

pub struct GuestService {
    guest_repo: Arc<dyn GuestRepository>,
}

impl GuestService {
    pub fn new(guest_repo: Arc<dyn GuestRepository>) -> Self {
        Self { guest_repo }
    }

    pub async fn list_guests(&self) -> Result<Vec<Guest>, DomainError> {
        self.guest_repo
            .find_all()
            .await
            .map_err(DomainError::InfrastructureError)
    }

    pub async fn create_guest(
        &self,
        full_name: String,
        email: String,
        phone: Option<String>,
    ) -> Result<Guest, DomainError> {
        if full_name.trim().is_empty() {
            return Err(DomainError::InvalidInput("El nombre no puede estar vacío".to_string()));
        }

        if !email.contains('@') {
            return Err(DomainError::InvalidInput("Email inválido".to_string()));
        }

        let new_guest = Guest {
            id: Uuid::new_v4(),
            full_name,
            email,
            phone,
        };

        self.guest_repo
            .create(new_guest)
            .await
            .map_err(DomainError::InfrastructureError)
    }
}
