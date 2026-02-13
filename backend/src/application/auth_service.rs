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
            .map_err(map_user_repo_error)?
            .ok_or(DomainError::Unauthorized)?;

        let valid =
            crate::infrastructure::web::passwords::verify_password(password, &user.password_hash)
                .map_err(|_| DomainError::Unauthorized)?;

        if !valid {
            return Err(DomainError::Unauthorized);
        }

        Ok(user)
    }

    pub async fn issue_refresh_token(
        &self,
        hotel_id: Uuid,
        user_id: Uuid,
        device_id: String,
        session_id: Option<Uuid>,
    ) -> Result<(String, RefreshToken), DomainError> {
        let mut random_bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut random_bytes);
        let raw_token = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(random_bytes);

        let token_hash = hash_token(&raw_token);
        let expires_at = (Utc::now() + Duration::days(self.refresh_ttl_days)).naive_utc();
        let normalized_device_id = normalize_device_id(&device_id);

        let refresh = RefreshToken {
            id: Uuid::new_v4(),
            hotel_id,
            user_id,
            session_id: session_id.unwrap_or_else(Uuid::new_v4),
            device_id: normalized_device_id,
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
            .issue_refresh_token(
                refresh.hotel_id,
                refresh.user_id,
                refresh.device_id.clone(),
                Some(refresh.session_id),
            )
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

    pub async fn revoke_user_device_tokens(
        &self,
        hotel_id: Uuid,
        user_id: Uuid,
        device_id: &str,
    ) -> Result<(), DomainError> {
        self.refresh_repo
            .revoke_all_for_device(hotel_id, user_id, &normalize_device_id(device_id))
            .await
            .map_err(map_refresh_repo_error)
    }

    pub async fn revoke_session_tokens(
        &self,
        hotel_id: Uuid,
        user_id: Uuid,
        session_id: Uuid,
    ) -> Result<(), DomainError> {
        self.refresh_repo
            .revoke_all_for_session(hotel_id, user_id, session_id)
            .await
            .map_err(map_refresh_repo_error)
    }

    pub async fn revoke_refresh_token_with_context(
        &self,
        raw_token: &str,
    ) -> Result<RefreshToken, DomainError> {
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

        Ok(refresh)
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

    pub async fn get_session_user(
        &self,
        hotel_id: Uuid,
        user_id: Uuid,
    ) -> Result<User, DomainError> {
        self.user_repo
            .find_by_id(hotel_id, user_id)
            .await
            .map_err(map_user_repo_error)?
            .ok_or(DomainError::Unauthorized)
    }
}

fn hash_token(raw: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    let digest = hasher.finalize();
    format!("{:x}", digest)
}

fn normalize_device_id(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return "unknown".to_string();
    }
    let mut normalized = String::with_capacity(trimmed.len().min(128));
    for ch in trimmed.chars() {
        if normalized.len() >= 128 {
            break;
        }
        if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.' | ':') {
            normalized.push(ch.to_ascii_lowercase());
        } else {
            normalized.push('_');
        }
    }
    if normalized.is_empty() {
        "unknown".to_string()
    } else {
        normalized
    }
}

fn map_refresh_repo_error(message: String) -> DomainError {
    match message.as_str() {
        // En autenticación no exponemos detalle de existencia de sujeto/hotel
        "REFRESH_TOKEN_SUBJECT_NOT_FOUND"
        | "REFRESH_TOKEN_HOTEL_NOT_FOUND"
        | "REFRESH_TOKEN_NOT_FOUND" => DomainError::Unauthorized,
        _ => DomainError::InfrastructureError(message),
    }
}

fn map_user_repo_error(message: String) -> DomainError {
    match message.as_str() {
        "USER_NOT_FOUND" | "USER_HOTEL_NOT_FOUND" => DomainError::Unauthorized,
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
        assert!(matches!(
            map_refresh_repo_error("REFRESH_TOKEN_NOT_FOUND".to_string()),
            DomainError::Unauthorized
        ));
    }

    #[test]
    fn map_user_repo_error_masks_user_markers_as_unauthorized() {
        assert!(matches!(
            map_user_repo_error("USER_NOT_FOUND".to_string()),
            DomainError::Unauthorized
        ));
        assert!(matches!(
            map_user_repo_error("USER_HOTEL_NOT_FOUND".to_string()),
            DomainError::Unauthorized
        ));
    }

    #[test]
    fn normalize_device_id_sanitizes_and_bounds() {
        assert_eq!(normalize_device_id(""), "unknown");
        assert_eq!(normalize_device_id("  "), "unknown");
        assert_eq!(normalize_device_id("Desk-01"), "desk-01");
        assert_eq!(normalize_device_id("Mobile Safari/17"), "mobile_safari_17");
        assert_eq!(normalize_device_id(&"A".repeat(200)).len(), 128);
    }
}
