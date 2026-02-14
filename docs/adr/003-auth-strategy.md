# ADR-003: Estrategia de Autenticación mediante Cookies HttpOnly y CSRF

## Estado
Aceptado

## Contexto
La persistencia del JWT en el frontend debe ser segura frente a ataques de robo de tokens (XSS).

## Decisión
Se ha optado por un sistema **Cookie-Only** con tokens divididos y protección CSRF.

### Medidas de Seguridad
1. **HttpOnly**: El token no es accesible mediante JavaScript, mitigando el robo vía ataques XSS.
2. **SameSite=Lax/Strict**: Restringe el envío de la cookie a contextos de primer nivel, mitigando ataques de Cross-Site Request Forgery (CSRF).
3. **Double-Submit Cookie (CSRF Header)**: Exigimos un header `x-csrf-token` que debe coincidir con una cookie de seguridad para todas las peticiones que mutan datos (POST, PATCH, DELETE).

## Consecuencias
- **Positivo**: Seguridad de grado bancario para la sesión del usuario.
- **Negativo**: Mayor complejidad en la configuración de CORS y en los interceptores de Axios del frontend.
