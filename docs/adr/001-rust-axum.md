# ADR-001: Elección de Rust y Axum para el Backend

## Estado
Aceptado

## Contexto
El sistema HMS Elite requiere alta concurrencia (manejo de múltiples reservas y actualizaciones de estado en tiempo real) y una seguridad de memoria garantizada para evitar vulnerabilidades críticas en el manejo de datos de huéspedes.

## Decisión
Hemos elegido **Rust** como lenguaje principal y **Axum** como framework web.

### Razonamiento Técnico
1. **Seguridad de Memoria**: Rust elimina clases enteras de bugs (null pointers, buffer overflows) en tiempo de compilación, vital para un sistema que maneja PII (Personally Identifiable Information).
2. **Rendimiento Predictivo**: Sin recolector de basura (GC), Rust ofrece latencias consistentes, permitiendo que las métricas de respuesta (SLOs) sean estables bajo carga.
3. **Ecosistema Axum**: Basado en `tower`, permite una integración modular de middlewares (como el que implementamos para métricas y seguridad) de forma extremadamente eficiente.

## Consecuencias
- **Positivo**: Infraestructura altamente eficiente y segura.
- **Negativo**: Curva de aprendizaje más elevada para nuevos desarrolladores en comparación con Node.js o Python.
