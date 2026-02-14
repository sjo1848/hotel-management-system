use async_trait::async_trait;

#[derive(Debug, Clone)]
pub struct AccessTokenClaims {
    pub sub: String,
    pub hotel_id: String,
    pub role: String,
    pub exp: usize,
}

#[async_trait]
pub trait PasswordHasher: Send + Sync {
    async fn hash_password(&self, password: &str) -> Result<String, String>;
    async fn verify_password(&self, password: &str, hash: &str) -> Result<bool, String>;
}

#[async_trait]
pub trait TokenSigner: Send + Sync {
    async fn sign_access_token(&self, claims: &AccessTokenClaims) -> Result<String, String>;
    async fn verify_access_token(&self, token: &str) -> Result<AccessTokenClaims, String>;
}
