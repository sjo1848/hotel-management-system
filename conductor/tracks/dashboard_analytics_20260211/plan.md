# Plan de Implementación: Dashboard de Informes y Análisis

## Track ID: dashboard_analytics_20260211

### Fase 1: Infraestructura de Datos (Backend)
- [x] Task: Definir modelo `DashboardKpis` en el dominio.
- [x] Task: Implementar queries de agregación en `BookingRepository`.
- [x] Task: Crear `AnalyticsService` y endpoint `GET /api/v1/analytics/kpis`.
- [x] Task: **QA - Automatización**: Escribir test de integración para validación de cálculos.

### Fase 2: Integración de KPIs (Frontend)
- [x] Task: Crear `analyticsService.ts` en el frontend.
- [x] Task: Conectar `KPICard` con datos reales de la API.
- [x] Task: Implementar Skeleton Loaders para evitar saltos visuales durante la carga.

### Fase 3: Visualización y Alertas
- [x] Task: Añadir sección de "Llegadas y Salidas del Día" en el Dashboard.
- [x] Task: **Revisión y Mejora**: Refinar el diseño de los KPIs basándose en la legibilidad de la data real.
