use crate::domain::errors::DomainError;
use crate::domain::models::{RefreshToken, User};
use crate::domain::repositories::{RefreshTokenRepository, UserRepository};
use base64::Engine;
use chrono::{Duration, Utc};
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;

pub struct AuthService {
    user_repo: Arc<dyn UserRepository>,
    refresh_repo: Arc<dyn RefreshTokenRepository>,
    access_ttl_minutes: i64,
    refresh_ttl_days: i64,
}

impl AuthService {
    pub fn new(
        user_repo: Arc<dyn UserRepository>,
        refresh_repo: Arc<dyn RefreshTokenRepository>,
        access_ttl_minutes: i64,
        refresh_ttl_days: i64,
    ) -> Self {
        Self {
            user_repo,
            refresh_repo,
            access_ttl_minutes,
            refresh_ttl_days,
        }
    }

    pub fn access_exp(&self) -> usize {
        (Utc::now() + Duration::minutes(self.access_ttl_minutes))
            .timestamp()
            .max(0) as usize
    }

    pub fn access_ttl_seconds(&self) -> usize {
        (self.access_ttl_minutes * 60).max(0) as usize
    }

    pub async fn verify_user(
        &self,
        hotel_id: Uuid,
        username: &str,
        password: &str,
    ) -> Result<User, DomainError> {
        let user = self
            .user_repo
            .find_by_username(hotel_id, username)
            .await
            .map_err(DomainError::InfrastructureError)?
            .ok_or(DomainError::Unauthorized)?;

        let valid =
            crate::infrastructure::web::passwords::verify_password(password, &user.password_hash)
                .map_err(DomainError::InfrastructureError)?;

        if !valid {
            return Err(DomainError::Unauthorized);
        }

        Ok(user)
    }

    pub async fn issue_refresh_token(
        &self,
        hotel_id: Uuid,
        user_id: Uuid,
    ) -> Result<(String, RefreshToken), DomainError> {
        let mut random_bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut random_bytes);
        let raw_token = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(random_bytes);

        let token_hash = hash_token(&raw_token);
        let expires_at = (Utc::now() + Duration::days(self.refresh_ttl_days)).naive_utc();

        let refresh = RefreshToken {
            id: Uuid::new_v4(),
            hotel_id,
            user_id,
            token_hash,
            expires_at,
            revoked_at: None,
        };

        let saved = self
            .refresh_repo
            .create(refresh)
            .await
            .map_err(map_refresh_repo_error)?;

        Ok((raw_token, saved))
    }

    pub async fn rotate_refresh_token(
        &self,
        raw_token: &str,
    ) -> Result<(Uuid, Uuid, String, RefreshToken), DomainError> {
        let token_hash = hash_token(raw_token);
        let refresh = self
            .refresh_repo
            .find_valid(&token_hash)
            .await
            .map_err(map_refresh_repo_error)?
            .ok_or(DomainError::Unauthorized)?;

        if refresh.expires_at < Utc::now().naive_utc() {
            return Err(DomainError::Unauthorized);
        }

        self.refresh_repo
            .revoke(refresh.id)
            .await
            .map_err(map_refresh_repo_error)?;

        let (new_raw, new_refresh) = self
            .issue_refresh_token(refresh.hotel_id, refresh.user_id)
            .await?;

        Ok((refresh.hotel_id, refresh.user_id, new_raw, new_refresh))
    }

    pub async fn revoke_refresh_token(&self, raw_token: &str) -> Result<(Uuid, Uuid), DomainError> {
        let token_hash = hash_token(raw_token);
        let refresh = self
            .refresh_repo
            .find_valid(&token_hash)
            .await
            .map_err(map_refresh_repo_error)?
            .ok_or(DomainError::Unauthorized)?;

        self.refresh_repo
            .revoke(refresh.id)
            .await
            .map_err(map_refresh_repo_error)?;

        Ok((refresh.hotel_id, refresh.user_id))
    }

    pub async fn revoke_user_tokens(
        &self,
        hotel_id: Uuid,
        user_id: Uuid,
    ) -> Result<(), DomainError> {
        self.refresh_repo
            .revoke_all_for_user(hotel_id, user_id)
            .await
            .map_err(map_refresh_repo_error)
    }
}

fn hash_token(raw: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    let digest = hasher.finalize();
    format!("{:x}", digest)
}

fn map_refresh_repo_error(message: String) -> DomainError {
    match message.as_str() {
        // En autenticación no exponemos detalle de existencia de sujeto/hotel
        "REFRESH_TOKEN_SUBJECT_NOT_FOUND" | "REFRESH_TOKEN_HOTEL_NOT_FOUND" => {
            DomainError::Unauthorized
        }
        _ => DomainError::InfrastructureError(message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_token_is_deterministic() {
        let first = hash_token("token");
        let second = hash_token("token");
        assert_eq!(first, second);
    }

    #[test]
    fn map_refresh_repo_error_masks_subject_fk_as_unauthorized() {
        assert!(matches!(
            map_refresh_repo_error("REFRESH_TOKEN_SUBJECT_NOT_FOUND".to_string()),
            DomainError::Unauthorized
        ));
        assert!(matches!(
            map_refresh_repo_error("REFRESH_TOKEN_HOTEL_NOT_FOUND".to_string()),
            DomainError::Unauthorized
        ));
    }
}
