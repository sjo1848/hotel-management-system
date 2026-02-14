use crate::domain::security::{AccessTokenClaims, TokenSigner as TokenSignerPort};
use async_trait::async_trait;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub hotel_id: String,
    pub role: String,
    pub exp: usize,
}

impl From<AccessTokenClaims> for Claims {
    fn from(value: AccessTokenClaims) -> Self {
        Self {
            sub: value.sub,
            hotel_id: value.hotel_id,
            role: value.role,
            exp: value.exp,
        }
    }
}

impl From<Claims> for AccessTokenClaims {
    fn from(value: Claims) -> Self {
        Self {
            sub: value.sub,
            hotel_id: value.hotel_id,
            role: value.role,
            exp: value.exp,
        }
    }
}

pub struct JwtTokenSigner {
    primary_secret: String,
    previous_secret: Option<String>,
    kid: String,
}

impl JwtTokenSigner {
    pub fn new(primary_secret: String, previous_secret: Option<String>, kid: String) -> Self {
        Self {
            primary_secret,
            previous_secret,
            kid,
        }
    }
}

#[async_trait]
impl TokenSignerPort for JwtTokenSigner {
    async fn sign_access_token(&self, claims: &AccessTokenClaims) -> Result<String, String> {
        let jwt_claims = Claims::from(claims.clone());
        encode_token(&jwt_claims, &self.primary_secret, &self.kid)
    }

    async fn verify_access_token(&self, token: &str) -> Result<AccessTokenClaims, String> {
        decode_token(token, &self.primary_secret, self.previous_secret.as_deref())
            .map(AccessTokenClaims::from)
    }
}

pub fn encode_token(claims: &Claims, secret: &str, kid: &str) -> Result<String, String> {
    let mut header = Header::default();
    if !kid.trim().is_empty() {
        header.kid = Some(kid.to_string());
    }

    encode(
        &header,
        claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| e.to_string())
}

pub fn decode_token(
    token: &str,
    primary_secret: &str,
    previous_secret: Option<&str>,
) -> Result<Claims, String> {
    match decode::<Claims>(
        token,
        &DecodingKey::from_secret(primary_secret.as_bytes()),
        &Validation::default(),
    ) {
        Ok(data) => Ok(data.claims),
        Err(primary_error) => {
            if let Some(secondary) = previous_secret {
                return decode::<Claims>(
                    token,
                    &DecodingKey::from_secret(secondary.as_bytes()),
                    &Validation::default(),
                )
                .map(|data| data.claims)
                .map_err(|secondary_error| {
                    format!(
                        "token decode failed with primary and previous secret: primary={}, previous={}",
                        primary_error, secondary_error
                    )
                });
            }

            Err(primary_error.to_string())
        }
    }
}
