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
            "INSERT INTO refresh_tokens (id, hotel_id, user_id, token_hash, expires_at, revoked_at)
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(token.id)
        .bind(token.hotel_id)
        .bind(token.user_id)
        .bind(&token.token_hash)
        .bind(token.expires_at)
        .bind(token.revoked_at)
        .execute(&self.pool)
        .await
        .map_err(map_db_error)?;

        Ok(token)
    }

    async fn find_valid(&self, token_hash: &str) -> Result<Option<RefreshToken>, String> {
        let record = sqlx::query(
            "SELECT id, hotel_id, user_id, token_hash, expires_at, revoked_at
             FROM refresh_tokens
             WHERE token_hash = $1 AND revoked_at IS NULL",
        )
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_db_error)?;

        Ok(record.map(|row| RefreshToken {
            id: row.try_get("id").unwrap(),
            hotel_id: row.try_get("hotel_id").unwrap(),
            user_id: row.try_get("user_id").unwrap(),
            token_hash: row.try_get("token_hash").unwrap(),
            expires_at: row.try_get("expires_at").unwrap(),
            revoked_at: row.try_get("revoked_at").ok(),
        }))
    }

    async fn revoke(&self, token_id: Uuid) -> Result<(), String> {
        let now: NaiveDateTime = chrono::Utc::now().naive_utc();
        let result = sqlx::query("UPDATE refresh_tokens SET revoked_at = $1 WHERE id = $2")
            .bind(now)
            .bind(token_id)
            .execute(&self.pool)
            .await
            .map_err(map_db_error)?;

        if result.rows_affected() == 0 {
            return Err("REFRESH_TOKEN_NOT_FOUND".to_string());
        }

        Ok(())
    }

    async fn revoke_all_for_user(&self, hotel_id: Uuid, user_id: Uuid) -> Result<(), String> {
        let now: NaiveDateTime = chrono::Utc::now().naive_utc();
        sqlx::query(
            "UPDATE refresh_tokens SET revoked_at = $1 WHERE hotel_id = $2 AND user_id = $3 AND revoked_at IS NULL",
        )
        .bind(now)
        .bind(hotel_id)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(map_db_error)?;

        Ok(())
    }
}

fn map_db_error(error: sqlx::Error) -> String {
    if let sqlx::Error::Database(db_error) = &error {
        if let Some(code) = db_error.code() {
            if code == "23503" {
                let constraint_name = db_error.constraint().unwrap_or_default();
                if constraint_name == "fk_refresh_tokens_hotel_user" {
                    return "REFRESH_TOKEN_SUBJECT_NOT_FOUND".to_string();
                }
                if constraint_name == "refresh_tokens_hotel_id_fkey" {
                    return "REFRESH_TOKEN_HOTEL_NOT_FOUND".to_string();
                }
            }
        }
    }
    error.to_string()
}
