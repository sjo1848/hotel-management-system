use crate::domain::errors::DomainError;
use crate::domain::models::User;
use crate::domain::repositories::UserRepository;
use crate::domain::security::PasswordHasher;
use std::sync::Arc;
use uuid::Uuid;

pub struct UserService {
    user_repo: Arc<dyn UserRepository>,
    password_hasher: Arc<dyn PasswordHasher>,
}

impl UserService {
    pub fn new(
        user_repo: Arc<dyn UserRepository>,
        password_hasher: Arc<dyn PasswordHasher>,
    ) -> Self {
        Self {
            user_repo,
            password_hasher,
        }
    }

    pub async fn list_users(&self, hotel_id: Uuid) -> Result<Vec<User>, DomainError> {
        self.user_repo
            .find_all(hotel_id)
            .await
            .map_err(DomainError::InfrastructureError)
    }

    pub async fn find_user(
        &self,
        hotel_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<User>, DomainError> {
        self.user_repo
            .find_by_id(hotel_id, user_id)
            .await
            .map_err(DomainError::InfrastructureError)
    }

    pub async fn create_user(
        &self,
        hotel_id: Uuid,
        username: String,
        password: String,
        role: String,
    ) -> Result<User, DomainError> {
        let hash = self
            .password_hasher
            .hash_password(&password)
            .await
            .map_err(DomainError::InfrastructureError)?;

        let user = User {
            id: Uuid::new_v4(),
            hotel_id,
            username,
            password_hash: hash,
            role,
        };

        self.user_repo
            .create(user)
            .await
            .map_err(map_user_repo_error)
    }

    pub async fn delete_user(&self, hotel_id: Uuid, user_id: Uuid) -> Result<(), DomainError> {
        self.user_repo
            .delete(hotel_id, user_id)
            .await
            .map_err(map_user_repo_error)
    }
}

fn map_user_repo_error(message: String) -> DomainError {
    match message.as_str() {
        "USER_ALREADY_EXISTS" => DomainError::UserAlreadyExists,
        "USER_NOT_FOUND" => DomainError::UserNotFound,
        "USER_HOTEL_NOT_FOUND" => DomainError::HotelNotFound,
        _ => DomainError::InfrastructureError(message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn map_user_repo_error_maps_hotel_fk_violation() {
        let error = "USER_HOTEL_NOT_FOUND";
        assert!(matches!(
            map_user_repo_error(error.to_string()),
            DomainError::HotelNotFound
        ));
    }

    #[test]
    fn map_user_repo_error_maps_user_not_found_marker() {
        assert!(matches!(
            map_user_repo_error("USER_NOT_FOUND".to_string()),
            DomainError::UserNotFound
        ));
    }
}
