# Changelog HMS Elite

Este documento rastrea los cambios importantes realizados en el proyecto.

## [0.1.0] - 2026-08-03 (Primer release taggeado)

### ✨ Workspaces operativos
- **Reception (WF-014)**: workspace operativo de recepción con flujos de check-in/check-out y checkout guiado.
- **Dashboard (WF-015)**: control center con KPIs de ocupación, ingresos y métricas de red.
- **Rooms (WF-016)**: inventario de habitaciones con estados y transiciones en tiempo real.
- **Calendar (WF-017)**: planning board de reservas por habitación y fecha.
- **Housekeeping (WF-018)**: shift workspace con cola de limpieza, estados Por limpiar/En limpieza/Lista y detalle de habitación (resumen, acción, mantenimiento).

### 🛡️ Calidad, gates y CI
- **Gate hardening + RBAC/E2E**: coverage de pago y checkout en guest lifecycle, alineación de selectores E2E con la UI actual y password de login alineada con el bootstrap backend.
- **Fix clippy**: satisfacer el lint de sorting de Rust 1.97 y corregir drift de fmt + guard de configuración de clippy.
- **Consolidación del pipeline**: toda la cadena de workspaces integrada en `main` con `full-stack-ci` verde en cada merge.
- **Branch protection activa en `main`**: check `CI Stability Guard` obligatorio, history linear (solo rebase), enforcement admin y resolución de conversaciones.

### 📋 Proceso
- Método de integración: rebase de PRs sobre `main`, retrigger de checks con empty commit tras cambio de base.
- Handoff documentado en `docs/ops/HANDOFF-2026-08-03-CI-and-PR-consolidation.md`.

## [2.1.0] - 2026-02-11 (Refactor & Premium UI)

### 🚀 Mejoras Visuales (UX/UI)
- **Nuevo Sistema de Diseño**: Implementada una paleta de colores HSL "Elite" (Deep Midnight Blue & Gold) con soporte de glassmorphism.
- **Login Page Rediseñada**: Nueva experiencia de inicio de sesión con fondo dinámico, efectos de cristal y validación animada.
- **Dashboard Layout**: 
    - Sidebar oscura inmersiva con navegación interactiva.
    - Header flotante con búsqueda y notificaciones.
    - Transiciones de página suaves (`fade-in`, `slide-in`).
- **Nuevas Vistas de Gestión**:
    - **Reservas (`/bookings`)**: Tabla de datos avanzada con "badges" de estado coloreados, paginación y acciones rápidas.
    - **Habitaciones (`/rooms`)**: Vista híbrida que permite alternar entre **Listado** (Tabla) y **Grid** (Tarjetas visuales con estado).

### 🛠️ Backend & Infraestructura
- **Refactorización de `main.rs`**: Se dividió el archivo monolítico en módulos dedicados (`infrastructure/web/routes`, `middleware`, `seeder`).
- **Seguridad**:
    - Reemplazo de credenciales hardcodeadas en `docker-compose.yml` por variables de entorno.
    - Creación de `.env.example` para facilitar la configuración local segura.
- **Integración API**: 
    - Conexión completa del Frontend con los endpoints `/api/v1` de `bookings` y `rooms`.
    - Normalización de tipos (TypeScript) para coincidir con los modelos Rust (`snake_case`).

### 🐛 Correcciones
- Corrección de la versión de React en la documentación (de 19 a 18).
- Corrección de la inicialización del `AppState` en el Backend para coincidir con la definición de la estructura.

## [2.0.0] - 2025-01-XX (Arquitectura Hexagonal)
- Reescritura completa del backend a Rust (Axum) siguiendo DDD y Arquitectura Hexagonal.
- Migración a PostgreSQL con SQLx.
