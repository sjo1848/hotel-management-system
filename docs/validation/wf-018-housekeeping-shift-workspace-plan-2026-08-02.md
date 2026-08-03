# WF-018 — Workspace de Turno de Housekeeping

Fecha: 2026-08-02
Producto: HMS Elite
Área: Housekeeping (`/housekeeping`)
Estado: plan detallado; implementación no iniciada
Audiencia: siguiente agente implementador

## 1. Mandato inequívoco

Actuá como Principal Engineer, Product Designer, QA Lead y Security Engineer.
Implementá WF-018 respetando API v1, transiciones de dominio, RBAC, aislamiento
multi-tenant, modo guiado, accesibilidad, responsive y todos los gates.

Antes de editar:

1. Leer este documento completo.
2. Leer [WF-013](wf-013-guided-ux-handoff-2026-08-01.md) y conservar sus tests
   y principios de guía interactiva.
3. Leer [WF-014](wf-014-reception-workspace-plan-2026-08-01.md) para reutilizar
   el patrón lista/detalle y asistente compacto sin copiar dominio de Recepción.
4. Leer [WF-016](wf-016-rooms-inventory-workspace-plan-2026-08-02.md) para
   mantener Maintenance bajo workflow de Housekeeping.
5. Ejecutar `git status --short` y `git log -5 --oneline --decorate`.
6. Preservar trabajo activo de otros agentes.
7. Crear `feature/wf-018-housekeeping-shift-workspace` desde base limpia y
   registrar SHA en Gate 0.
8. Entregar Gate 0 antes de editar.

No usar comandos destructivos ni ampliar alcance sin autorización.

## 2. Decisión de producto

Housekeeping debe dejar de ser una landing page que apila guía, prioridades,
resúmenes, salidas y cuatro columnas extensas.

Debe convertirse en una cola de turno donde el operador pueda:

1. ver qué habitación necesita atención primero;
2. comenzar/finalizar limpieza con una acción inequívoca;
3. escalar una incidencia sin llenar formularios dentro de cada card;
4. resolver mantenimiento y devolver la habitación a Dirty;
5. confirmar qué inventario volvió a venta;
6. usar una guía compacta que lo lleve al trabajo correcto.

La pantalla tendrá una lista compacta y un detalle progresivo.

Filtros principales:

- `Turno`;
- `Por limpiar`;
- `En limpieza`;
- `Listas`;
- `Mantenimiento`.

Default: `Turno`.

## 3. Alcance exacto

Incluido:

- board del día;
- salidas del día;
- cola priorizada;
- filtros por estado;
- búsqueda;
- selección de habitación;
- iniciar limpieza;
- finalizar limpieza;
- abrir caso de mantenimiento;
- resolver caso y volver a Dirty;
- casos legacy;
- asistente guiado compacto;
- resumen compacto del turno;
- detalle inline desktop/sheet responsive;
- errores, loading y retry;
- RBAC;
- tests/Playwright.

No incluido:

- asignación formal de tareas a usuarios con nueva entidad;
- tiempos/SLA nuevos en backend;
- checklists de limpieza persistentes;
- fotos/evidencia;
- chat/notificaciones;
- acciones masivas;
- drag and drop;
- calendarizar turnos;
- cambiar checkout/reservas;
- editar inventario/tarifa;
- nuevas APIs;
- nuevos roles/capabilities;
- realtime/WebSocket.

## 4. Diagnóstico actual

La página apila:

1. header con search, refresh y toggle de guía;
2. `GuideRail` completo;
3. bloque grande de prioridades;
4. `GuideHint` adicional;
5. cards de salidas/inventario liberado;
6. cuatro cards de estados;
7. sección Salidas del día;
8. cuatro columnas Dirty/Cleaning/Available/Maintenance;
9. cards por habitación;
10. formularios de mantenimiento dentro de cada card.

Problemas:

- apariencia de landing y scroll largo;
- guía duplicada en header, rail y hint;
- mismos conteos repetidos;
- CTAs de prioridad sólo hacen scroll;
- status visibles en inglés;
- cards de columnas repiten contexto y formularios;
- una incidencia expandida aumenta toda la columna;
- `actionLoading` global deshabilita acciones de todas las habitaciones;
- no existe detalle persistente de la habitación seleccionada;
- Salidas y board repiten habitaciones/datos;
- `TODAY` se calcula al cargar el módulo y puede quedar obsoleto al cruzar
  medianoche sin recarga;
- search no normaliza tildes/status traducidos;
- error del board no incluye retry en la región principal;
- guía navega por IDs/scroll en vez de seleccionar contexto;
- Available puede dominar visualmente aunque no requiera acción;
- textos sin tildes y términos `Dirty/Cleaning/Maintenance` reducen claridad;
- MaintenanceCaseActions tiene formulario completo embebido en cards;
- no hay tests integrales de HousekeepingPage, sólo mantenimiento focalizado y
  smokes de guía/layout.

## 5. Usuarios y RBAC

Ruta protegida por `housekeeping.read`.

- `housekeeping`: read + write;
- `admin`: read + write;
- `ops`: read + write;
- `receptionist`: sin acceso;
- `saas_admin`: sin acceso.

Reglas:

- board y detalle read-only con `housekeeping.read`;
- mutaciones sólo con `housekeeping.write`;
- controlar por capability, no rol;
- no mostrar botones mutantes a read-only;
- backend autoridad final;
- no cambiar canon RBAC;
- no exponer datos de huésped fuera de roles autorizados por board.

## 6. Arquitectura de información

### 6.1 Header

Contenido:

1. título `Housekeeping`;
2. subtítulo `Limpieza, liberación de inventario y mantenimiento`;
3. fecha local visible;
4. `Actualizado HH:mm`;
5. `Actualizar`;
6. un único control de guía integrado al asistente compacto.

No mantener otro botón `Iniciar/Salir guía` si el asistente ya lo resuelve.

### 6.2 Asistente compacto

Usar/adaptar `CompactGuideAssistant` de WF-014.

Estado cerrado:

- próxima misión;
- progreso X/Y;
- CTA `Continuar guía`;
- toggle habilitar/deshabilitar accesible.

Estado abierto:

- pasos;
- completado/activo/pendiente;
- CTA del paso activo;
- reset;
- colapsar sin deshabilitar.

Acción de guía:

- cambia filtro apropiado;
- selecciona la primera habitación válida;
- enfoca el detalle/acción;
- nunca inicia/finaliza/resuelve automáticamente;
- progreso sólo avanza tras mutación exitosa;
- fallo no marca paso;
- si no hay candidato, explica estado estable y no enfoca un elemento inexistente.

Eliminar duplicación `GuideRail` + `GuideHint` dentro de Housekeeping. No romper
sus componentes si siguen usados en otro lugar; retirar sólo de composición.

### 6.3 Resumen compacto

Una fila de chips/filtros con conteo reemplaza priorities + stats:

- `Turno`;
- `Por limpiar`;
- `En limpieza`;
- `Listas`;
- `Mantenimiento`.

Indicador adicional:

- `Salidas de hoy: N`.

No repetir esos valores en cards grandes.

### 6.4 Contenido

- cola filtrada;
- detalle seleccionado;
- sin sección separada de Salidas: marcar turnover dentro de la cola;
- Available aparece en `Listas`; en `Turno` sólo las liberadas/relevantes del día
  según datos disponibles.

## 7. Definición exacta de filtros

### Turno

Incluye:

- Maintenance sin resolver;
- Dirty;
- Cleaning;
- Available con `turnover_today` si representa liberación del día;
- salidas todavía CheckedIn/bloqueadas si el board las expone.

Orden de prioridad:

1. mantenimiento URGENT;
2. mantenimiento HIGH;
3. Dirty con turnover de hoy;
4. Cleaning con turnover de hoy;
5. salida que sigue CheckedIn/bloqueada;
6. Dirty restante;
7. Cleaning restante;
8. mantenimiento MEDIUM/LOW;
9. Available liberada hoy.

Si un caso legacy Maintenance no tiene prioridad, tratarlo como HIGH visualmente
y rotular `Prioridad no informada`; no inventar valor en datos.

### Por limpiar

`room_status === Dirty`, turnover primero.

### En limpieza

`room_status === Cleaning`, turnover primero.

### Listas

`room_status === Available`, turnover/liberadas hoy primero.

### Mantenimiento

`room_status === Maintenance`, orden URGENT/HIGH/MEDIUM/LOW/legacy y luego número.

Crear función pura `buildHousekeepingQueue` y testear orden completo.

## 8. Layout desktop

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Housekeeping                         Actualizado 10:42 [Actualizar]   │
├──────────────────────────────────────────────────────────────────────┤
│ Guía: Próximo paso · 1/3                         [Continuar] [▾]     │
├──────────────────────────────────────────────────────────────────────┤
│ Turno 12 | Por limpiar 4 | En limpieza 3 | Listas 4 | Mant. 1      │
│ [Buscar habitación, tipo o salida...]                                │
├──────────────────────────────────────┬───────────────────────────────┤
│ Cola                                 │ Habitación 204                │
│ ALTA · 204 · Mantenimiento           │ Mantenimiento · Urgente       │
│ TURNO · 102 · Por limpiar            │ Salida de hoy                 │
│ TURNO · 103 · En limpieza            │                               │
│ LISTA · 101 · Liberada               │ [Resumen] [Acción] [Caso]     │
│                                      │ [Acción principal]            │
└──────────────────────────────────────┴───────────────────────────────┘
```

Reglas:

- lista 55–62%; detalle 38–45%;
- scroll independiente;
- selección no desmonta lista;
- una acción primaria visible;
- altura limitada al viewport operativo;
- sin cuatro columnas simultáneas;
- sin formularios dentro de filas.

## 9. Tablet/mobile

### 768–1279

- lista completa;
- detalle en sheet;
- chips envuelven o scroll interno;
- barra guía compacta;
- search ancho completo cuando sea necesario.

### 375/390/430

- header compacto;
- asistente cerrado por default si modo guiado habilitado, preservando estado;
- filtros horizontalmente desplazables;
- filas de 72–104 px;
- detalle full-screen;
- CTA sticky;
- sin overflow horizontal;
- no hover obligatorio;
- target mínimo 44 px.

## 10. Cola compacta

Cada fila contiene:

1. severidad/etapa textual;
2. número;
3. tipo;
4. estado traducido;
5. `Salida de hoy` si corresponde;
6. huésped sólo si board lo expone y aporta al handoff;
7. responsable/prioridad si Maintenance;
8. una acción `Ver tarea`;
9. estado de selección.

No incluir formularios, múltiples botones ni descripción genérica repetida.

Textos:

- Dirty -> `Por limpiar`;
- Cleaning -> `En limpieza`;
- Available -> `Lista`;
- Maintenance -> `Mantenimiento`.

Búsqueda por número, tipo, estado traducido y huésped de salida. Normalizar trim,
case y tildes. No enviar término a telemetría.

## 11. Detalle progresivo

Crear cuerpo compartido:

- desktop inline;
- tablet/mobile sheet;
- una sola lógica.

### Header

- `Habitación {number}`;
- tipo;
- estado;
- turnover/salida de hoy;
- prioridad/responsable si mantenimiento;
- cerrar sólo en sheet.

### Tabs internas

- `Resumen`;
- `Acción` sólo con write o mensaje read-only;
- `Mantenimiento` cuando corresponda o cuando pueda reportarse.

No añadir auditoría si API/board no la expone en este flujo; queda fuera.

### Resumen

- estado actual;
- salida/huésped/booking status disponible;
- siguiente acción derivada de transición real;
- mantenimiento activo;
- mensaje claro si Available no requiere trabajo.

### Acción

Matriz obligatoria:

- Dirty -> `Iniciar limpieza` -> Cleaning;
- Cleaning -> `Finalizar limpieza` -> Available;
- Maintenance -> `Resolver y volver a Por limpiar` con nota >=6;
- Available -> sin transición principal;
- cualquier no-op no debe enviarse;
- acción no autorizada no se renderiza.

Una acción primaria. Loading sólo por habitación/acción. Impedir doble submit.

Tras éxito:

- toast concreto;
- actualizar board;
- mantener seleccionada la habitación si sigue en filtro;
- si sale del filtro, avanzar al siguiente caso y anunciarlo;
- tracking de guía sólo después del éxito.

Tras error:

- conservar selección/formulario;
- error inline además de toast si requiere corrección;
- no marcar guía;
- permitir retry.

### Mantenimiento

Para abrir caso:

- motivo >=6;
- prioridad LOW/MEDIUM/HIGH/URGENT;
- responsable >=2;
- confirmar `Crear caso y bloquear`;
- no usar default `ops` silencioso: mostrar valor sugerido editable y requerir
  confirmación explícita;
- preservar form ante fallo.

Caso activo:

- ID corto;
- motivo;
- prioridad traducida;
- responsable;
- estado legacy si no existe caso visible;
- resolución >=6;
- confirmar retorno a Dirty;
- no permitir marcar Available directamente.

Mover `MaintenanceCaseActions` fuera de cada card y adaptarlo al detalle.

## 12. Salidas de hoy

No mantener una sección duplicada completa.

Integrar información de `departures_today` en las filas correspondientes:

- badge `Salida de hoy`;
- guest/booking status en detalle;
- prioridad de turnover;
- caso bloqueado si booking sigue CheckedIn.

Si existe departure sin room presente en `board.rooms`:

- incluir item de excepción en Turno;
- rotular `Habitación no disponible en board`;
- no inventar acción de limpieza;
- permitir refresh/revisión.

Resumen `Salidas de hoy: N` sigue visible.

## 13. Día operativo

No usar constante de módulo que queda obsoleta.

Crear utilidad/hook de fecha local:

- calcula `yyyy-MM-dd` al montar;
- reevalúa al recuperar foco/visibility;
- programa actualización al cruce de medianoche sin timer intensivo;
- al cambiar día, cambia query key y limpia selección inválida;
- muestra fecha en formato local legible;
- no afirma timezone del hotel si sólo conoce timezone cliente.

No agregar selector de fecha en WF-018: es un tablero del día actual.

## 14. Asistente guiado interactivo

Conservar `GuidedModeContext` y progreso persistente existente.

Pasos esperados:

1. iniciar limpieza;
2. finalizar limpieza;
3. resolver/escalar bloqueo.

CTA de paso:

- `start-cleaning`: filtro Por limpiar, seleccionar primer Dirty;
- `finish-cleaning`: filtro En limpieza, seleccionar primer Cleaning;
- `handle-blocker`: filtro Mantenimiento o excepción bloqueada;
- `review-board`: filtro Turno y foco en cola.

Nunca ejecutar API desde CTA de guía.

Si no existe candidato:

- marcar visualmente `Sin casos disponibles ahora`, no completado automáticamente;
- permitir revisar otro filtro;
- no enfocar ID inexistente.

No duplicar toggle en header y asistente. Debe existir una única fuente de verdad.

Regresión obligatoria:

- colapsar no deshabilita;
- deshabilitar no pierde progreso;
- reset requiere intención explícita;
- progreso persiste refresh;
- sólo éxito operativo avanza.

## 15. Estado y concurrencia

Estado sugerido:

```ts
type HousekeepingFilter = "shift" | "dirty" | "cleaning" | "available" | "maintenance";

type HousekeepingWorkspaceState = {
  activeFilter: HousekeepingFilter;
  search: string;
  selectedRoomId: string | null;
  expandedGuide: boolean;
};
```

Loading de acciones:

```ts
Map<roomId, "start" | "finish" | "maintenance" | "resolve">
```

Reglas:

- una mutación bloquea sólo la habitación afectada;
- impedir segunda acción en la misma room;
- otras filas pueden seguir consultándose;
- evitar mutaciones concurrentes contradictorias sobre la misma room;
- refetch no borra form durante error;
- no optimistic update para transiciones críticas; esperar server.

## 16. Query y errores

Key:

```text
housekeeping:board:{localDate}
```

Un único endpoint contiene board y departures; error es del board completo.

Loading:

- header/filtros visibles;
- skeleton lista/detalle;
- sin ceros falsos.

Error:

- `No se pudo cargar el turno de Housekeeping`;
- Reintentar;
- conservar data previa si existe;
- no mostrar empty simultáneo.

Empty:

- Turno sin tareas: `El turno está bajo control`;
- filtro vacío: mensaje específico y volver a Turno;
- search vacío: limpiar búsqueda;
- no confundir board vacío con error.

Refresh:

- `Actualizando…`;
- evitar múltiples;
- mantener contenido;
- timestamp tras éxito;
- aria-live polite.

## 17. Accesibilidad

- heading y fecha claros;
- filtros como tabs o botones `aria-pressed`;
- conteos accesibles;
- lista semántica;
- fila seleccionable por teclado o botón explícito;
- status no sólo color;
- prioridad no sólo color;
- action labels específicas con room number;
- forms con labels/error/help;
- confirmaciones accesibles;
- foco al detalle después de selección de guía;
- retorno de foco al cerrar sheet;
- focus trap/Escape;
- targets 44 px;
- contraste AA;
- reduced motion;
- sin scroll suave obligatorio con reduced motion;
- no hover requerido;
- estado de carga/error anunciado moderadamente.

## 18. Densidad visual y lenguaje

Eliminar:

- bloque grande Prioridades;
- cards duplicadas de resumen;
- sección separada Salidas;
- cuatro columnas permanentes;
- forms embebidos por card;
- GuideRail/GuideHint simultáneos.

Usar español con tildes:

- `Habitación`;
- `Atención`;
- `Limpieza`;
- `Por limpiar`;
- `En limpieza`;
- `Lista`;
- `Mantenimiento`;
- `Huésped`;
- `Salió`;
- `Todavía`.

No cambiar enum/API; traducir presentación.

Componentes nuevos <=350 líneas o justificación. No crecer `index.css` salvo
necesidad mínima. Sin nuevas dependencias.

## 19. Componentes propuestos

- `HousekeepingPage.tsx`: query, mutaciones, permisos y coordinación.
- `HousekeepingWorkspace.tsx`.
- `HousekeepingFilterTabs.tsx`.
- `HousekeepingQueue.tsx`.
- `HousekeepingQueueItem.tsx`.
- `HousekeepingRoomWorkspace.tsx`.
- `HousekeepingRoomSheet.tsx`.
- `HousekeepingRoomActions.tsx`.
- adaptar `MaintenanceCaseActions.tsx` para detalle.
- reutilizar `CompactGuideAssistant.tsx`.
- `housekeepingQueue.ts`: prioridad/modelo.
- `useOperationalDate.ts` o utilidad equivalente.

No duplicar detalle desktop/mobile ni Guide state.

## 20. Archivos previstos

Modificar:

- `frontend/src/features/housekeeping/HousekeepingPage.tsx`
- `frontend/src/features/housekeeping/components/MaintenanceCaseActions.tsx`
- tests existentes/nuevos
- `frontend/e2e/housekeeping-role-smoke.spec.ts`
- posiblemente guía housekeeping y tests si cambia navegación, no semántica.

Posibles nuevos: componentes sección 19 y evidencia WF-018.

No modificar:

- backend;
- migraciones;
- OpenAPI;
- RBAC;
- Rooms workflow;
- Reception;
- Calendar;
- Dashboard;
- layout global.

## 21. Implementación incremental

1. Caracterización de board, transiciones, guía y mantenimiento.
2. Crear modelo de cola/orden y fecha operativa testeable.
3. Implementar filtros/resumen compacto y eliminar duplicados.
4. Implementar lista + detalle compartido responsive.
5. Mover acciones/mantenimiento al detalle con loading por room.
6. Integrar asistente compacto y navegación contextual.
7. Completar errores, empty, accesibilidad y responsive.
8. Suites, Playwright, gates, review y evidencia.

Máximo ocho; tests focalizados tras cada paso.

## 22. Criterios de aceptación

- `AC-01`: Turno es filtro default.
- `AC-02`: existen cinco filtros exactos.
- `AC-03`: conteos provienen del board real.
- `AC-04`: no quedan cuatro columnas simultáneas.
- `AC-05`: no queda sección Salidas duplicada.
- `AC-06`: turnover se integra en cola/detalle.
- `AC-07`: orden de Turno sigue matriz definida.
- `AC-08`: legacy Maintenance se identifica sin inventar prioridad de datos.
- `AC-09`: search funciona por número/tipo/estado/huésped.
- `AC-10`: textos visibles están en español.
- `AC-11`: desktop muestra lista+detalle.
- `AC-12`: <1280 usa mismo cuerpo en sheet.
- `AC-13`: una fila no contiene formularios.
- `AC-14`: una acción primaria por detalle.
- `AC-15`: Dirty sólo ofrece iniciar.
- `AC-16`: Cleaning sólo ofrece finalizar.
- `AC-17`: Maintenance sólo resuelve a Dirty.
- `AC-18`: Available no envía no-op.
- `AC-19`: mutaciones requieren housekeeping.write.
- `AC-20`: doble click no duplica POST.
- `AC-21`: loading afecta sólo room correspondiente.
- `AC-22`: error conserva form/selección.
- `AC-23`: éxito refresca y avanza contexto coherentemente.
- `AC-24`: guía avanza sólo tras éxito.
- `AC-25`: CTA guía nunca muta.
- `AC-26`: CTA guía cambia filtro/selección/foco.
- `AC-27`: colapsar guía no deshabilita.
- `AC-28`: existe un único toggle de guía en la composición.
- `AC-29`: no coexisten GuideRail y GuideHint duplicados.
- `AC-30`: progreso/reset/persistencia conservados.
- `AC-31`: mantenimiento valida motivo/responsable.
- `AC-32`: resolución valida nota.
- `AC-33`: liberar Maintenance directo a Available es imposible.
- `AC-34`: legacy case tiene flujo explícito.
- `AC-35`: departure huérfana genera excepción.
- `AC-36`: fecha cambia al cruzar medianoche/visibility.
- `AC-37`: query key usa fecha vigente.
- `AC-38`: error board tiene retry.
- `AC-39`: loading no muestra cero falso.
- `AC-40`: empty distingue filtro/search/turno.
- `AC-41`: read-only no ve mutaciones.
- `AC-42`: receptionist/saas_admin siguen sin acceso.
- `AC-43`: mobile sin overflow en 375/390/430.
- `AC-44`: tablet/desktop sin overflow 768/1024/1280/1440.
- `AC-45`: filtros/cola/acciones funcionan con teclado.
- `AC-46`: status/prioridad no sólo color.
- `AC-47`: focus retorna al cerrar.
- `AC-48`: targets >=44 px.
- `AC-49`: no nuevas dependencias.
- `AC-50`: backend/API/RBAC sin cambios.
- `AC-51`: tests/gates PASS.

## 23. Tests unitarios

### `housekeepingQueue.test.ts`

- orden completo;
- urgent/high maintenance;
- turnover Dirty/Cleaning;
- checked-in blocked;
- maintenance medium/low;
- legacy;
- Available turnover;
- filtros;
- search traducido;
- departure huérfana.

### `HousekeepingPage.test.tsx`

- board query fecha;
- loading/error/retry/empty;
- summary/filtros;
- selección;
- RBAC read/write;
- refresh;
- cambio fecha operativo;
- no bloques duplicados;
- integración guía.

### `HousekeepingRoomWorkspace.test.tsx`

- acciones por estado;
- acción única;
- submit único;
- loading por room;
- éxito/error;
- cambio de filtro tras éxito;
- read-only;
- sheet/inline body común.

### `MaintenanceCaseActions.test.tsx`

Conservar casos actuales y agregar:

- form sólo en detalle;
- motivo/responsable;
- prioridad traducida;
- confirmación;
- legacy;
- resolución;
- error conserva campos;
- no Available directo.

### Guía

- CompactGuideAssistant housekeeping;
- CTA selecciona candidato sin API;
- no candidato;
- progreso sólo éxito;
- collapse/toggle/reset/persistencia;
- tests existentes no se eliminan sin equivalente.

## 24. Playwright

Actualizar `housekeeping-role-smoke.spec.ts` o crear suite complementaria.

Escenarios:

1. housekeeping entra a `/housekeeping`;
2. Turno activo + filtros/conteos;
3. cola ordenada con seed determinista;
4. Dirty abre detalle y comienza limpieza;
5. Cleaning finaliza y sale del filtro;
6. incidencia crea Maintenance;
7. Maintenance resuelve a Dirty;
8. doble click sólo un POST;
9. otra room sigue usable durante mutación;
10. guía compacta sin duplicación;
11. CTA guía selecciona sin mutar;
12. progreso tras éxito;
13. error interceptado conserva form;
14. read-only sin botones si fixture disponible;
15. receptionist no accede;
16. mobile sheet/CTA sticky;
17. teclado filtros/selección;
18. foco retorna;
19. widths 375/390/430/768/1024/1280/1440 sin overflow;
20. cambio de fecha/visibility con clock controlado.

Capturas: Turno desktop/mobile, detalle Dirty/Cleaning/Maintenance, guía abierta y
cerrada, error/empty.

## 25. Comandos exactos

```bash
git status --short
git log -5 --oneline --decorate
docker compose exec -T frontend npm run test -- --run src/features/housekeeping/housekeepingQueue.test.ts
docker compose exec -T frontend npm run test -- --run src/features/housekeeping/HousekeepingPage.test.tsx
docker compose exec -T frontend npm run test -- --run src/features/housekeeping/components/HousekeepingRoomWorkspace.test.tsx
docker compose exec -T frontend npm run test -- --run src/features/housekeeping/components/MaintenanceCaseActions.test.tsx
docker compose exec -T frontend npm run test -- --run src/features/guided/housekeepingGuide.test.ts
docker compose exec -T frontend npm run test -- --run src/features/guided/components/CompactGuideAssistant.test.tsx
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm run test -- --run
docker compose exec -T frontend npm run build
docker compose exec -T frontend npx playwright test e2e/housekeeping-role-smoke.spec.ts --project=chromium
./scripts/check-openapi-alignment.sh
./scripts/qa-core-journeys.sh
./scripts/gate.sh
```

Registrar PASS/FAIL y exit code por comando.

## 26. Evidencia

Crear:

`docs/validation/wf-018-housekeeping-shift-workspace-evidence-YYYY-MM-DD.md`

Incluir branch/SHA, diff, AC-01..51, comandos/resultados, tests, Playwright,
capturas, matriz de orden/transiciones/RBAC, guía, fecha operativa, review,
performance, seguridad, riesgos y DoD.

## 27. Review estricto

### Critical

- mutación sin write;
- transición sobre room equivocada;
- resolver Maintenance directo a Available;
- cross-tenant;
- doble POST;
- cambio API/RBAC.

### High

- guía ejecuta acción;
- progreso avanza en fallo;
- acción global bloquea/mezcla rooms;
- caso maintenance pierde form;
- fecha queda en día anterior;
- lista/detalle divergen;
- Available domina Turno;
- departure huérfana desaparece.

### Medium

- guía duplicada;
- status inglés;
- filtros sin teclado;
- form en card;
- error sin retry;
- scroll excesivo/overflow;
- status sólo color.

### Low

- microcopy/spacing/iconografía.

## 28. Qué rompería producción

- iniciar/finalizar habitación distinta;
- dos acciones concurrentes sobre misma room;
- marcar guía sin confirmación backend;
- perder incidencia escrita tras error;
- ocultar Maintenance urgente;
- tratar Available histórica como liberada hoy sin dato;
- usar fecha vieja tras medianoche;
- exponer huésped/razón en telemetría;
- saltar workflow Maintenance;
- perder focus/CTA en mobile.

## 29. Performance y seguridad

- una query board por fecha/stale window;
- cola derivada memoizada;
- no forms montados por cada card;
- no cuatro columnas/cards grandes simultáneas;
- una mutación por room;
- no nueva dependencia;
- capability antes de handler;
- backend autoridad;
- no PII en telemetry/localStorage;
- cache invalidada en tenant switch;
- no secretos E2E;
- errores seguros.

## 30. Fuera de alcance

- asignación persistente;
- SLA/time tracking;
- checklist/fotos;
- bulk actions;
- drag/drop;
- calendario de personal;
- cambios reserva/checkout;
- inventario/tarifa;
- realtime;
- backend/API/RBAC;
- rediseño global.

## 31. DoD

- [ ] Gate 0.
- [ ] Rama limpia WF-018.
- [ ] Turno + cuatro filtros.
- [ ] Cola priorizada testeada.
- [ ] Sin landing/cards duplicadas.
- [ ] Lista/detalle compartido.
- [ ] Acciones exactas por estado.
- [ ] Loading por room.
- [ ] Maintenance completo/legacy.
- [ ] Guía compacta única.
- [ ] CTA guía no muta.
- [ ] Progreso sólo éxito.
- [ ] Fecha operativa robusta.
- [ ] RBAC preservado.
- [ ] Errors/empty/retry.
- [ ] Responsive/accesibilidad.
- [ ] Tests focalizados PASS.
- [ ] Suite/lint/build PASS.
- [ ] Playwright PASS.
- [ ] OpenAPI/journeys/gate PASS.
- [ ] Review/evidencia.
- [ ] API/RBAC sin cambios.

## 32. Gate 0 esperado

Resumen de cinco líneas, archivos exactos, máximo ocho pasos y tests exactos en
PENDIENTE/PASS/FAIL.

## 33. Criterio final

WF-018 cumple sólo si el operador identifica la próxima habitación, ejecuta una
única transición segura, escala/resuelve mantenimiento sin perder contexto y usa
una guía compacta que orienta sin automatizar acciones. Debe funcionar en
desktop/mobile, con RBAC y evidencia verde.

Una versión más bonita del kanban actual que conserve guía duplicada, formularios
en cards, conteos repetidos o loading global no cumple el ticket.
