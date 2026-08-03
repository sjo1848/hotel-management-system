# WF-014 — Cierre: Reception Operational Workspace

Fecha: 2026-08-02
Rama: `feature/wf-014-reception-workspace` (base `6247e63`)
Commits: `981db6e` (Gate 0) → `acb5090` (paso 1) → `73fd52d` (paso 2) → `89904ef` (paso 3) → `990ef73` (paso 4) → `11b6b45` (paso 5) → `7af7a6d` (paso 6) → `4cc9cd8` (paso 7) → `ac0a290` (paso 8). Sin push.

## Resumen de lo entregado

1. **Utils cola** (`cockpitQueue.ts`) con `buildCockpitQueue`, `buildLaneIdSets`, `filterCockpitQueue`, `normalizedSearch` + 13 tests.
2. **Workspace de recepción** con 5 vistas: Turno / Llegadas / En casa / Salidas / Reservas.
3. **Cola compacta** (`ReceptionQueueList`/`ReceptionQueueItem`) sin duplicados, con selección accesible.
4. **Split view desktop** (`useMediaQuery`, ≥1280px) y **sheet tablet/mobile**.
5. **Detalle compartido** (`BookingCaseWorkspace`) con 4 tabs (Resumen/Operación/Cuenta/Historial), badges, alerta de saldo en Cuenta y CTA sticky contextual único.
6. **Guía compacta** (`CompactGuideAssistant`) con un solo toggle en header (resuelve QA-20260801-002); nunca muta (AC-22).
7. **Paso 8**: búsqueda "Buscar en el turno" en Turno desktop (AC-05, reutiliza `filterCockpitQueue`), anchor `#front-desk-board`, fix de walk-in inline en desktop y specs E2E actualizados.

## Evidencia PASS/FAIL

### Gates de contrato y calidad
| Gate | Resultado |
|---|---|
| `LC_ALL=C HMS_KPI_RUNNER=docker ./scripts/gate.sh` | PASS (unit 138/138, 27 archivos; coverage ≥80%; build) |
| `./scripts/ci-backend.sh` | PASS (70 + 5 tests) |
| `./scripts/check-openapi-alignment.sh` | PASS |
| `./scripts/frontend-perf-budget.sh` | PASS (app_css 107.23 KB ≤ 115 KB) |
| `git diff --check` | CLEAN |

### E2E (backend con `RATE_LIMIT_PER_MINUTE=600` durante la corrida, restaurado a 60 después)
| Suite | Resultado |
|---|---|
| `./scripts/qa-core-journeys-e2e.sh` | 6/6 PASS (auth, bookings, billing, dashboard, rbac/admin, guest lifecycle completo walk-in→check-in→cargo→pago→checkout→limpieza→inventario) |
| `./scripts/playwright-reception-smoke.sh` | 6/6 PASS (incluye 6 anchos 375/390/430/768/1024/1440 sin overflow, guía compacta, no-match) |
| `./scripts/playwright-housekeeping-smoke.sh` | PASS |

### Hallazgos resueltos durante el cierre
- **FAIL → PASS** `guest-lifecycle`: la sección "Cobros y saldo" solo se renderiza con status CheckedIn/CheckedOut (por diseño); el spec esperaba "Cobrado $0" en una reserva recién creada (Confirmed). Se ajustó a los estados reales de la tab Cuenta.
- **FAIL → PASS** `guest-lifecycle`: el botón real de la tarjeta disponible es "Abrir incidencia" (MaintenanceCaseActions), no "Marcar incidencia".
- **FAIL → PASS** `reception-role-smoke`: el detalle ahora se abre desde la tab Reservas (default es Turno); el smoke creaba su caso desde la cola. Se fija el flujo real.
- **Falso negativo por rate limit**: 429 Too Many Requests al correr E2E contra backend con límite default (60/min). Los scripts oficiales elevan a 600/min; los ad-hoc no. Se usó el runner oficial.

## Review estricto (sección 25 del plan)

### Critical — sin hallazgos
- No hay mutación disparada por navegación/guía: la guía solo navega (AC-22); las mutaciones exigen el CTA o formularios explícitos.
- RBAC intacto (backend sin cambios; suite `ci-backend` PASS).
- La mutación opera sobre `bookingState.id` del caso abierto; sin selección derivada.

### High — sin hallazgos
- CTA sticky: confirmed→check-in / checkedin→cobro o checkout / checkedout→"Estadía cerrada" (deshabilitado). Coincide con `nextAction` del controlador.
- Saldo visible: la tab Cuenta muestra badge de saldo (AlertCircle) y "Cobros y saldo" al estar CheckedIn/CheckedOut; el CTA de cobro solo navega.
- Cola sin omisiones: `buildCockpitQueue` cubre arrivals/departures/in-house; probado en unit + E2E.
- Layout mobile: sheet con CTA sticky; walk-in mantiene "Crear y gestionar" visible (smoke PASS).
- Progreso guiado no marca tareas no ejecutadas (solo `checkin_complete`/`checkout_complete` tras la mutación real).

### Medium
- Foco del CTA sticky: `focusGuideTarget` pasó de `requestAnimationFrame` a `setTimeout(0)` porque el target vive en una tab oculta.
- Estados vacíos: la búsqueda distingue "sin casos para la fecha" de "sin coincidencias con la búsqueda".
- Doble toggle de guía eliminado: único control en header (CompactGuideAssistant); `GuideHint` del workspace queda solo como CTA de navegación a tab.

### Low
- Copy de cola alineado ("En casa", "Check-in listo", "Salida").
- Iconos con etiquetas accesibles (tabs con badge y espacios en accesible name).

## Qué rompería producción (sección 26) — mitigado
- Desmontar el panel pierde datos de formulario: el case permanece abierto al cambiar de tab; los formularios viven en el workspace persistente.
- Cambiar tab durante una mutación: los botones de mutación muestran spinner (`statusLoading`) y el estado persiste en el controlador compartido.
- Bloqueos financieros ocultos: indicador de saldo en la tab Cuenta.
- Dos implementaciones divergentes: un solo `BookingCaseWorkspace` compartido por sheet y panel desktop.
- Tests anteriores: suite completa conservada y ampliada (138 tests, 27 archivos).

## DoD (sección 28 del plan) — 24/24 completado
- [x] Gate 0 documentado antes de código (`wf-014-gate-0-2026-08-01.md`).
- [x] Workspace con cinco vistas.
- [x] Cola compacta sin duplicados.
- [x] Split view desktop.
- [x] Sheet tablet/mobile.
- [x] Detalle compartido en cuatro tabs.
- [x] Una acción principal contextual (CTA sticky).
- [x] Guía compacta con un solo toggle.
- [x] RBAC sin regresión.
- [x] API v1 intacta (sin cambios en OpenAPI/backend).
- [x] Tests heredados conservados.
- [x] Tests nuevos agregados (cockpitQueue 13, tabs 14, guide 7, shift view 8 + smokes).
- [x] Seis anchos validados (E2E overflow 6/6).
- [x] Lint PASS.
- [x] Suite frontend PASS (138/138).
- [x] Build PASS.
- [x] Journeys PASS (6/6).
- [x] Playwright recepción PASS (6/6).
- [x] Gate final PASS.
- [x] CSS dentro de presupuesto (107.23 KB / 115 KB).
- [x] Review Critical/High/Medium/Low documentado (arriba).
- [x] Evidencia PASS/FAIL registrada (este documento).
- [x] Sin cambios fuera de alcance (solo frontend de bookings; backend/OpenAPI/roles intactos).
- [x] Commits intencionales por paso (9 commits), DoD completa antes de cerrar.

## Riesgos residuales
- `test-results/` queda owned por root al correr Playwright vía `docker run`; los reruns host fallan con EACCES hasta borrarlo.
- El smoke de recepción requiere reservas visibles en la tab Reservas (usa datos existentes); quedó fijado a la tab correcta.
- Los smokes ad-hoc corren contra el límite de rate default del backend; usar los scripts oficiales (elevan a 600/min).

## Fuera de alcance (sección 27) — respetado
Sin backend nuevo, cambios OpenAPI, portal de huésped, roles nuevos, handoff persistente de turno, deep links, facturación avanzada ni rediseño general.
