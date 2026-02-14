# HMS Elite - Hotel Management System

Sistema PMS SaaS multi-hotel construido con **Arquitectura Hexagonal** y enfoque **DDD pragmático**.

## Estado actual
- Sprint 1 (arquitectura API + contrato): completado.
- Sprint 2 (seguridad frontend + hardening `/metrics`): completado.
- Sprint 3 (QA/performance): en ejecución con baseline de journeys y performance en verde.

## Arquitectura

### Backend
- **Domain**: entidades, reglas de negocio, errores de dominio, traits de repositorios.
- **Application**: servicios de caso de uso y orquestación.
- **Infrastructure**:
  - `repository/`: SQLx + PostgreSQL.
  - `web/`: Axum (routes, middlewares, handlers modulares por bounded context).

### Frontend
- React + TypeScript + Vite.
- Ruteo protegido por capacidad (`deny-by-default`) alineado con RBAC backend.

## Stack
- Backend: Rust, Axum, SQLx, Tokio.
- Frontend: React 18, TypeScript, Tailwind, Vite.
- DB: PostgreSQL 16.
- Observabilidad: Prometheus, Grafana, Alertmanager, Tempo, OTel Collector.
- Orquestación local: Docker Compose.

## Inicio rápido

### Requisitos
- Docker + Docker Compose.

### Levantar entorno
```bash
git clone https://github.com/sjo1848/hotel-management-system.git
cd hotel-management-system
cp .env.example .env
docker compose up --build
```

Servicios:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Health: `http://localhost:3001/health`
- Swagger UI: `http://localhost:3001/swagger-ui`

## Seguridad y operación
- `AUTH_REQUIRED=true` por defecto.
- `/metrics` endurecido (`HMS-SEC-011`):
  - en prod `METRICS_PUBLIC` debe ser `false`;
  - acceso permitido por red privada/loopback o `X-Metrics-Auth` (token de proxy).
- Validación de entorno productivo:
```bash
scripts/validate-prod-env.sh --env-file .env.prod.example
```

## Quality gates principales

Backend:
```bash
./scripts/ci-backend.sh
./scripts/check-openapi-alignment.sh
```

Frontend:
```bash
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm run test -- --run
docker compose exec -T frontend npm run build
```

Regresiones de seguridad backend:
```bash
./scripts/backend-security-regression.sh
```

Baseline de performance:
```bash
./scripts/perf-baseline.sh --report /tmp/perf_baseline.md
```

## API v1 (referencia rápida)
- Auth: `/api/v1/auth/*`
- Rooms: `/api/v1/rooms*`
- Bookings: `/api/v1/bookings*`
- Guests: `/api/v1/guests`
- Users: `/api/v1/users*`
- Billing/Invoices: `/api/v1/billing/*`, `/api/v1/invoices`
- Reports/Analytics: `/api/v1/reports/*`, `/api/v1/analytics/kpis`

Contrato OpenAPI:
- fuente canónica: `backend/openapi.yaml`
- espejo docs: `docs/openapi.yaml`
