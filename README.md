                                  HMS Elite - Hotel Management System

Sistema de gestión hotelera de alta performance bajo estándares de **Arquitectura Hexagonal** y **Domain-Driven Design (DDD)**.

 Arquitectura del Sistema
El proyecto está estructurado siguiendo el patrón de **Puertos y Adaptadores** para garantizar el desacoplamiento total de la lógica de negocio frente a la infraestructura.

 Estructura de Capas (Backend)
- **Domain:** Contiene las entidades de negocio y las interfaces (Ports/Traits). No tiene dependencias externas.
- **Application:** Casos de uso que orquestan el flujo de datos entre el dominio y la infraestructura.
- **Infrastructure:** Implementaciones técnicas (Adapters). 
    - `repository/`: Persistencia en PostgreSQL mediante SQLx.
    - `web/`: Handlers de API Rest con Axum.

 Stack Tecnológico
- **Backend:** Rust (Axum, SQLx, Tokio).
- **Frontend:** React 19 (TypeScript, Vite).
- **Base de Datos:** PostgreSQL 16.
- **Contenerización:** Docker & Docker Compose.

    Instalación y Despliegue

  Requisitos
- Docker y Docker Desktop instalados.

  Pasos para iniciar
1. Clona el repositorio:
   ```bash
   git clone [https://github.com/sjo1848/hotel-management-system.git](https://github.com/sjo1848/hotel-management-system.git)
   cd hotel-management-system
Levanta el ecosistema completo:

Bash
docker compose up --build
El sistema estará disponible en:

Frontend: http://localhost:5173

API Backend: http://localhost:3000

Salud del Sistema: http://localhost:3000/health

  Mapa de API (v1.0)
GET /: Mensaje de bienvenida del sistema.

GET /health: Estado operativo del backend.

GET /api/rooms: Listado completo de habitaciones (Capa de Dominio -> SQLx).

                                HMS Elite - Ingeniería de Software de alta disponibilidad.
