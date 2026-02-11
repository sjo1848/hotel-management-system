# Changelog HMS Elite

Este documento rastrea los cambios importantes realizados en el proyecto.

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
