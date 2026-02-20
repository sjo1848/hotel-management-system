use crate::domain::errors::DomainError;
use crate::domain::models::{BookingPageCursor, Guest, GuestPage};
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

    pub async fn list_guests(&self, hotel_id: Uuid) -> Result<Vec<Guest>, DomainError> {
        self.guest_repo
            .find_all(hotel_id)
            .await
            .map_err(DomainError::InfrastructureError)
    }

    pub async fn list_guests_page(
        &self,
        hotel_id: Uuid,
        limit: usize,
        cursor: Option<BookingPageCursor>,
    ) -> Result<GuestPage, DomainError> {
        self.guest_repo
            .find_page(hotel_id, limit, cursor)
            .await
            .map_err(DomainError::InfrastructureError)
    }

    pub async fn create_guest(
        &self,
        hotel_id: Uuid,
        full_name: String,
        email: String,
        phone: Option<String>,
    ) -> Result<Guest, DomainError> {
        if full_name.trim().is_empty() {
            return Err(DomainError::InvalidInput(
                "El nombre no puede estar vacío".to_string(),
            ));
        }

        if !email.contains('@') {
            return Err(DomainError::InvalidInput("Email inválido".to_string()));
        }

        let new_guest = Guest {
            id: Uuid::new_v4(),
            hotel_id,
            full_name,
            email,
            phone,
            created_at: None,
        };

        self.guest_repo
            .create(new_guest)
            .await
            .map_err(map_guest_repo_error)
    }
}

fn map_guest_repo_error(message: String) -> DomainError {
    match message.as_str() {
        "GUEST_ALREADY_EXISTS" => DomainError::GuestAlreadyExists,
        "GUEST_HOTEL_NOT_FOUND" => DomainError::HotelNotFound,
        _ => DomainError::InfrastructureError(message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn map_guest_repo_error_maps_hotel_fk_violation() {
        let error = "GUEST_HOTEL_NOT_FOUND";
        assert!(matches!(
            map_guest_repo_error(error.to_string()),
            DomainError::HotelNotFound
        ));
    }
}
