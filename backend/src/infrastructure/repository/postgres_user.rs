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
    async fn find_by_username(
        &self,
        hotel_id: Uuid,
        username: &str,
    ) -> Result<Option<User>, String> {
        let record = sqlx::query(
            "SELECT id, hotel_id, username, password_hash, role FROM users WHERE hotel_id = $1 AND username = $2",
        )
        .bind(hotel_id)
        .bind(username)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(record.map(|row| User {
            id: row.try_get("id").unwrap(),
            hotel_id: row.try_get("hotel_id").unwrap(),
            username: row.try_get("username").unwrap(),
            password_hash: row.try_get("password_hash").unwrap(),
            role: row.try_get("role").unwrap(),
        }))
    }

    async fn create(&self, user: User) -> Result<User, String> {
        sqlx::query("INSERT INTO users (id, hotel_id, username, password_hash, role) VALUES ($1, $2, $3, $4, $5)")
            .bind(user.id)
            .bind(user.hotel_id)
            .bind(&user.username)
            .bind(&user.password_hash)
            .bind(&user.role)
            .execute(&self.pool)
            .await
            .map_err(map_db_error)?;

        Ok(user)
    }

    async fn find_by_id(&self, hotel_id: Uuid, id: Uuid) -> Result<Option<User>, String> {
        let record = sqlx::query("SELECT id, hotel_id, username, password_hash, role FROM users WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(record.map(|row| User {
            id: row.try_get("id").unwrap(),
            hotel_id: row.try_get("hotel_id").unwrap(),
            username: row.try_get("username").unwrap(),
            password_hash: row.try_get("password_hash").unwrap(),
            role: row.try_get("role").unwrap(),
        }))
    }

    async fn find_all(&self, hotel_id: Uuid) -> Result<Vec<User>, String> {
        let records = sqlx::query(
            "SELECT id, hotel_id, username, password_hash, role FROM users WHERE hotel_id = $1 ORDER BY created_at DESC",
        )
        .bind(hotel_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(records
            .into_iter()
            .map(|row| User {
                id: row.try_get("id").unwrap(),
                hotel_id: row.try_get("hotel_id").unwrap(),
                username: row.try_get("username").unwrap(),
                password_hash: row.try_get("password_hash").unwrap(),
                role: row.try_get("role").unwrap(),
            })
            .collect())
    }

    async fn delete(&self, hotel_id: Uuid, id: Uuid) -> Result<(), String> {
        let result = sqlx::query("DELETE FROM users WHERE hotel_id = $1 AND id = $2")
            .bind(hotel_id)
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        if result.rows_affected() == 0 {
            return Err("USER_NOT_FOUND".to_string());
        }
        Ok(())
    }
}

fn map_db_error(error: sqlx::Error) -> String {
    if let sqlx::Error::Database(db_error) = &error {
        if let Some(code) = db_error.code() {
            if code == "23505" {
                let constraint_name = db_error.constraint().unwrap_or_default();
                if constraint_name == "ux_users_hotel_username"
                    || constraint_name == "users_username_key"
                {
                    return "USER_ALREADY_EXISTS".to_string();
                }
            }
            if code == "23503" {
                let constraint_name = db_error.constraint().unwrap_or_default();
                if constraint_name == "users_hotel_id_fkey" {
                    return "USER_HOTEL_NOT_FOUND".to_string();
                }
            }
        }
    }
    error.to_string()
}
