# 🏨 HMS Elite - Hotel Management System

Sistema de gestión hotelera de alta performance desarrollado con una arquitectura **On-Premise Local-First**.

## 🚀 Stack Tecnológico
- **Backend:** Rust (Axum + SQLx) - Seguridad de memoria y velocidad extrema.
- **Frontend:** React 19 + Vite + TypeScript.
- **Base de Datos:** PostgreSQL 16.
- **Infraestructura:** Docker & Docker Compose.

## 🛠️ Instalación y Despliegue (Modo Desarrollo)

Asegúrate de tener instalado **Docker** y **Docker Desktop**.

1. Clona el repositorio:
   ```bash
   git clone [https://github.com/sjo1848/hotel-management-system.git](https://github.com/sjo1848/hotel-management-system.git)
   cd hotel-management-system

2. Levanta la infraestructura completa:

Bash
  docker compose up --build
  
  Acceso:

    Frontend: http://localhost:5173

    Backend API: http://localhost:3000/health

    Database: localhost:5432
