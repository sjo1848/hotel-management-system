# ADR-003: Browser Authentication and CSRF Strategy

## Status

Accepted.

## Context

HMS Elite is a browser-based operational application. Authentication must avoid exposing session credentials to application JavaScript while protecting state-changing requests against cross-site request forgery.

## Decision

Browser sessions use HttpOnly cookies together with explicit CSRF validation.

### Controls

1. **HttpOnly session cookies** keep authentication tokens out of normal JavaScript access.
2. **Secure/SameSite cookie configuration** is environment validated and tightened for production profiles.
3. **CSRF token validation** requires the client-provided `x-csrf-token` to match the expected CSRF cookie/token for protected mutations.
4. **Refresh-token handling** includes rotation/reuse protections exercised by backend security tests.
5. **Explicit CORS configuration** limits accepted browser origins rather than relying on permissive defaults.

## Consequences

### Benefits

- Reduces direct token exposure to browser JavaScript.
- Adds an explicit anti-CSRF control for authenticated mutations.
- Keeps authentication behavior testable at HTTP and browser boundaries.

### Costs

- Requires coordinated cookie, CORS and CSRF configuration across frontend and backend.
- Local, staging and production profiles need different secure-cookie settings.
- Authentication tests must exercise cookies and CSRF behavior rather than only bearer-token parsing.

## Evidence

- Auth/session configuration: `backend/src/config.rs`
- Auth middleware/handlers: `backend/src/infrastructure/web`
- Security regression tests: `backend/tests/csrf_authn_security.rs`
- Environment validation: `scripts/validate-env-profile.sh`
