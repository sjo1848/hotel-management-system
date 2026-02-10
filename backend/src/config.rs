use std::env;

#[derive(Clone)]
pub struct AppConfig {
    pub database_url: String,
    pub jwt_secret: String,
    pub auth_required: bool,
    pub cors_origin: String,
    pub admin_user: String,
    pub admin_password: String,
    pub admin_role: String,
}

impl AppConfig {
    pub fn from_env() -> Self {
        let database_url =
            env::var("DATABASE_URL").unwrap_or_else(|_| "postgres://admin:password123@db:5432/hms_core".to_string());
        let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".to_string());
        let auth_required = env::var("AUTH_REQUIRED")
            .unwrap_or_else(|_| "true".to_string())
            .to_lowercase()
            == "true";
        let cors_origin =
            env::var("CORS_ORIGIN").unwrap_or_else(|_| "http://localhost:5173".to_string());
        let admin_user = env::var("ADMIN_USER").unwrap_or_else(|_| "admin".to_string());
        let admin_password = env::var("ADMIN_PASSWORD").unwrap_or_else(|_| "admin123".to_string());
        let admin_role = env::var("ADMIN_ROLE").unwrap_or_else(|_| "admin".to_string());

        Self {
            database_url,
            jwt_secret,
            auth_required,
            cors_origin,
            admin_user,
            admin_password,
            admin_role,
        }
    }
}
