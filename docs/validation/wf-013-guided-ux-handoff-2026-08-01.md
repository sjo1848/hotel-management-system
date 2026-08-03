# WF-013 — Handoff de UX guiada pendiente de validación

Fecha: 2026-08-01
Branch: `feature/gate-hardening-rbac-e2e`
Estado: implementación local sin validar y sin commit

## Contexto

Se implementó una mejora de UX para recepción y housekeeping. El objetivo es que
los modos guiados sean interactivos y lleven al usuario al contexto correcto, en
lugar de funcionar solamente como una lista informativa.

La implementación está aplicada en 10 archivos, pero deliberadamente no se
ejecutaron tests, Playwright, gates ni commit por indicación del usuario. Por lo
tanto, no se debe declarar la UX como garantizada hasta completar la validación.

## Cambios implementados

### Recepción

- El board funciona como cockpit de turno.
- Se eliminaron tarjetas operativas duplicadas antes del board.
- La cola dejó de limitarse a cuatro casos destacados.
- Se agregó búsqueda por huésped, habitación o reserva.
- Se agregaron filtros `Todos`, `Urgentes`, `Llegadas`, `Salidas` y `En casa`.
- Cada caso muestra una acción primaria y contexto de estadía.
- Los bloqueos explican qué puede hacer recepción y cuándo debe intervenir
  Operaciones.
- Cancelación y no-show requieren confirmación explícita con resumen de impacto.
- La navegación de casos muestra `Caso X de Y` y permite continuar con el
  siguiente.

### Guías y modos guiados

- Las tarjetas de cada guía son interactivas.
- Cada paso indica `Ahora`, `Pendiente` o `Completado`.
- La guía no marca un paso como hecho por abrirlo; el progreso continúa basado en
  eventos operativos reales.
- Recepción puede navegar desde la guía a la cola, al caso y al checklist de
  check-in, cuenta o checkout.
- Housekeeping puede navegar desde la guía a las columnas `Dirty`, `Cleaning` y
  bloqueos.
- Las guías enfocan visualmente la sección destino.
- La ayuda contextual ya no dispara directamente check-in o checkout: primero
  lleva al checklist para que el usuario revise y confirme.
- Se agregó anuncio accesible de cambios en la ayuda contextual.

## Archivos modificados

- [BookingsPage.tsx](../../frontend/src/features/bookings/BookingsPage.tsx)
- [BookingArrivalExceptionActions.tsx](../../frontend/src/features/bookings/components/BookingArrivalExceptionActions.tsx)
- [BookingDetailsSheet.tsx](../../frontend/src/features/bookings/components/BookingDetailsSheet.tsx)
- [FrontDeskBoardPanel.tsx](../../frontend/src/features/bookings/components/FrontDeskBoardPanel.tsx)
- [GuideHint.tsx](../../frontend/src/features/guided/components/GuideHint.tsx)
- [GuideRail.tsx](../../frontend/src/features/guided/components/GuideRail.tsx)
- [housekeepingGuide.ts](../../frontend/src/features/guided/housekeepingGuide.ts)
- [receptionGuide.ts](../../frontend/src/features/guided/receptionGuide.ts)
- [types.ts](../../frontend/src/features/guided/types.ts)
- [HousekeepingPage.tsx](../../frontend/src/features/housekeeping/HousekeepingPage.tsx)

Estado actual del árbol al crear este handoff: 10 archivos modificados, sin
archivos staged y sin commit nuevo.

## Decisiones y límites

- No se agregó handoff persistente de turno: no existe todavía un recurso de
  dominio/API para guardar notas de siguiente turno. Simularlo solo en frontend
  perdería información.
- No se modificó OpenAPI ni backend.
- No se debe ejecutar `git reset`, `git checkout` ni descartar estos cambios.
- El documento de handoff también queda sin commit para que el siguiente agente
  pueda revisar y decidir el cierre junto con el código.

## Validación pendiente para el siguiente agente

Ejecutar en este orden y registrar PASS/FAIL:

1. Tests focalizados de componentes guiados y recepción.
2. `docker compose exec -T frontend npm run lint`.
3. `docker compose exec -T frontend npm run test -- --run`.
4. `docker compose exec -T frontend npm run build`.
5. `./scripts/qa-core-journeys.sh`.
6. `./scripts/check-openapi-alignment.sh`.
7. Playwright manual/CLI en recepción y housekeeping con `375`, `390`, `430`,
   `768`, `1024` y `1440`.
8. `./scripts/gate.sh` y review estricto Critical/High/Medium/Low.
9. Actualizar [manual-qa-execution-runbook.md](manual-qa-execution-runbook.md)
   con evidencia real.
10. Solo después, crear un commit intencional de WF-013.

## Validación ejecutada el 2026-08-01

Los 10 pasos de validación se ejecutaron en orden y quedaron en `PASS` (detalle
y comandos en [manual-qa-execution-runbook.md](manual-qa-execution-runbook.md),
sección 9 — Ejecuciones registradas):

1. Tests focalizados: `PASS` (16/16).
2. Lint/typecheck: `PASS`.
3. Suite unit completa: `PASS` (21 archivos, 81 tests).
4. Build: `PASS`.
5. `qa-core-journeys.sh`: `PASS` (HMS-QA-010).
6. `check-openapi-alignment.sh`: `PASS` (contrato v1 intacto).
7. Playwright recepción `6/6` y housekeeping `4/4`, incluyendo sweep de anchos
   `375`-`1440` sin overflow horizontal y foco del rail a la columna de destino.
8. `LC_ALL=C HMS_KPI_RUNNER=docker ./scripts/gate.sh`: `PASS` (coverage
   frontend >= 80% incluido).
9. Runbook actualizado con evidencia real.
10. Commit intencional: **pendiente por decisión del usuario** (worktree local,
    sin commit).

Defectos encontrados y resueltos durante la corrida:

- `QA-20260801-001` (Low, preexistente): flake de carga en
  `DashboardHome.test.tsx` — timeouts de cierre de caja ajustados de 10s/5s a
  20s (robustez, sin cambio de comportamiento).
- `QA-20260801-002` (Medium, diferido como decisión de diseño): doble toggle del
  modo guiado (header + rail), ambos apagan el modo correctamente.

Riesgos de la lista anterior cubiertos por tests/E2E:

- Clic en tarjeta guiada no marca progreso: cubierto en `GuideRail.test.tsx` y
  smoke E2E (progreso `0/5` estable tras el clic).
- Foco de guía durante el montaje del sheet: cubierto en
  `BookingDetailsSheet.test.tsx` con `requestAnimationFrame` simulado y en E2E
  con `toBeFocused`.
- Guía sin caso compatible: `openReceptionGuideStep` muestra toast y hace scroll
  al board (revisado en código, sin reserva errónea).
- Filtro `En casa` sin duplicados: cubierto en `FrontDeskBoardPanel.test.tsx`
  (deduplicación de casos).
- Confirmación terminal conserva motivo y evita doble envío: cubierto en
  `BookingArrivalExceptionActions.test.tsx` (5 casos).
- Responsive y accesibilidad: sweep de anchos en ambos smokes y aserciones de
  `aria-current`/`aria-live` en tests unitarios.

## Tests heredados que siguen siendo necesarios

Estos tests no deben eliminarse por el rediseño de UX:

| Test existente | Estado frente a WF-013 | Acción necesaria |
| --- | --- | --- |
| `frontend/src/features/bookings/components/BookingArrivalExceptionActions.test.tsx` | Sigue siendo necesario | Ajustar el caso de cancelación/no-show: ahora el primer clic abre confirmación y el segundo clic ejecuta `onAction`. Mantener las aserciones de motivo obligatorio y no-show bloqueado antes de la llegada. |
| `frontend/src/features/guided/housekeepingGuide.test.ts` | Sigue siendo válido | Conservar la cobertura de progresión, estados activos y resumen. Agregar aserción de `actionLabel` si se considera parte del contrato visual. |
| `frontend/e2e/reception-role-smoke.spec.ts` | Sigue siendo necesario | Actualizar el texto del centro operativo porque ahora el encabezado prioriza huésped/habitación. Agregar smoke de búsqueda/filtro y de interacción del rail guiado. |
| `frontend/e2e/housekeeping-role-smoke.spec.ts` | Sigue siendo necesario | Actualizar el locator de `Ocultar guía` a `Salir del modo guiado` y verificar que una tarjeta del rail desplaza al carril correspondiente. |
| `frontend/src/features/housekeeping/components/MaintenanceCaseActions.test.tsx` | Sigue siendo necesario | Mantenerlo sin cambios salvo que el render del carril revele una regresión. |

## Tests nuevos requeridos por la mejora de UX

No estaban cubiertos antes y son necesarios para poder afirmar que la UX guiada
funciona:

- `GuideRail`: una tarjeta es navegable, expone `aria-current`, muestra estado
  correcto y llama `onStepSelect` sin marcar progreso.
- `GuideHint`: cambios de misión se anuncian con `aria-live` y el CTA navega al
  contexto, no ejecuta una transición crítica.
- `receptionGuide`: cada paso tiene acción contextual y la progresión solo cambia
  con eventos operativos.
- `FrontDeskBoardPanel`: búsqueda, filtros, cola completa sin límite de cuatro,
  deduplicación de `En casa` y acción primaria por caso.
- `BookingDetailsSheet`: al seleccionar check-in, cuenta o checkout, el foco
  llega a la sección correcta cuando el sheet terminó de montar.
- `BookingArrivalExceptionActions`: cancelación/no-show requieren confirmación,
  conservan el motivo y evitan doble envío.

## Conclusión sobre necesidad

Sí, los tests anteriores siguen siendo necesarios. La mejora no los reemplaza:
los tests heredados protegen reglas y recorridos ya cerrados; los tests nuevos
protegen la interacción añadida. La suite mínima de cierre es la combinación de
ambos grupos, con los dos smoke E2E actualizados a los textos y comportamientos
intencionales de WF-013.

## Riesgos a revisar

- Validar que el clic sobre una tarjeta guiada no marque progreso por sí solo.
- Confirmar que el foco de guía encuentra el elemento cuando el drawer/sheet aún
  está montándose.
- Confirmar que la guía no abre un caso equivocado cuando no existe una reserva
  compatible con el paso seleccionado.
- Confirmar que el filtro `En casa` no duplica reservas que ya están en la cola.
- Confirmar que la confirmación de cancelación/no-show conserva la razón y no
  permite doble envío.
- Revisar responsive del nuevo rail de guía y de los botones con textos largos.
- Revisar accesibilidad de botones, foco programático y `aria-current`.

## Declaración de cierre actual

`WF-013` queda **implementado y validado en local, pendiente de commit**.

Todos los gates y tests quedaron en `PASS` (ver sección "Validación ejecutada
el 2026-08-01" y el runbook). El único paso restante del plan de cierre es el
commit intencional, que el usuario pidió no crear todavía.

Hallazgos del review estricto:

- `Critical`: ninguno.
- `High`: ninguno.
- `Medium`: doble toggle del modo guiado (decisión de diseño aceptada,
  `QA-20260801-002`).
- `Low`: flake preexistente de `DashboardHome.test.tsx` corregido con timeouts
  (`QA-20260801-001`); textos del board sin acentos (estilo preexistente,
  no bloqueante).
