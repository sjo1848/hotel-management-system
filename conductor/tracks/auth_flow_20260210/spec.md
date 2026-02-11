# Track: Estabilizar y Finalizar el Flujo de Autenticación

## Especificación Técnica

### Objetivo
Asegurar un flujo de autenticación robusto y confiable en el entorno de desarrollo local y pre-producción, resolviendo los problemas actuales de envío y recepción de cookies HttpOnly, así como la correcta gestión de tokens de acceso y refresco.

### Componentes Involucrados
*   **Backend (Rust/Axum):**
    *   Manejo de cookies en `backend/src/infrastructure/web/handlers.rs` (`build_access_cookie`, `build_refresh_cookie`).
    *   Middleware de autenticación en `backend/src/main.rs` (`auth_middleware`).
    *   Manejo de rutas de autenticación (`/login`, `/refresh`, `/me`, `/logout`).
    *   Lógica de `HttpOnly` condicional para cookies de `access_token` y `refresh_token` (desactivado en desarrollo, activado en producción).
*   **Frontend (React/TypeScript/Vite):**
    *   Configuración del proxy en `vite.config.js`.
    *   Cliente API en `frontend/src/api/client.ts` (`axios` interceptors).
    *   Manejo de la URL base del API.
*   **Navegador:** Políticas de cookies `SameSite`, `HttpOnly` y `Secure`.

### Comportamiento Esperado

1.  **Login Exitoso:**
    *   Al iniciar sesión, el backend responde con `200 OK` y establece las cookies `access_token`, `refresh_token` y `csrf_token`.
    *   En desarrollo (`http://localhost`), las cookies `access_token` y `refresh_token` NO deben tener la bandera `HttpOnly`.
    *   El frontend debe redirigir al usuario a la página principal o dashboard.
2.  **Acceso a Ruta Protegida:**
    *   Las solicitudes a rutas protegidas (ej., `/api/v1/auth/me`) deben incluir las cookies `access_token` y `csrf_token`.
    *   Si `access_token` es válido, la solicitud debe ser exitosa (`200 OK`).
3.  **Expiración de Access Token y Refresh Automático:**
    *   Si el `access_token` ha expirado o es inválido (y el frontend recibe un `401 Unauthorized` de una ruta protegida), el frontend debe intentar automáticamente usar el `refresh_token` para obtener un nuevo `access_token`.
    *   La solicitud a `/api/v1/auth/refresh` debe ser exitosa (`200 OK`) si la cookie `refresh_token` es válida.
    *   El backend debe enviar nuevas cookies `access_token` y `refresh_token` (rotadas).
    *   La solicitud original que falló con 401 debe reintentarse y ser exitosa.
4.  **Logout Exitoso:**
    *   Al cerrar sesión, el backend debe invalidar el `refresh_token` y el frontend debe limpiar todas las cookies de autenticación.
    *   El usuario debe ser redirigido a la página de login.
5.  **Robustez en Desarrollo Local:**
    *   El flujo completo debe funcionar sin problemas en `http://localhost` utilizando el proxy de Vite y la configuración de cookies ajustada.

### Pruebas de Aceptación (para verificación manual)
*   Verificar login exitoso y acceso al dashboard.
*   Borrar manualmente la cookie `access_token` y recargar; la sesión debe persistir y el refresh debe ocurrir de forma transparente.
*   Verificar que el logout funcione correctamente y limpie todas las cookies de autenticación.
