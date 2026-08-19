# HMS Mobile UX — Plan de continuación

Estado: revisión read-only completada
Fecha: 2026-08-18
Base: `b6b393f05bfc6429b3fec7b489d2e3c139264548`
Branch: `feature/mobile-ux-perf`
Viewport revisado: 390x844, con validación pendiente en 375/430 para cada slice

## Diagnóstico

La aplicación funciona, pero varias superficies todavía presentan una composición de desktop adaptada a mobile. El problema principal es densidad y jerarquía, no overflow básico:

- headers globales demasiado altos y descriptivos;
- acciones secundarias ocupando el mismo nivel que la acción principal;
- filtros y controles visibles simultáneamente;
- listas genéricas que muestran demasiados campos;
- workspaces con varias decisiones abiertas al mismo tiempo;
- detalles embebidos debajo de la lista en lugar de una tarea temporal;
- analytics y ayuda compitiendo con la operación inmediata.

La evidencia visual está en `.playwright-cli/` y la evidencia estática se referencia por archivo y línea debajo. No se modificó producto durante esta revisión.

## Hallazgos priorizados

| Prioridad | Superficie | Evidencia | Problema | Dirección |
|---|---|---|---|---|
| P1 | Shell / todos los módulos | `frontend/src/components/ui/page-header.tsx:21-47` | título, descripción, icono y acciones generan demasiado chrome vertical | variante compacta mobile; descripción y secundarias bajo demanda; preservar desktop |
| P1 | Rooms | `frontend/src/features/rooms/RoomsPage.tsx:235-263`; `RoomsInventoryPanel.tsx:293,414,490` | inventario, filtros, modos, selección y acciones se presentan juntos | lista operacional → detalle temporal → acciones secundarias |
| P1 | Calendar | `frontend/src/features/schedule/CalendarPage.tsx:100-115` | navegación, rango, modo, búsqueda, tres filtros y cinco indicadores simultáneos | agenda-first; fecha/rango principal; filtros en Sheet; ocultar Timeline muerto en mobile |
| P1 | Housekeeping | `frontend/src/features/housekeeping/HousekeepingPage.tsx:58-66` | guía, fecha, refresh, cinco estados, búsqueda y workspace compiten | próxima tarea primero; filtros compactos; room task surface dedicada |
| P1 | Reports | `frontend/src/features/reports/ReportsPage.tsx:179-274` | presets, recarga, exportación, fechas, cuatro KPIs y múltiples paneles | rango → indicador principal → drill-down; exportar/recargar secundarias |
| P1 | Guests / Users | `frontend/src/components/ui/data-table.tsx:163-235` | cada fila se convierte en card expandible con todas las columnas | lista específica por entidad; preview corto; detalle temporal |
| P2 | Dashboard | `frontend/src/features/dashboard/DashboardHome.tsx:291-346` | prioridades, KPIs, caja y rendimiento compiten | cola “qué hacer ahora”; analytics debajo |
| P2 | Users | `frontend/src/features/users/UsersPage.tsx:37` | `confirm()` nativo rompe coherencia y accesibilidad mobile | AlertDialog sólo dentro del slice Users |
| P2 | Tabs / Más | `frontend/src/components/ui/tab-strip.tsx:90-123` | roles de tab y menú mezclados | separar tablist de selector de sección; validar teclado/lector |
| P2 | Room cards | `frontend/src/features/rooms/components/RoomCard.tsx:25-72` | tarjeta alta y decorativa para una decisión operativa | resumen compacto; reservar card visual para selección deliberada |

## Lo que está bien y queda congelado

- selector mobile de huésped;
- picker de habitación de reserva;
- flujo mobile de recepción/reserva/check-in ya estabilizado;
- separación explícita desktop/mobile en bookings;
- API, dominio, persistencia y servicios backend;
- primitives Radix locales ya existentes;
- DataTable como fallback desktop;
- no introducir Drawer, `cmdk`, nueva UI framework ni dependencias pesadas sin evidencia.

## Orden de trabajo para mañana

### Slice 0 — cierre de base

- confirmar PR #29 y checks canónicos;
- preservar `b6b393f` como baseline;
- no mezclar este plan con reparaciones de negocio.

### Slice 1 — foundation mobile mínima

Diseñar y validar antes de reutilizar:

- header mobile compacto;
- variante mobile de `PageHeader`;
- selector de sección mobile;
- acciones secundarias compactas;
- lista de entidad mobile;
- superficie de detalle temporal.

Regla: una abstracción sólo se incorpora si resuelve al menos dos superficies reales.

### Slice 2 — Rooms + Calendar

Primer objetivo de implementación por impacto visual y frecuencia:

- Rooms: búsqueda + estado + lista operacional; detalle/acciones fuera de la lista principal;
- Calendar: agenda-first, selector de rango simple, filtros bajo demanda;
- corregir el control Timeline mobile si permanece expuesto;
- validar back, foco, 375/390/430 y desktop.

### Slice 3 — Housekeeping + Dashboard

- Housekeeping: cola y próxima habitación como centro;
- detalle de habitación como task surface;
- guía y filtros secundarios bajo demanda;
- Dashboard: prioridades operativas primero, rendimiento/analytics secundarios.

### Slice 4 — Guests + Users + Reports

- listas específicas, no expansión de todas las columnas;
- detalle de huésped/usuario temporal;
- confirmación accesible para eliminación;
- Reports reducido a una lectura principal y drill-down.

### Slice 5 — coherencia y aceptación

- focus return, Escape/back y pérdida de estado;
- loading/error/empty states compactos;
- targets táctiles;
- semántica tabs/menu;
- medición de scroll, pasos, backtracks y tiempo a la acción;
- regresión desktop y E2E mobile.

## Contrato de aceptación por slice

Un slice no se considera terminado sólo por no tener overflow. Debe demostrar:

1. una tarea mobile completa en 375/390/430;
2. una sola acción primaria claramente visible;
3. estado preservado al volver/cerrar;
4. secundarias fuera del camino crítico;
5. foco y semántica accesibles;
6. desktop sin regresión;
7. evidencia antes/después con el mismo protocolo;
8. sin requests o mounts innecesarios introducidos.

## Clasificación de mañana

- Rooms: `P1 / UX_RISK / PRODUCT_GAP` para operación mobile completa.
- Calendar: `P1 / UX_RISK / ACCESSIBILITY_RISK`.
- Housekeeping: `P1 / UX_RISK / UNKNOWN` hasta completar journey independiente.
- Reports: `P1 / UX_RISK`.
- Guests/Users: `P1 / UX_RISK / PERFORMANCE_RISK`.
- Dashboard: `P2 / UX_RISK`.
- Backend/API: preservar; no hay evidencia directa de que sea la causa de esta lentitud visual.

## Human Gate

Estado preparado: `READY_FOR_MOBILE_UX_IMPLEMENTATION_PLAN`.

La próxima decisión humana sólo debe validar el orden de slices y la prioridad de Rooms + Calendar. No hace falta una nueva auditoría general ni autorización para inspecciones técnicas normales.

## Runtime transfer @ 2026-08-18 (OpenCode)

- Transfer entry: `.orchestration/RUNTIME-TRANSFER-CODEX-OPENCODE.md`. HEAD == remote == PR #29 == `2a2a1a0`. Human Gate mobile architecture APPROVED.
- Working tree (uncommitted) ya contenía Slice 3 (Housekeeping+Dashboard) y Slice 4 (Guests/Users/Reports) + shared UI + e2e touch-ups, heredados del runtime anterior. No se descartó trabajo.
- REWORK cerrado por críticos (read-only) con causa `ENVIRONMENT_DEFECT` y repairs:
  - HousekeepingRoomWorkspace: breakpoint `xl:`→`md:` (alineado al gate 768), tab ya no se resetea con `item?.room_id` (dep `[initialTab]`), tabpanel maintenance sólo se renderiza si la tab existe (aria-labelledby sin colgar).
  - UsersPage: fila mobile abre surface de detalle NO destructiva (`pendingView`); eliminar queda como acción secundaria de confirmación en dos pasos. Sin `window.confirm`.
  - toast: `role="status" aria-live="polite"` en el contenedor (a11y anuncio). Se scoped `calendar-role-smoke` a `span[aria-live]` (el toast es `div`) para no romper strict locator.
  - `.gitignore`: excluye `opencode-hms-project-method.zip` y `opencode-hms-project-method/` (scaffolding del método, no producto).
  - `frontend-perf-budget.sh`: `export LC_ALL=C` corrige falso "Budget exceeded" por decimal con coma en `es_AR.UTF-8` (ENVIRONMENT_DEFECT; CI canónico con locale C ya pasaba).
- Evidence (post-rework): lint/tsc PASS; vitest 54 files / 342 tests PASS; build PASS; `./scripts/gate.sh` exit 0; `git diff --check` PASS. E2E local `ENVIRONMENT_BLOCKED` (backend rate-limit 429; Chromium del contenedor ausente) — gate canónico es CI.
- Pendiente: commit del working tree a `feature/mobile-ux-perf`, luego canonical CI para el nuevo HEAD; Slice 5 (coherencia/aceptación) y Human Mobile Acceptance.

## Slice Rooms + Calendar — resultado actual

Estado local: `READY_FOR_CRITIC_INTEGRATION`

Implementado en el workspace:

- Rooms mobile con lista operacional compacta, búsqueda, filtro de estado y acciones secundarias agrupadas.
- Detalle de habitación conservado como superficie temporal mobile.
- Media query resuelta en el primer render del navegador para evitar flash de DataTable desktop.
- Barra de selección múltiple compacta en mobile.
- Calendar mobile agenda-first con navegación compacta, rango reducido, resumen colapsable y filtros transaccionales en Sheet.
- Header compacto en Calendar mobile; PageHeader desktop/tablet preservado.

Evidence:

- Frontend lint/typecheck: PASS.
- Full frontend suite: 54 files / 338 tests PASS.
- Focused Rooms + Calendar suite: PASS.
- Production build en `--outDir /tmp/hms-mobile-build-final`: PASS.
- `git diff --check`: PASS.
- Independent critics: final PASS.
- Browser E2E local: `ENVIRONMENT_BLOCKED`; Chromium no está disponible en el cache esperado del contenedor y falla antes de abrir la página (`ENOENT`). Canonical CI queda como gate E2E.

No se modificaron backend, API, dominio ni desktop fuera de los breakpoints preservados.
