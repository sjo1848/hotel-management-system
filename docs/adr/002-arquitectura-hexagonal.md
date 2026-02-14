# ADR-002: Implementación de Arquitectura Hexagonal (Puertos y Adaptadores)

## Estado
Aceptado

## Contexto
Los sistemas hoteleros suelen evolucionar en su infraestructura (cambio de bases de datos, integración con APIs externas de pagos o Channel Managers). Necesitamos que la lógica de negocio sea independiente de estos detalles.

## Decisión
Se ha estructurado el backend siguiendo los principios de **Arquitectura Hexagonal**.

### Estructura
1. **Domain**: Entidades puras y reglas de negocio. Define los "Ports" (Traits en Rust).
2. **Application**: Casos de uso que orquestan los puertos.
3. **Infrastructure**: Implementaciones concretas ("Adapters") como PostgreSQL, servicios de hashing, etc.

## Consecuencias
- **Positivo**: Desacoplamiento total. Podemos testear la lógica de negocio sin tocar la base de datos (mediante Mocks).
- **Negativo**: Requiere más código inicial ("Boilerplate") para definir las interfaces.
