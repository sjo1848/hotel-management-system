use std::env;

#[derive(Clone)]
pub struct AppConfig {
    pub app_env: String,
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_kid: String,
    pub jwt_previous_secret: Option<String>,
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
    pub db_max_connections: u32,
    pub port: u16,
    pub otel_enabled: bool,
    pub otel_exporter_endpoint: String,
    pub otel_service_name: String,
}

impl AppConfig {
    pub fn from_env() -> Self {
        let app_env = env::var("APP_ENV").unwrap_or_else(|_| "dev".to_string());
        let is_prod = is_production_env(&app_env);
        let database_url = env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://admin:password123@db:5432/hms_core".to_string());
        let jwt_secret =
            env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".to_string());
        let jwt_kid = env::var("JWT_KID").unwrap_or_else(|_| "v1".to_string());
        let jwt_previous_secret = env::var("JWT_PREVIOUS_SECRET")
            .ok()
            .filter(|value| !value.trim().is_empty());
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
        let cookie_samesite = normalize_cookie_samesite(
            &env::var("COOKIE_SAMESITE").unwrap_or_else(|_| "Lax".to_string()),
        );
        let db_max_connections = env::var("DB_MAX_CONNECTIONS")
            .ok()
            .and_then(|value| value.parse::<u32>().ok())
            .unwrap_or(15);
        let port = env::var("PORT")
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(3001);
        let otel_enabled = env::var("OTEL_ENABLED")
            .unwrap_or_else(|_| "false".to_string())
            .to_lowercase()
            == "true";
        let otel_exporter_endpoint = env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
            .unwrap_or_else(|_| "http://otel-collector:4317".to_string());
        let otel_service_name =
            env::var("OTEL_SERVICE_NAME").unwrap_or_else(|_| "hms-backend".to_string());

        validate_security_guards(
            is_prod,
            &jwt_secret,
            &jwt_kid,
            &admin_password,
            cookie_secure,
            &cookie_samesite,
            &cors_origin,
            access_ttl_minutes,
            refresh_ttl_days,
        );

        Self {
            app_env,
            database_url,
            jwt_secret,
            jwt_kid,
            jwt_previous_secret,
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
            db_max_connections,
            port,
            otel_enabled,
            otel_exporter_endpoint,
            otel_service_name,
        }
    }
}

fn is_production_env(env_value: &str) -> bool {
    let normalized = env_value.trim().to_lowercase();
    normalized == "prod" || normalized == "production"
}

fn normalize_cookie_samesite(value: &str) -> String {
    match value.trim().to_lowercase().as_str() {
        "lax" => "Lax".to_string(),
        "strict" => "Strict".to_string(),
        "none" => "None".to_string(),
        _ => panic!("COOKIE_SAMESITE must be one of: Lax, Strict, None."),
    }
}

fn validate_security_guards(
    is_prod: bool,
    jwt_secret: &str,
    jwt_kid: &str,
    admin_password: &str,
    cookie_secure: bool,
    cookie_samesite: &str,
    cors_origin: &str,
    access_ttl_minutes: i64,
    refresh_ttl_days: i64,
) {
    if access_ttl_minutes <= 0 {
        panic!("ACCESS_TTL_MINUTES must be > 0.");
    }
    if refresh_ttl_days <= 0 {
        panic!("REFRESH_TTL_DAYS must be > 0.");
    }
    if !is_prod {
        return;
    }

    if jwt_secret == "dev-secret-change-me" {
        panic!("JWT_SECRET must be set to a strong value in production.");
    }
    if jwt_secret.len() < 32 {
        panic!("JWT_SECRET must be at least 32 characters long in production.");
    }
    if jwt_kid.trim().is_empty() {
        panic!("JWT_KID must be configured in production.");
    }
    if admin_password == "admin123" {
        panic!("ADMIN_PASSWORD must be set to a strong value in production.");
    }
    if !cookie_secure {
        panic!("COOKIE_SECURE must be true in production.");
    }
    if cookie_samesite == "None" && !cookie_secure {
        panic!("COOKIE_SAMESITE=None requires COOKIE_SECURE=true in production.");
    }
    if cors_origin == "*" {
        panic!("CORS_ORIGIN cannot be '*' in production.");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_production_env_accepts_prod_variants() {
        assert!(is_production_env("prod"));
        assert!(is_production_env("production"));
        assert!(is_production_env(" PRODUCTION "));
        assert!(!is_production_env("dev"));
        assert!(!is_production_env("staging"));
    }

    #[test]
    fn normalize_cookie_samesite_accepts_supported_variants() {
        assert_eq!(normalize_cookie_samesite("lax"), "Lax");
        assert_eq!(normalize_cookie_samesite(" STRICT "), "Strict");
        assert_eq!(normalize_cookie_samesite("None"), "None");
    }

    #[test]
    #[should_panic(expected = "COOKIE_SAMESITE must be one of")]
    fn normalize_cookie_samesite_rejects_invalid_value() {
        let _ = normalize_cookie_samesite("invalid");
    }

    #[test]
    fn validate_security_guards_accepts_non_prod_with_valid_ttls() {
        validate_security_guards(
            false,
            "dev-secret-change-me",
            "v1",
            "admin123",
            false,
            "Lax",
            "*",
            15,
            7,
        );
    }

    #[test]
    #[should_panic(expected = "ACCESS_TTL_MINUTES must be > 0.")]
    fn validate_security_guards_rejects_non_positive_access_ttl() {
        validate_security_guards(
            false,
            "dev-secret-change-me",
            "v1",
            "admin123",
            false,
            "Lax",
            "http://localhost:5173",
            0,
            7,
        );
    }

    #[test]
    #[should_panic(expected = "COOKIE_SECURE must be true in production.")]
    fn validate_security_guards_rejects_insecure_prod_cookie() {
        validate_security_guards(
            true,
            "12345678901234567890123456789012",
            "v1",
            "strong-admin-password",
            false,
            "Lax",
            "https://hms.example.com",
            15,
            7,
        );
    }
}
