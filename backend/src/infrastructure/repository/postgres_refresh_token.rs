use crate::domain::models::RefreshToken;
use crate::domain::repositories::RefreshTokenRepository;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use sqlx::PgPool;
use uuid::Uuid;

pub struct PostgresRefreshTokenRepository {
    pool: PgPool,
}

impl PostgresRefreshTokenRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl RefreshTokenRepository for PostgresRefreshTokenRepository {
    async fn create(&self, token: RefreshToken) -> Result<RefreshToken, String> {
        sqlx::query!(
            "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked_at)
             VALUES ($1, $2, $3, $4, $5)",
            token.id,
            token.user_id,
            token.token_hash,
            token.expires_at,
            token.revoked_at
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(token)
    }

    async fn find_valid(&self, token_hash: &str) -> Result<Option<RefreshToken>, String> {
        let record = sqlx::query!(
            "SELECT id, user_id, token_hash, expires_at, revoked_at
             FROM refresh_tokens
             WHERE token_hash = $1 AND revoked_at IS NULL",
            token_hash
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(record.map(|row| RefreshToken {
            id: row.id,
            user_id: row.user_id,
            token_hash: row.token_hash,
            expires_at: row.expires_at,
            revoked_at: row.revoked_at,
        }))
    }

    async fn revoke(&self, token_id: Uuid) -> Result<(), String> {
        let now: NaiveDateTime = chrono::Utc::now().naive_utc();
        sqlx::query!(
            "UPDATE refresh_tokens SET revoked_at = $1 WHERE id = $2",
            now,
            token_id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    async fn revoke_all_for_user(&self, user_id: Uuid) -> Result<(), String> {
        let now: NaiveDateTime = chrono::Utc::now().naive_utc();
        sqlx::query!(
            "UPDATE refresh_tokens SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL",
            now,
            user_id
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(())
    }
}
