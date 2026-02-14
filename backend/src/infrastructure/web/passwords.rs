use crate::domain::security::PasswordHasher as PasswordHasherPort;
use argon2::{password_hash::SaltString, Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use async_trait::async_trait;
use rand::rngs::OsRng;

#[derive(Default)]
pub struct ArgonPasswordHasher;

#[async_trait]
impl PasswordHasherPort for ArgonPasswordHasher {
    async fn hash_password(&self, password: &str) -> Result<String, String> {
        hash_password(password)
    }

    async fn verify_password(&self, password: &str, hash: &str) -> Result<bool, String> {
        verify_password(password, hash)
    }
}

pub fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| e.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, String> {
    let parsed = PasswordHash::new(hash).map_err(|e| e.to_string())?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn password_hash_roundtrip() {
        let hash = hash_password("secret").unwrap();
        assert!(verify_password("secret", &hash).unwrap());
        assert!(!verify_password("wrong", &hash).unwrap());
    }
}
