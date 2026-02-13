# HMS Elite - Hotel Management System

Sistema de gestión hotelera de alta performance bajo estándares de **Arquitectura Hexagonal** y **Domain-Driven Design (DDD)**.

> 📘 **Documentación**: Consulta el [Historial de Cambios](docs/CHANGELOG.md) para ver las últimas mejoras y la [Política de Versionado API](docs/API_VERSIONING_POLICY.md).

## Arquitectura del Sistema
El proyecto está estructurado siguiendo el patrón de **Puertos y Adaptadores** para garantizar el desacoplamiento total de la lógica de negocio frente a la infraestructura.

### Estructura de Capas (Backend)
- **Domain:** Contiene las entidades de negocio y las interfaces (Ports/Traits). No tiene dependencias externas.
- **Application:** Casos de uso que orquestan el flujo de datos entre el dominio y la infraestructura.
- **Infrastructure:** Implementaciones técnicas (Adapters). 
    - `repository/`: Persistencia en PostgreSQL mediante SQLx.
    - `web/`: Handlers de API Rest con Axum.

## Stack Tecnológico
- **Backend:** Rust (Axum, SQLx, Tokio).
- **Frontend:** React 18 (TypeScript, Vite, Tailwind CSS).
- **Base de Datos:** PostgreSQL 16.
- **Contenerización:** Docker & Docker Compose.

## Instalación y Despliegue

### Requisitos
- Docker y Docker Desktop instalados.

### Pasos para iniciar
1. Clona el repositorio:
   ```bash
   git clone https://github.com/sjo1848/hotel-management-system.git
   cd hotel-management-system
   ```
2. Configura las variables de entorno:
   ```bash
   cp .env.example .env
   ```
3. Levanta el ecosistema completo:
   ```bash
   docker compose up --build
   ```

El sistema estará disponible en:
- **Frontend:** http://localhost:5173
- **API Backend:** http://localhost:3001
- **Salud del Sistema:** http://localhost:3001/health

### Mapa de API (v1)
- `GET /api/v1/rooms`: Gestión de habitaciones.
- `GET /api/v1/bookings`: Gestión de reservas con filtros.
- `GET /api/v1/auth`: Autenticación segura (JWT/Refresh Tokens).

---
HMS Elite - Ingeniería de Software de alta disponibilidad.
