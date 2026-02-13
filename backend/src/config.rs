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
    pub cookie_domain: Option<String>,
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
        let cookie_domain = normalize_cookie_domain(env::var("COOKIE_DOMAIN").ok());
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

        validate_security_guards(SecurityGuardInputs {
            is_prod,
            jwt_secret: &jwt_secret,
            jwt_kid: &jwt_kid,
            admin_password: &admin_password,
            cookie_secure,
            cookie_samesite: &cookie_samesite,
            cookie_domain: cookie_domain.as_deref(),
            cors_origin: &cors_origin,
            access_ttl_minutes,
            refresh_ttl_days,
        });

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
            cookie_domain,
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

fn normalize_cookie_domain(value: Option<String>) -> Option<String> {
    value.and_then(|raw| {
        let normalized = raw.trim().trim_start_matches('.').to_lowercase();
        if normalized.is_empty() {
            None
        } else {
            Some(normalized)
        }
    })
}

struct SecurityGuardInputs<'a> {
    is_prod: bool,
    jwt_secret: &'a str,
    jwt_kid: &'a str,
    admin_password: &'a str,
    cookie_secure: bool,
    cookie_samesite: &'a str,
    cookie_domain: Option<&'a str>,
    cors_origin: &'a str,
    access_ttl_minutes: i64,
    refresh_ttl_days: i64,
}

fn validate_security_guards(inputs: SecurityGuardInputs<'_>) {
    if inputs.access_ttl_minutes <= 0 {
        panic!("ACCESS_TTL_MINUTES must be > 0.");
    }
    if inputs.refresh_ttl_days <= 0 {
        panic!("REFRESH_TTL_DAYS must be > 0.");
    }
    if !inputs.is_prod {
        return;
    }

    if inputs.jwt_secret == "dev-secret-change-me" {
        panic!("JWT_SECRET must be set to a strong value in production.");
    }
    if inputs.jwt_secret.len() < 32 {
        panic!("JWT_SECRET must be at least 32 characters long in production.");
    }
    if inputs.jwt_kid.trim().is_empty() {
        panic!("JWT_KID must be configured in production.");
    }
    if inputs.admin_password == "admin123" {
        panic!("ADMIN_PASSWORD must be set to a strong value in production.");
    }
    if !inputs.cookie_secure {
        panic!("COOKIE_SECURE must be true in production.");
    }
    if inputs.cookie_samesite == "None" && !inputs.cookie_secure {
        panic!("COOKIE_SAMESITE=None requires COOKIE_SECURE=true in production.");
    }
    if inputs.cors_origin == "*" {
        panic!("CORS_ORIGIN cannot be '*' in production.");
    }
    let cookie_domain = inputs
        .cookie_domain
        .unwrap_or("")
        .trim()
        .to_lowercase();
    if cookie_domain.is_empty() {
        panic!("COOKIE_DOMAIN must be set in production.");
    }
    if cookie_domain == "localhost" {
        panic!("COOKIE_DOMAIN cannot be localhost in production.");
    }
    if !cookie_domain.contains('.') {
        panic!("COOKIE_DOMAIN must be a valid registrable domain in production.");
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
        validate_security_guards(SecurityGuardInputs {
            is_prod: false,
            jwt_secret: "dev-secret-change-me",
            jwt_kid: "v1",
            admin_password: "admin123",
            cookie_secure: false,
            cookie_samesite: "Lax",
            cookie_domain: None,
            cors_origin: "*",
            access_ttl_minutes: 15,
            refresh_ttl_days: 7,
        });
    }

    #[test]
    #[should_panic(expected = "ACCESS_TTL_MINUTES must be > 0.")]
    fn validate_security_guards_rejects_non_positive_access_ttl() {
        validate_security_guards(SecurityGuardInputs {
            is_prod: false,
            jwt_secret: "dev-secret-change-me",
            jwt_kid: "v1",
            admin_password: "admin123",
            cookie_secure: false,
            cookie_samesite: "Lax",
            cookie_domain: None,
            cors_origin: "http://localhost:5173",
            access_ttl_minutes: 0,
            refresh_ttl_days: 7,
        });
    }

    #[test]
    #[should_panic(expected = "COOKIE_SECURE must be true in production.")]
    fn validate_security_guards_rejects_insecure_prod_cookie() {
        validate_security_guards(SecurityGuardInputs {
            is_prod: true,
            jwt_secret: "12345678901234567890123456789012",
            jwt_kid: "v1",
            admin_password: "strong-admin-password",
            cookie_secure: false,
            cookie_samesite: "Lax",
            cookie_domain: Some("hms.example.com"),
            cors_origin: "https://hms.example.com",
            access_ttl_minutes: 15,
            refresh_ttl_days: 7,
        });
    }

    #[test]
    #[should_panic(expected = "COOKIE_DOMAIN must be set in production.")]
    fn validate_security_guards_rejects_missing_cookie_domain_in_prod() {
        validate_security_guards(SecurityGuardInputs {
            is_prod: true,
            jwt_secret: "12345678901234567890123456789012",
            jwt_kid: "v1",
            admin_password: "strong-admin-password",
            cookie_secure: true,
            cookie_samesite: "Lax",
            cookie_domain: None,
            cors_origin: "https://hms.example.com",
            access_ttl_minutes: 15,
            refresh_ttl_days: 7,
        });
    }
}
