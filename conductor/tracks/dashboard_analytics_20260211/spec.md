# Especificación Técnica: Dashboard de Informes y Análisis

## Track ID: dashboard_analytics_20260211
## Versión: 1.0

## 1. Definición de Funcionalidades (Requisitos)

### KPIs Principales
- **Ingresos (Mes)**: Suma de `total_price_cents` de todas las reservas cuyo `check_in` esté dentro del mes actual y su estado no sea `CANCELLED`.
- **Ocupación (%)**: 
    - `(Habitaciones Ocupadas Hoy / Total de Habitaciones) * 100`.
    - "Ocupada" se define como una reserva con estado `CHECKED_IN` o `CONFIRMED` cuya estancia incluya la fecha de hoy.
- **Check-ins Hoy**: Conteo de reservas con `check_in = CURRENT_DATE` y estado `CONFIRMED`.
- **Reservas Activas**: Conteo total de reservas con estado `CONFIRMED` o `CHECKED_IN` que aún no han hecho `CHECKED_OUT`.

### Listas de Acción (Alertas)
- **Llegadas de Hoy**: Lista de huéspedes, habitación y hora estimada (si aplica) para check-in hoy.
- **Salidas de Hoy**: Lista de huéspedes que deben liberar habitación hoy.

## 2. Diseño de Arquitectura

### Backend (Rust)
- **Endpoint**: `GET /api/v1/analytics/kpis`
- **Modelo de Respuesta**:
```json
{
  "revenue_month_cents": 1420000,
  "occupancy_rate": 82,
  "today_check_ins": 8,
  "active_bookings_count": 24,
  "arrivals_today": [...],
  "departures_today": [...]
}
```
- **Repositorio**: Nuevas consultas en `PostgresBookingRepository` usando `COUNT`, `SUM` y filtros de fecha de Postgres.

### Frontend (React)
- **Service**: `analyticsService.ts` para centralizar la llamada.
- **Store**: Estado local en `DashboardHome.tsx` con un `useEffect` que refresque los datos cada 5 minutos o al cargar.

## 3. Estrategia de Calidad (QA)
- **Test de Integración**: Crear un test en Rust que simule 10 habitaciones y 5 reservas, y valide que el `occupancy_rate` devuelto por el servicio sea exactamente `50`.
