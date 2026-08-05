# Threat Model — HMS Elite

Síntesis consolidada y accionable del modelo de amenazas del sistema. Refleja los
controles implementados en el código actual de `main`, los gaps y las acciones
recomendadas. No sustituye un pen-test independiente ni una certificación formal.

## Alcance

Contexto: HMS Elite (PMS SaaS multi-hotel), arquitectura hexagonal (Rust + Axum
backend, React + TypeScript frontend, PostgreSQL). API v1, multi-tenant por
`hotel_id`.

El modelo cubre las superficies propias del backend y su frontend. Quedan fuera de
este documento: hardening de infraestructura específica del host, pen-test
externo, revisión legal/privacy y certificaciones (marcados como Pending en
`PROJECT_STATUS.md`).

## Activos

| Activo | Tipo | Sensibilidad |
|---|---|---|
| PII de huéspedes (nombre, email, teléfono, documento) | Datos | Alta |
| Reservas y movimientos de caja | Datos transaccionales | Alta |
| Facturación y pagos | Datos financieros | Alta |
| Sesiones y refresh tokens | Credenciales | Critica |
| Habitaciones e inventario | Datos operativos | Media |
| Usuarios operadores y roles | Credenciales/privilegios | Alta |

## Superficie de ataque (entry points)

- `/api/v1/auth/*` — login, refresh, logout.
- `/api/v1/bookings/*`, `billing/*`, `rooms/*`, `guests/*`, `housekeeping/*`,
  `cash-closure/*`, `reports/*`, `/admin`.
- Panel frontend (SPA) y API pública.

## Controles existentes (en código)

| Control | Implementación |
|---|---|
| Autenticación | Token + refresh con detección de reuso de refresh token (ADR-003) |
| Autorización por capacidades | Desnormalización de roles por capability; deny-by-default en rutas no permitidas |
| Aislamiento tenant | `begin_tenant_tx(...)` en repositorios tenant-scoped + RLS Fase 1 (ADR-0001) |
| Rate limiting | `RATE_LIMIT_PER_MINUTE` (config.rs) en endpoints sensibles |
| CORS/headers | Validación de origen + hardening de headers en respuestas |
| Validación de input | Policy de validación y anti-escape (deploy kpi contract) |
| Rotación de secretos | `validate-env-profile.sh` bloquea `admin123`/dev-secrets fuera de local (guard `backend-security-regression.sh`) |

## Análisis STRIDE

| Categoría | Amenaza | Assets | Control actual | Gap | Acción |
|---|---|---|---|---|---|
| **Spoofing** | Login con credenciales débiles o default | Sesiones | Rate limit + bloqueo de `admin123` en prod | — | Monitorear login rate (alerta `HMSAuthLoginFailureRateHigh` ya existe) |
| **Spoofing** | Reuso de refresh token robado | Usuarios | Detección de reuso de refresh token | — | Confirmar invalidación del par al detectar reuso (tests anti-escape) |
| **Tampering** | Modificar reserva/factura ajena | Facturación | `begin_tenant_tx` por request | RLS aún Fase 1, no todas las tablas | Completar RLS a tablas restantes; anti-escape tests en CI |
| **Repudiation** | Negar operaciones contables | Facturación, movimientos | `audit_events` log | — | Verificar inmutabilidad/append-only de audit log |
| **Information disclosure** | Fuga cross-tenant | PII, reservas | RLS + tenant context fail-closed | — | Test anti-escape read/write en CI (obligatorio) |
| **Information disclosure** | IDs/emails en logs | PII | — | Logs podrían no redactar PII | Revisar formato de logs; no loguear bodies con PII |
| **Denial of service** | Exceso de requests a auth/endpoints | Disponibilidad | Rate limiting por minuto | Reseteo/límites por usuario vs IP | Refinar rate limit por identidad + IP |
| **Privilege escalation** | Ejecutar acción con rol distinto al autorizado | Operadores, roles | Capability-based authorization | — | Cubrir con tests RBAC canon + smoke por rol (ya en repo) |

## OWASP Top 10 — mapeo resumido

- A01 Broken Access Control → RBAC por capability + RLS (parcial).
- A02 Cryptographic Failures → secretos rotados/validados; TLS a cargo del front del host.
- A07 XSS → frameworks + no-render-HTML en React.
- A09 Security Logging → `audit_events` para operaciones financieras.
- A05 Misconfiguration → `validate-env-profile.sh` + guards de secretos en CI.

## Gaps más relevantes

1. **RLS Fase 1** (ADR-0001) pendiente de extensión a todas las tablas
   financieras; hoy se apoya en `begin_tenant_tx` (disciplina de capa) + policies
   parciales.
2. **Pen-test independiente** — fuera de alcance del repo.
3. **Hardening de infraestructura** (pod security, secretos en el host del
   despliegue, TLS con configuración del operador).
4. **Cobertura de anti-escape tenant** — asegurar que los tests estén en CI y
   cubran read/write cruzados (drift=0 en `execution-backlog-strict.md`).

## Decisiones asumidas / tradeoffs

- Se prioriza fail-closed (denegar por defecto) antes que flexibilidad de
  permisos: reduce superficie de filtración cross-tenant.
- RLS fase 1 es el approach aconsejado en ADR-0001; el coste es complejidad de
  conexión/transacciones y posible tuning de índices (tradeoff documentado).
- Redis de refresh-rate agrega dependencia; mientras tanto el rate limit reside
  en el proceso (in-memory) — validar en escala.

## Referencias relacionadas

- ADR-0001 (tenant + RLS), ADR-003 (auth), `docs/adr/`.
- `backend-security-regression.sh`, `validate-env-profile.sh`.
- `execution-backlog-strict.md` (anti-escape, drift=0).