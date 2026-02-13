use super::handlers::{
    build_access_cookie, build_refresh_cookie, clear_access_cookie, clear_refresh_cookie,
};
use crate::config::AppConfig;

fn test_config(
    cookie_secure: bool,
    samesite: &str,
    app_env: &str,
    cookie_domain: Option<&str>,
) -> AppConfig {
    AppConfig {
        database_url: String::new(),
        jwt_secret: String::new(),
        jwt_kid: String::from("test"),
        jwt_previous_secret: None,
        auth_required: false,
        cors_origin: String::new(),
        admin_user: String::new(),
        admin_password: String::new(),
        admin_role: String::new(),
        access_ttl_minutes: 0,
        refresh_ttl_days: 0,
        rate_limit_per_minute: 0,
        login_limit_per_minute: 0,
        cookie_secure,
        cookie_samesite: String::from(samesite),
        cookie_domain: cookie_domain.map(String::from),
        db_max_connections: 0,
        port: 0,
        app_env: String::from(app_env),
        otel_enabled: false,
        otel_exporter_endpoint: String::new(),
        otel_service_name: String::new(),
    }
}

#[test]
fn build_refresh_cookie_httponly_in_dev_without_secure() {
    let config = test_config(false, "Lax", "dev", None);
    let token = "test_refresh_token";
    let cookie = build_refresh_cookie(token, &config);
    assert!(
        cookie.contains("HttpOnly"),
        "HttpOnly should be present in dev config"
    );
    assert!(
        !cookie.contains("Secure"),
        "Secure should be absent in dev config"
    );
    assert!(cookie.contains("SameSite=Lax"));
    assert!(cookie.contains("Path=/"));
    assert!(cookie.contains("Max-Age="));
}

#[test]
fn build_access_cookie_httponly_in_dev_without_secure() {
    let config = test_config(false, "Lax", "dev", None);
    let token = "test_access_token";
    let cookie = build_access_cookie(token, &config);
    assert!(
        cookie.contains("HttpOnly"),
        "HttpOnly should be present in dev config"
    );
    assert!(
        !cookie.contains("Secure"),
        "Secure should be absent in dev config"
    );
    assert!(cookie.contains("SameSite=Lax"));
    assert!(cookie.contains("Path=/"));
    assert!(cookie.contains("Max-Age="));
}

#[test]
fn build_refresh_cookie_with_httponly_in_prod() {
    let config = test_config(true, "Lax", "prod", Some("hms.example.com"));
    let token = "test_refresh_token";
    let cookie = build_refresh_cookie(token, &config);
    assert!(
        cookie.contains("HttpOnly"),
        "HttpOnly should be present in prod config"
    );
    assert!(cookie.contains("Secure"));
    assert!(cookie.contains("SameSite=Lax"));
    assert!(cookie.contains("Domain=hms.example.com"));
}

#[test]
fn build_access_cookie_with_httponly_in_prod() {
    let config = test_config(true, "Lax", "prod", Some("hms.example.com"));
    let token = "test_access_token";
    let cookie = build_access_cookie(token, &config);
    assert!(
        cookie.contains("HttpOnly"),
        "HttpOnly should be present in prod config"
    );
    assert!(cookie.contains("Secure"));
    assert!(cookie.contains("SameSite=Lax"));
    assert!(cookie.contains("Domain=hms.example.com"));
}

#[test]
fn clear_refresh_cookie_sets_max_age_zero() {
    let config = test_config(true, "Strict", "prod", Some("hms.example.com"));
    let cookie = clear_refresh_cookie(&config);
    assert!(cookie.starts_with("refresh_token=;"));
    assert!(cookie.contains("Max-Age=0"));
    assert!(cookie.contains("HttpOnly"));
    assert!(cookie.contains("SameSite=Strict"));
    assert!(cookie.contains("Secure"));
    assert!(cookie.contains("Domain=hms.example.com"));
}

#[test]
fn clear_access_cookie_sets_max_age_zero() {
    let config = test_config(false, "Lax", "dev", None);
    let cookie = clear_access_cookie(&config);
    assert!(cookie.starts_with("access_token=;"));
    assert!(cookie.contains("Max-Age=0"));
    assert!(cookie.contains("HttpOnly"));
    assert!(cookie.contains("SameSite=Lax"));
    assert!(!cookie.contains("Secure"));
}
