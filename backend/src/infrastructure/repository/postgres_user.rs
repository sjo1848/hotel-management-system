use crate::domain::models::User;
use crate::domain::repositories::UserRepository;
use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

pub struct PostgresUserRepository {
    pool: PgPool,
}

impl PostgresUserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserRepository for PostgresUserRepository {
    async fn find_by_username(&self, username: &str) -> Result<Option<User>, String> {
        let record = sqlx::query!(
            "SELECT id, username, password_hash, role FROM users WHERE username = $1",
            username
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(record.map(|row| User {
            id: row.id,
            username: row.username,
            password_hash: row.password_hash,
            role: row.role,
        }))
    }

    async fn create(&self, user: User) -> Result<User, String> {
        sqlx::query!(
            "INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)",
            user.id,
            user.username,
            user.password_hash,
            user.role
        )
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(user)
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, String> {
        let record = sqlx::query!(
            "SELECT id, username, password_hash, role FROM users WHERE id = $1",
            id
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(record.map(|row| User {
            id: row.id,
            username: row.username,
            password_hash: row.password_hash,
            role: row.role,
        }))
    }
}
