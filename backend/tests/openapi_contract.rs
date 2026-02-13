use serde_yaml::Value;

fn openapi_doc() -> Value {
    serde_yaml::from_str(include_str!("../openapi.yaml"))
        .expect("backend/openapi.yaml must be valid yaml")
}

fn get_mapping<'a>(value: &'a Value, key: &str) -> &'a serde_yaml::Mapping {
    value
        .get(key)
        .and_then(Value::as_mapping)
        .unwrap_or_else(|| panic!("missing mapping key: {key}"))
}

#[test]
fn openapi_server_matches_runtime() {
    let doc = openapi_doc();
    let servers = doc
        .get("servers")
        .and_then(Value::as_sequence)
        .expect("servers must be present");

    let has_local = servers.iter().any(|entry| {
        entry
            .get("url")
            .and_then(Value::as_str)
            .map(|url| url == "http://localhost:3001")
            .unwrap_or(false)
    });

    assert!(
        has_local,
        "OpenAPI servers must include http://localhost:3001"
    );
}

#[test]
fn openapi_error_response_includes_contract_headers() {
    let doc = openapi_doc();
    let components = get_mapping(&doc, "components");
    let responses = components
        .get("responses")
        .and_then(Value::as_mapping)
        .expect("components.responses must be present");
    let error_response = responses
        .get("ErrorResponse")
        .and_then(Value::as_mapping)
        .expect("components.responses.ErrorResponse must be present");
    let headers = error_response
        .get("headers")
        .and_then(Value::as_mapping)
        .expect("ErrorResponse.headers must be present");

    assert!(
        headers.contains_key(Value::from("x-api-version")),
        "ErrorResponse.headers must include x-api-version"
    );
    assert!(
        headers.contains_key(Value::from("x-api-deprecation-policy")),
        "ErrorResponse.headers must include x-api-deprecation-policy"
    );
}

#[test]
fn openapi_covers_runtime_routes_and_methods() {
    let expected: &[(&str, &str)] = &[
        ("/api/v1/auth/login", "post"),
        ("/api/v1/auth/refresh", "post"),
        ("/api/v1/auth/logout", "post"),
        ("/api/v1/auth/me", "get"),
        ("/api/v1/hotels", "get"),
        ("/api/v1/hotels", "post"),
        ("/api/v1/rooms", "get"),
        ("/api/v1/rooms", "post"),
        ("/api/v1/rooms/available", "get"),
        ("/api/v1/rooms/{id}/status", "patch"),
        ("/api/v1/bookings", "get"),
        ("/api/v1/bookings", "post"),
        ("/api/v1/bookings/{id}", "patch"),
        ("/api/v1/bookings/{id}/extra-charges", "get"),
        ("/api/v1/bookings/{id}/extra-charges", "post"),
        ("/api/v1/guests", "get"),
        ("/api/v1/guests", "post"),
        ("/api/v1/users", "get"),
        ("/api/v1/users", "post"),
        ("/api/v1/users/{id}", "delete"),
        ("/api/v1/analytics/kpis", "get"),
        ("/api/v1/billing/balance", "get"),
        ("/api/v1/billing/close-cash", "post"),
        ("/api/v1/invoices", "get"),
        ("/api/v1/bookings/{id}/invoice", "get"),
        ("/api/v1/housekeeping/dirty", "get"),
        ("/api/v1/housekeeping/{id}/start", "post"),
        ("/api/v1/housekeeping/{id}/finish", "post"),
        ("/api/v1/reports/revenue", "get"),
        ("/api/v1/reports/occupancy", "get"),
        ("/api/v1/telemetry/ui", "post"),
    ];

    let doc = openapi_doc();
    let paths = get_mapping(&doc, "paths");

    for (path, method) in expected {
        let path_node = paths
            .get(Value::from(*path))
            .and_then(Value::as_mapping)
            .unwrap_or_else(|| panic!("missing path in OpenAPI: {path}"));
        assert!(
            path_node.contains_key(Value::from(*method)),
            "missing method in OpenAPI: {} {}",
            method,
            path
        );
    }
}
