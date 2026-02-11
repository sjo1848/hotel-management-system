# Plan de Implementación: Estabilizar y Finalizar el Flujo de Autenticación

## Track ID: auth_flow_20260210

Este plan detalla las fases y tareas necesarias para estabilizar y finalizar el flujo de autenticación, asegurando un funcionamiento correcto en desarrollo local y su robustez para producción.

---

### Fase 1: Corrección y Verificación de Cookies en Backend (Rust)

- [ ] Task: Implementar `HttpOnly` condicional en `build_access_cookie` y `build_refresh_cookie`.
    - [ ] Write Failing Tests: Asegurar que los tests existentes para cookies consideren el comportamiento condicional de HttpOnly.
    - [ ] Implement to Pass Tests: Modificar las funciones en `backend/src/infrastructure/web/handlers.rs` para que `HttpOnly` se añada solo si `config.cookie_secure` es verdadero.
- [ ] Task: Limpiar `tracing::debug!` de `backend/src/main.rs` y `backend/src/infrastructure/web/handlers.rs`.
    - [ ] Write Failing Tests: (No aplica directamente, es limpieza de logs).
    - [ ] Implement to Pass Tests: Eliminar todas las sentencias `tracing::debug!` temporales.
- [ ] Task: Conductor - User Manual Verification 'Fase 1: Corrección y Verificación de Cookies en Backend (Rust)' (Protocol in workflow.md)

### Fase 2: Configuración del Proxy en Frontend (React/Vite)

- [ ] Task: Configurar proxy de Vite para rutas `/api` a `http://localhost:3000`.
    - [ ] Write Failing Tests: (No aplica directamente, es configuración de desarrollo).
    - [ ] Implement to Pass Tests: Modificar `frontend/vite.config.js`.
- [ ] Task: Ajustar `baseURL` del cliente Axios a una ruta relativa `/api/v1`.
    - [ ] Write Failing Tests: (No aplica directamente, es configuración).
    - [ ] Implement to Pass Tests: Modificar `frontend/src/api/client.ts`.
- [ ] Task: Conductor - User Manual Verification 'Fase 2: Configuración del Proxy en Frontend (React/Vite)' (Protocol in workflow.md)

### Fase 3: Pruebas Exhaustivas y Confirmación del Flujo

- [ ] Task: Realizar pruebas de login exitoso.
    - [ ] Write Failing Tests: (Verificación manual).
    - [ ] Implement to Pass Tests: Confirmar que `admin`/`admin123` loguea y redirige al dashboard.
- [ ] Task: Probar persistencia de sesión tras expiración de `access_token`.
    - [ ] Write Failing Tests: (Verificación manual).
    - [ ] Implement to Pass Tests: Borrar `access_token` en DevTools, recargar, verificar persistencia de sesión.
- [ ] Task: Verificar funcionalidad de logout.
    - [ ] Write Failing Tests: (Verificación manual).
    - [ ] Implement to Pass Tests: Ejecutar logout y confirmar redirección y limpieza de cookies.
- [ ] Task: Conductor - User Manual Verification 'Fase 3: Pruebas Exhaustivas y Confirmación del Flujo' (Protocol in workflow.md)
