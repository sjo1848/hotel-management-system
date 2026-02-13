// backend/src/infrastructure/web/test_cookie_builders.rs

use super::handlers::{build_access_cookie, build_refresh_cookie};
use crate::config::AppConfig;

#[test]
fn build_refresh_cookie_httponly_in_dev_without_secure() {
    let config = AppConfig {
        cookie_secure: false, // Dev config
        // other fields don't matter for this test, fill with dummy values
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
        cookie_samesite: String::from("Lax"),
        db_max_connections: 0,
        port: 0,
        app_env: String::from("dev"),
        otel_enabled: false,
        otel_exporter_endpoint: String::new(),
        otel_service_name: String::new(),
    };
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
}

#[test]
fn build_access_cookie_httponly_in_dev_without_secure() {
    let config = AppConfig {
        cookie_secure: false, // Dev config
        // other fields don't matter for this test, fill with dummy values
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
        cookie_samesite: String::from("Lax"),
        db_max_connections: 0,
        port: 0,
        app_env: String::from("dev"),
        otel_enabled: false,
        otel_exporter_endpoint: String::new(),
        otel_service_name: String::new(),
    };
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
}

#[test]
fn build_refresh_cookie_with_httponly_in_prod() {
    let config = AppConfig {
        cookie_secure: true, // Prod config
        // other fields don't matter for this test, fill with dummy values
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
        cookie_samesite: String::from("Lax"),
        db_max_connections: 0,
        port: 0,
        app_env: String::from("prod"),
        otel_enabled: false,
        otel_exporter_endpoint: String::new(),
        otel_service_name: String::new(),
    };
    let token = "test_refresh_token";
    let cookie = build_refresh_cookie(token, &config);
    assert!(
        cookie.contains("HttpOnly"),
        "HttpOnly should be present in prod config"
    );
}

#[test]
fn build_access_cookie_with_httponly_in_prod() {
    let config = AppConfig {
        cookie_secure: true, // Prod config
        // other fields don't matter for this test, fill with dummy values
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
        cookie_samesite: String::from("Lax"),
        db_max_connections: 0,
        port: 0,
        app_env: String::from("prod"),
        otel_enabled: false,
        otel_exporter_endpoint: String::new(),
        otel_service_name: String::new(),
    };
    let token = "test_access_token";
    let cookie = build_access_cookie(token, &config);
    assert!(
        cookie.contains("HttpOnly"),
        "HttpOnly should be present in prod config"
    );
}
