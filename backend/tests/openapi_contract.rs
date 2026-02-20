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

fn get_path_method<'a>(doc: &'a Value, path: &str, method: &str) -> &'a serde_yaml::Mapping {
    let paths = get_mapping(doc, "paths");
    paths
        .get(Value::from(path))
        .and_then(Value::as_mapping)
        .and_then(|path_node| {
            path_node
                .get(Value::from(method))
                .and_then(Value::as_mapping)
        })
        .unwrap_or_else(|| {
            panic!(
                "missing OpenAPI node for {} {}",
                method.to_uppercase(),
                path
            )
        })
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
        ("/api/v1/rooms/{id}", "get"),
        ("/api/v1/rooms/{id}/status", "patch"),
        ("/api/v1/bookings", "get"),
        ("/api/v1/bookings", "post"),
        ("/api/v1/bookings/page", "get"),
        ("/api/v1/bookings/{id}", "patch"),
        ("/api/v1/bookings/{id}/extra-charges", "get"),
        ("/api/v1/bookings/{id}/extra-charges", "post"),
        ("/api/v1/guests", "get"),
        ("/api/v1/guests", "post"),
        ("/api/v1/guests/page", "get"),
        ("/api/v1/users", "get"),
        ("/api/v1/users", "post"),
        ("/api/v1/users/{id}", "delete"),
        ("/api/v1/analytics/kpis", "get"),
        ("/api/v1/audit/events", "get"),
        ("/api/v1/audit/events/page", "get"),
        ("/api/v1/billing/balance", "get"),
        ("/api/v1/billing/close-cash", "post"),
        ("/api/v1/invoices", "get"),
        ("/api/v1/invoices/page", "get"),
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

#[test]
fn swagger_ui_uses_external_openapi_json_source() {
    let routes_src = include_str!("../src/infrastructure/web/routes/mod.rs");
    assert!(
        routes_src.contains("external_url_unchecked(\"/api-docs/openapi.json\", ApiDoc::openapi_json())"),
        "Swagger wiring must use external_url_unchecked + openapi_json to prevent contract serialization drift"
    );
}

#[test]
fn monetization_endpoints_use_explicit_response_schemas() {
    let doc = openapi_doc();

    let revenue_get = get_path_method(&doc, "/api/v1/reports/revenue", "get");
    let revenue_items_ref = revenue_get
        .get("responses")
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("200"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("content"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("application/json"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("schema"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("items"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("$ref"))
        .and_then(Value::as_str)
        .unwrap_or("");
    assert_eq!(
        revenue_items_ref, "#/components/schemas/RevenueReport",
        "Revenue report must use explicit typed schema"
    );

    let occupancy_get = get_path_method(&doc, "/api/v1/reports/occupancy", "get");
    let occupancy_items_ref = occupancy_get
        .get("responses")
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("200"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("content"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("application/json"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("schema"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("items"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("$ref"))
        .and_then(Value::as_str)
        .unwrap_or("");
    assert_eq!(
        occupancy_items_ref, "#/components/schemas/OccupancyReport",
        "Occupancy report must use explicit typed schema"
    );

    let invoices_get = get_path_method(&doc, "/api/v1/invoices", "get");
    let invoices_items_ref = invoices_get
        .get("responses")
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("200"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("content"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("application/json"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("schema"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("items"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("$ref"))
        .and_then(Value::as_str)
        .unwrap_or("");
    assert_eq!(
        invoices_items_ref, "#/components/schemas/Invoice",
        "Invoices list must use explicit typed schema"
    );

    let invoice_by_booking_get = get_path_method(&doc, "/api/v1/bookings/{id}/invoice", "get");
    let invoice_ref = invoice_by_booking_get
        .get("responses")
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("200"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("content"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("application/json"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("schema"))
        .and_then(Value::as_mapping)
        .and_then(|v| v.get("$ref"))
        .and_then(Value::as_str)
        .unwrap_or("");
    assert_eq!(
        invoice_ref, "#/components/schemas/Invoice",
        "Invoice-by-booking must use explicit typed schema"
    );
}
