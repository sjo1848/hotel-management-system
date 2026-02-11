# HMS Elite - Pila Tecnológica

## Resumen

La pila tecnológica de HMS Elite está diseñada para ofrecer una alta performance, escalabilidad y mantenibilidad, siguiendo los principios de una arquitectura hexagonal y Domain-Driven Design.

## Componentes de la Pila

### Backend
*   **Lenguaje de Programación:** Rust
    *   **Ventajas:** Seguridad de memoria, rendimiento excepcional y concurrencia robusta.
*   **Framework Web:** Axum
    *   **Ventajas:** Un framework web de alto rendimiento y fácil de usar, construido sobre Tokio y Tower, ideal para APIs RESTful.
*   **ORM/Driver de Base de Datos:** SQLx
    *   **Ventajas:** Un ORM asíncrono y seguro en tiempo de compilación para Rust, que garantiza la corrección de las consultas SQL.
*   **Runtime Asíncrono:** Tokio
    *   **Ventajas:** Un potente runtime asíncrono para Rust, fundamental para aplicaciones de red de alta concurrencia.

### Frontend
*   **Framework:** React 19
    *   **Ventajas:** Biblioteca JavaScript popular para construir interfaces de usuario interactivas y eficientes.
*   **Lenguaje de Programación:** TypeScript
    *   **Ventajas:** Añade tipado estático a JavaScript, mejorando la robustez y mantenibilidad del código en proyectos grandes.
*   **Herramienta de Construcción:** Vite
    *   **Ventajas:** Servidor de desarrollo extremadamente rápido y herramienta de empaquetado optimizada para proyectos web modernos.

### Base de Datos
*   **Sistema de Gestión de Bases de Datos:** PostgreSQL 16
    *   **Ventajas:** Base de datos relacional de código abierto, robusta, extensible y conforme a estándares SQL.

### Contenerización y Orquestación
*   **Tecnologías:** Docker & Docker Compose
    *   **Ventajas:** Permite empaquetar la aplicación y sus dependencias en contenedores aislados, facilitando el despliegue y la consistencia entre entornos. Docker Compose simplifica la gestión de aplicaciones multi-contenedor en desarrollo.
