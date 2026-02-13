use axum::http::{HeaderMap, Method, Request}; // Added Request and Method

pub fn extract_cookie_value(cookies: &str, name: &str) -> Option<String> {
    let needle = format!("{}=", name);
    cookies
        .split(';')
        .map(|cookie| cookie.trim())
        .find(|cookie| cookie.starts_with(&needle))
        .map(|cookie| cookie.trim_start_matches(&needle).to_string())
}

pub fn csrf_valid(headers: &HeaderMap) -> bool {
    let header_token = headers
        .get("x-csrf-token")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.trim().to_string());

    let cookie_token = headers
        .get(axum::http::header::COOKIE)
        .and_then(|value| value.to_str().ok())
        .and_then(|cookies| extract_cookie_value(cookies, "csrf_token"));
    
    match (header_token, cookie_token) {
        (Some(header_token), Some(cookie_token)) => header_token == cookie_token,
        _ => false,
    }
}

pub fn requires_csrf(req: &Request<axum::body::Body>) -> bool {
    let method = req.method();
    if method == Method::GET || method == Method::HEAD || method == Method::OPTIONS {
        return false;
    }
    let path = req.uri().path();
    // Only login is exempt because it establishes the session and generates the first CSRF token.
    // Refresh and Logout MUST be protected as they rely on existing session state.
    let is_login_path = path == "/api/auth/login" || path == "/api/v1/auth/login";
    !is_login_path
}
