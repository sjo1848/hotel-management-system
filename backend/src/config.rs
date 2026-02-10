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
    pub access_ttl_minutes: i64,
    pub refresh_ttl_days: i64,
    pub rate_limit_per_minute: u32,
    pub login_limit_per_minute: u32,
    pub cookie_secure: bool,
    pub cookie_samesite: String,
}

impl AppConfig {
    pub fn from_env() -> Self {
        let app_env = env::var("APP_ENV").unwrap_or_else(|_| "dev".to_string());
        let is_prod = app_env.to_lowercase() == "prod";
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
        let access_ttl_minutes = env::var("ACCESS_TTL_MINUTES")
            .ok()
            .and_then(|value| value.parse::<i64>().ok())
            .unwrap_or(15);
        let refresh_ttl_days = env::var("REFRESH_TTL_DAYS")
            .ok()
            .and_then(|value| value.parse::<i64>().ok())
            .unwrap_or(7);
        let rate_limit_per_minute = env::var("RATE_LIMIT_PER_MINUTE")
            .ok()
            .and_then(|value| value.parse::<u32>().ok())
            .unwrap_or(60);
        let login_limit_per_minute = env::var("LOGIN_LIMIT_PER_MINUTE")
            .ok()
            .and_then(|value| value.parse::<u32>().ok())
            .unwrap_or(10);
        let cookie_secure = env::var("COOKIE_SECURE")
            .unwrap_or_else(|_| "false".to_string())
            .to_lowercase()
            == "true";
        let cookie_samesite =
            env::var("COOKIE_SAMESITE").unwrap_or_else(|_| "Lax".to_string());

        if is_prod {
            if jwt_secret == "dev-secret-change-me" {
                panic!("JWT_SECRET must be set to a strong value in production.");
            }
            if admin_password == "admin123" {
                panic!("ADMIN_PASSWORD must be set to a strong value in production.");
            }
            if !cookie_secure {
                panic!("COOKIE_SECURE must be true in production.");
            }
        }

        Self {
            database_url,
            jwt_secret,
            auth_required,
            cors_origin,
            admin_user,
            admin_password,
            admin_role,
            access_ttl_minutes,
            refresh_ttl_days,
            rate_limit_per_minute,
            login_limit_per_minute,
            cookie_secure,
            cookie_samesite,
        }
    }
}
