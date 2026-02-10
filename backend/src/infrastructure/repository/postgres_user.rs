use crate::domain::models::User;
use crate::domain::repositories::UserRepository;
use async_trait::async_trait;
use sqlx::{PgPool, Row};
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
        let record = sqlx::query(
            "SELECT id, username, password_hash, role FROM users WHERE username = $1",
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(record.map(|row| User {
            id: row.try_get("id").unwrap(),
            username: row.try_get("username").unwrap(),
            password_hash: row.try_get("password_hash").unwrap(),
            role: row.try_get("role").unwrap(),
        }))
    }

    async fn create(&self, user: User) -> Result<User, String> {
        sqlx::query("INSERT INTO users (id, username, password_hash, role) VALUES ($1, $2, $3, $4)")
            .bind(user.id)
            .bind(&user.username)
            .bind(&user.password_hash)
            .bind(&user.role)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(user)
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, String> {
        let record = sqlx::query("SELECT id, username, password_hash, role FROM users WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(record.map(|row| User {
            id: row.try_get("id").unwrap(),
            username: row.try_get("username").unwrap(),
            password_hash: row.try_get("password_hash").unwrap(),
            role: row.try_get("role").unwrap(),
        }))
    }

    async fn find_all(&self) -> Result<Vec<User>, String> {
        let records = sqlx::query(
            "SELECT id, username, password_hash, role FROM users ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(records
            .into_iter()
            .map(|row| User {
                id: row.try_get("id").unwrap(),
                username: row.try_get("username").unwrap(),
                password_hash: row.try_get("password_hash").unwrap(),
                role: row.try_get("role").unwrap(),
            })
            .collect())
    }
}
