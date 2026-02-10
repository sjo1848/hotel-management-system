use crate::domain::models::RefreshToken;
use crate::domain::repositories::RefreshTokenRepository;
use async_trait::async_trait;
use chrono::NaiveDateTime;
use sqlx::{PgPool, Row};
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
        sqlx::query(
            "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, revoked_at)
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(token.id)
        .bind(token.user_id)
        .bind(&token.token_hash)
        .bind(token.expires_at)
        .bind(token.revoked_at)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(token)
    }

    async fn find_valid(&self, token_hash: &str) -> Result<Option<RefreshToken>, String> {
        let record = sqlx::query(
            "SELECT id, user_id, token_hash, expires_at, revoked_at
             FROM refresh_tokens
             WHERE token_hash = $1 AND revoked_at IS NULL",
        )
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(record.map(|row| RefreshToken {
            id: row.try_get("id").unwrap(),
            user_id: row.try_get("user_id").unwrap(),
            token_hash: row.try_get("token_hash").unwrap(),
            expires_at: row.try_get("expires_at").unwrap(),
            revoked_at: row.try_get("revoked_at").unwrap(),
        }))
    }

    async fn revoke(&self, token_id: Uuid) -> Result<(), String> {
        let now: NaiveDateTime = chrono::Utc::now().naive_utc();
        sqlx::query("UPDATE refresh_tokens SET revoked_at = $1 WHERE id = $2")
            .bind(now)
            .bind(token_id)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    async fn revoke_all_for_user(&self, user_id: Uuid) -> Result<(), String> {
        let now: NaiveDateTime = chrono::Utc::now().naive_utc();
        sqlx::query(
            "UPDATE refresh_tokens SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL",
        )
        .bind(now)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(())
    }
}
