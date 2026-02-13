use utoipa::openapi::OpenApi;

pub struct ApiDoc;

impl ApiDoc {
    pub fn openapi() -> OpenApi {
        serde_yaml::from_str(include_str!("../../../openapi.yaml"))
            .expect("backend/openapi.yaml must be a valid OpenAPI document")
    }
}
