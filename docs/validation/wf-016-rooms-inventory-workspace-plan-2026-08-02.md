# WF-016 — Workspace de Inventario de Habitaciones

Fecha: 2026-08-02
Producto: HMS Elite
Área: Habitaciones (`/rooms`)
Estado: plan detallado; implementación no iniciada
Audiencia: siguiente agente implementador

## 1. Mandato inequívoco para el siguiente agente

Actuá como Principal Engineer, Product Designer, QA Lead y Security Engineer.
Implementá WF-016 respetando arquitectura existente, API v1, RBAC, aislamiento
multi-tenant, accesibilidad, responsive y todos los gates del repositorio.

Este documento fija el comportamiento esperado. No es una lista de sugerencias
visuales. Las decisiones marcadas como obligatorias sólo pueden cambiarse con
autorización explícita y evidencia técnica.

Antes de editar código:

1. Leer este documento completo.
2. Leer [WF-014](wf-014-reception-workspace-plan-2026-08-01.md) para conservar
   la separación entre Recepción y gestión de inventario.
3. Leer [WF-015](wf-015-dashboard-control-center-plan-2026-08-02.md) para
   conservar el patrón de tabs, carga diferida y errores parciales.
4. Ejecutar `git status --short` y `git log -5 --oneline --decorate`.
5. No comenzar sobre un worktree sucio de otro agente.
6. Crear `feature/wf-016-rooms-inventory-workspace` desde la última base de
   integración autorizada y registrar el SHA exacto en Gate 0.
7. No usar `git reset`, `git checkout --`, `git clean` ni descartar cambios.
8. Entregar Gate 0 antes de modificar archivos.

Al redactar este plan, la rama activa era
`feature/wf-015-dashboard-control-center` y el árbol estaba limpio. WF-015 sólo
tenía su plan documentado. No asumir que ese estado seguirá vigente: verificar
la base real antes de implementar.

## 2. Decisión de producto

La página Habitaciones debe dejar de comportarse como una landing page extensa
que apila prioridades, estadísticas, planner, timeline, selección masiva,
disponibilidad e inventario.

Debe convertirse en un workspace de inventario con cuatro tareas separadas:

1. `Inventario`: consultar y operar el estado actual de cada habitación.
2. `Disponibilidad`: buscar habitaciones vendibles para un rango y reservar.
3. `Planificador`: entender ocupación, reservas y bloqueos de los próximos siete
   días.
4. `Bloqueos`: consultar la timeline y administrar holds temporales.

La vista inicial obligatoria es `Inventario`.

Principio rector:

> Mostrar sólo la información necesaria para la tarea activa y revelar el
> detalle después de seleccionar una habitación.

No resolver el problema agregando más tarjetas, accesos rápidos o secciones
verticales.

## 3. Objetivo del usuario

Un usuario autorizado debe poder responder rápidamente:

- ¿qué habitaciones están disponibles, ocupadas, sucias, en limpieza o en
  mantenimiento?;
- ¿qué habitación necesita una acción ahora?;
- ¿qué habitaciones están disponibles para fechas concretas?;
- ¿qué reservas o holds afectan los próximos días?;
- ¿qué puede modificar según sus permisos?;
- ¿cómo abre el detalle sin perder la lista o el contexto?

Objetivos medibles:

1. Identificar el inventario fuera de venta en menos de cinco segundos.
2. Encontrar una habitación por número, tipo o estado en menos de tres acciones.
3. Cambiar de tarea sin scroll largo.
4. Seleccionar una habitación y conservar el contexto en desktop.
5. Buscar disponibilidad sin alterar resúmenes ni planner operativo.
6. Ejecutar acciones masivas sólo sobre transiciones válidas.
7. Operar en mobile sin overflow horizontal de página.

## 4. Alcance exacto

Incluido:

- ruta `/rooms`;
- inventario actual;
- búsqueda y filtros locales del inventario;
- vista compacta y tabla;
- selección y acciones masivas existentes;
- detalle de habitación;
- cambio individual de estado existente;
- datos comerciales de habitación;
- creación de habitación;
- búsqueda de disponibilidad por fechas;
- creación de reserva con el drawer existente;
- planificador de siete días;
- consulta y gestión de holds existentes;
- auditoría existente;
- carga diferida por vista;
- errores parciales;
- RBAC por capability;
- responsive y accesibilidad;
- tests unitarios, integración frontend y Playwright.

No incluido:

- cambiar reglas de transición backend;
- crear workflow de mantenimiento dentro de Habitaciones;
- rediseñar Housekeeping;
- rediseñar Recepción;
- añadir pisos, edificios, alas o atributos físicos al modelo;
- drag and drop de reservas;
- mover reservas entre habitaciones desde el planner;
- pricing dinámico;
- tarifas por temporada;
- channel manager;
- inventario multi-hotel;
- nuevas APIs;
- nuevos roles o capabilities;
- persistir tabs, filtros o vista en servidor;
- deep links/query params en V1.

## 5. Diagnóstico del estado actual

`RoomsPage.tsx` combina en una sola página:

1. header con selector `Grid/Lista` y creación;
2. bloque grande de prioridades;
3. foco del turno;
4. inventario total;
5. acción recomendada;
6. cuatro tarjetas de estados;
7. planner operativo de siete días;
8. timeline completa de bloqueos;
9. barra de acción masiva;
10. buscador de disponibilidad;
11. resultado de disponibilidad;
12. grilla o tabla completa de habitaciones;
13. drawer de reserva;
14. drawer de creación;
15. sheet administrativo de más de 600 líneas.

Consecuencias:

- apariencia de landing page;
- scroll excesivo antes de llegar al inventario;
- prioridades y estadísticas repiten estados;
- acciones que hacen scroll a otra sección en vez de cambiar de contexto;
- planner y timeline compiten por ancho y atención;
- la grilla de disponibilidad reutiliza la misma colección que el inventario;
- la búsqueda por fechas reemplaza `rooms`, por lo que puede alterar resumen,
  selección y planner con un subconjunto comercial;
- hold board y bookings del planner se consultan aunque el usuario no abra esas
  secciones;
- vista `Grid` usa un término visible en inglés;
- algunos textos omiten tildes y reducen calidad percibida;
- las cards son altas y repiten CTA;
- selección masiva persiste de forma poco visible al cambiar filtros;
- el detalle administrativo vuelve a apilar recomendación, resumen, estados,
  edición, holds y auditoría;
- el planner infiere `Piso` desde el número de habitación aunque API v1 no
  expone un campo de piso;
- la timeline puede crecer demasiado con rangos amplios;
- no existen tests frontend focalizados del segmento Habitaciones.

## 6. Riesgo funcional que debe corregirse

Actualmente `getAllRooms(start, end)` devuelve `/rooms/available` cuando hay
fechas. Esa misma respuesta alimenta:

- resumen de estados;
- filtros;
- selección;
- cards/table;
- planner.

Una búsqueda comercial no debe reemplazar el inventario operativo.

WF-016 debe separar obligatoriamente:

```ts
inventoryRooms = GET /rooms
availableRooms = GET /rooms/available?start&end
```

Reglas:

- `inventoryRooms` alimenta Inventario, contadores y selección;
- `availableRooms` alimenta sólo Disponibilidad;
- planner usa `inventoryRooms` más sus datos diferidos;
- limpiar disponibilidad no invalida ni reemplaza inventario;
- buscar disponibilidad no borra selección masiva;
- un error de disponibilidad no afecta Inventario.

No cambiar el contrato de `getAllRooms` de forma ambigua. Preferir servicios con
responsabilidad explícita, por ejemplo:

```ts
listRooms(): Promise<Room[]>
searchAvailableRooms(start: string, end: string): Promise<Room[]>
```

Mantener nombres existentes sólo si sus responsabilidades quedan inequívocas y
testeadas.

## 7. Usuarios y RBAC reales

La ruta exige `rooms.read`.

### `admin`

Posee:

- `rooms.read`;
- `rooms.search`;
- `rooms.write`;
- `rooms.status.write`;
- `bookings.read/write`;
- `audit.events.read`.

Puede ver las cuatro vistas, crear/editar habitaciones, operar estados, gestionar
holds, reservar y consultar auditoría.

### `ops`

Posee:

- `rooms.read`;
- `rooms.search`;
- `rooms.status.write`;
- `bookings.read/write`;
- `audit.events.read`.

Puede consultar las cuatro vistas, cambiar estados válidos, reservar y ver
auditoría. No puede crear/editar datos comerciales ni crear/editar/eliminar
holds porque no posee `rooms.write`.

### `receptionist`

Posee:

- `rooms.read`;
- `rooms.search`;
- `bookings.read/write`.

Puede consultar inventario, disponibilidad, planner y bloqueos en modo lectura,
y puede reservar una habitación disponible. No puede cambiar estados, editar
inventario, gestionar holds ni ver auditoría.

### `housekeeping` y `saas_admin`

No poseen `rooms.read`; no deben acceder a `/rooms` mediante este ticket.

### Reglas obligatorias

- controlar UI por capability, no por nombre de rol;
- no mostrar CTA que termina en `/forbidden`;
- no enviar request mutante si falta capability;
- ocultar o deshabilitar con explicación según el caso;
- backend sigue siendo autoridad final;
- no ampliar canon RBAC en WF-016.

## 8. Arquitectura de información definitiva

### 8.1 Header

Contenido obligatorio:

1. título `Habitaciones`;
2. subtítulo `Inventario, disponibilidad y bloqueos`;
3. botón secundario `Actualizar`;
4. botón primario `Nueva habitación` sólo con `rooms.write`.

No colocar el selector de vista compacta/tabla en el header global. Pertenece a
Inventario.

No colocar más de un CTA primario.

### 8.2 Tabs

Orden obligatorio:

1. `Inventario`;
2. `Disponibilidad`;
3. `Planificador`;
4. `Bloqueos`.

Todos los usuarios con `rooms.read` pueden consultar las cuatro vistas. Los
controles mutantes de Bloqueos se muestran sólo con `rooms.write`.

Si en la base real el backend restringe lectura de holds de forma diferente,
respetar la capability efectiva y documentar la desviación en Gate 0. No cambiar
RBAC para acomodar la UI.

Estado local en V1. No crear rutas nuevas ni query params.

Semántica obligatoria:

- `tablist`;
- `tab`;
- `tabpanel`;
- `aria-selected`;
- `aria-controls`;
- teclado con flechas, Home y End;
- indicador activo que no dependa sólo del color.

### 8.3 Carga por tab

- Inventario: carga `GET /rooms` al entrar.
- Disponibilidad: no consulta hasta que el usuario envía fechas válidas.
- Planificador: carga bookings y hold board sólo al abrir la vista.
- Bloqueos: carga hold board sólo al abrir la vista.
- Detalle: carga holds y auditoría al seleccionar habitación y sólo si procede.

Compartir cache del hold board entre Planificador y Bloqueos cuando rango y
permisos coinciden. No duplicar requests por re-render.

## 9. Layout objetivo

### 9.1 Desktop ancho (`>= 1280px`)

Inventario:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Habitaciones                         [Actualizar] [Nueva habitación] │
│ Inventario, disponibilidad y bloqueos                               │
├─────────────────────────────────────────────────────────────────────┤
│ Inventario | Disponibilidad | Planificador | Bloqueos               │
├─────────────────────────────────────────────────────────────────────┤
│ Buscar... [Todas 80] [Disponibles 21] [Ocupadas 42] [...] [▦] [☷] │
├─────────────────────────────────────┬───────────────────────────────┤
│ Inventario                          │ Habitación 204                │
│ □ 101 Doble      Disponible         │ Disponible · Doble            │
│ □ 102 Suite      Ocupada            │ Tarifa base                   │
│ □ 103 Doble      Limpieza           │                               │
│ □ 204 Suite      Mantenimiento      │ Resumen | Operación | ...     │
│                                     │ [acción contextual]           │
├─────────────────────────────────────┴───────────────────────────────┤
│ 3 seleccionadas [Marcar disponibles] [Enviar a limpieza] [Limpiar] │
└─────────────────────────────────────────────────────────────────────┘
```

Reglas:

- panel izquierdo entre 55% y 62%;
- panel derecho entre 38% y 45%;
- inventario y detalle tienen scroll interno independiente;
- seleccionar habitación no cierra ni desmonta la lista;
- sin selección, panel derecho explica cómo seleccionar;
- barra masiva sticky dentro del workspace, no flotante sobre navegación;
- altura objetivo: viewport disponible menos header/layout;
- no anidar cards completas dentro de cards.

### 9.2 Desktop/tablet (`768px` a `1279px`)

- Inventario ocupa ancho completo;
- detalle se abre en sheet usando el mismo cuerpo del panel desktop;
- filtros envuelven en máximo dos líneas;
- tabla puede usar scroll interno si mantiene primera columna y acciones legibles;
- barra masiva fija en parte inferior del workspace sin tapar contenido;
- tabs mantienen texto visible.

### 9.3 Mobile (`375px`, `390px`, `430px`)

- header apilado;
- tabs con scroll horizontal sólo dentro del tablist;
- chips de estado horizontalmente desplazables con affordance visible;
- default `Compacta`, no tabla;
- cada fila/card muestra número, tipo, estado y una acción;
- detalle en sheet full-screen;
- CTA principal sticky dentro del sheet;
- selección múltiple puede deshabilitarse en vista compacta si no puede
  garantizarse claridad; la tabla/lista seleccionable debe seguir disponible;
- Planificador usa alternativa mobile, no una grilla de 760 px como única vista;
- la página nunca tiene overflow horizontal.

## 10. Vista Inventario

### 10.1 Barra de herramientas

Orden:

1. búsqueda;
2. filtros de estado con conteo;
3. selector `Compacta` / `Tabla`;
4. cantidad de resultados.

Búsqueda client-side por:

- número;
- tipo;
- estado visible en español.

Normalizar:

- trim;
- minúsculas;
- tildes;
- equivalencias visibles (`limpieza` debe encontrar `Dirty` y `Cleaning` según
  presentación actual).

Atajo opcional `/` sólo si no interfiere con inputs y queda testeado. `Escape`
limpia búsqueda cuando el input tiene foco.

### 10.2 Filtros de estado

Chips obligatorios:

- `Todas`;
- `Disponibles`;
- `Ocupadas`;
- `Limpieza`;
- `Mantenimiento`.

`Limpieza` agrupa `Dirty` y `Cleaning`, pero el detalle conserva el estado exacto.

Los conteos siempre se calculan sobre `inventoryRooms`, nunca sobre resultados de
disponibilidad.

Un chip activo debe tener texto/ícono o indicador además de color.

### 10.3 Vista Compacta

No usar cards de 220 px con descripción genérica repetida.

Cada elemento contiene únicamente:

1. checkbox si `rooms.status.write` y selección habilitada;
2. número de habitación;
3. tipo;
4. estado;
5. tarifa base si el usuario puede ver inventario;
6. una acción contextual o menú;
7. indicador de selección.

Acción primaria por estado/capability:

- disponible + `bookings.write`: `Reservar`;
- gestión permitida: `Ver detalle` o menú;
- mantenimiento: `Ver detalle`, nunca resolver localmente;
- read-only: fila abre resumen, sin controles mutantes.

No mostrar simultáneamente `Reservar`, `Gestionar` y menú si duplican destinos.

### 10.4 Vista Tabla

Columnas:

1. selección si corresponde;
2. habitación;
3. tipo;
4. estado;
5. tarifa base;
6. acción contextual;

No repetir buscador interno de `DataTable` si la toolbar ya posee búsqueda.

La fila seleccionada para detalle debe diferenciarse de la selección masiva.
Usar dos estados distintos:

```ts
selectedRoomId: string | null
bulkSelectedRoomIds: string[]
```

Click de fila selecciona detalle. Click de checkbox sólo modifica selección
masiva y no debe abrir detalle accidentalmente.

### 10.5 Resumen de estados

Los chips reemplazan las cuatro tarjetas estadísticas y los grandes bloques de
prioridades.

Puede existir una única alerta compacta encima de la lista cuando:

- hay habitaciones en mantenimiento; o
- no hay habitaciones disponibles.

No mostrar simultáneamente prioridad, foco del turno, acción recomendada y
cuatro stat cards.

No afirmar causas o recomendaciones que los datos no prueban.

## 11. Selección y acciones masivas

Disponible sólo con `rooms.status.write`.

La barra muestra:

- cantidad seleccionada;
- desglose por estado;
- `Marcar disponibles`;
- `Enviar a limpieza`;
- `Limpiar selección`.

No agregar `Mantenimiento`: backend exige workflow de Housekeeping.

### Matriz real de transiciones relevantes

Backend permite conceptualmente:

- `Occupied -> Dirty`;
- `Cleaning -> Available`;
- mismo estado como no-op;
- transiciones hacia/desde Maintenance se rechazan en los endpoints generales,
  aunque el modelo de dominio tenga transiciones internas.

Por lo tanto:

- `Marcar disponibles` sólo puede enviarse si todas las seleccionadas están en
  `Cleaning` o `Available`;
- `Enviar a limpieza` sólo puede enviarse si todas están en `Occupied` o `Dirty`;
- si hay estados incompatibles, deshabilitar acción y explicar cuáles bloquean;
- Maintenance siempre bloquea acción masiva;
- no enviar un lote parcialmente válido: backend valida el conjunto completo;
- confirmar antes de POST con cantidad, destino y desglose;
- impedir doble submit;
- tras éxito limpiar selección, refrescar inventario y anunciar cantidad;
- tras error conservar selección y mostrar mensaje accionable.

No duplicar IDs. El backend deduplica, pero frontend debe mantener un `Set` o
equivalente.

Selección al cambiar filtros:

- conservar IDs válidos;
- mostrar `N seleccionadas, M fuera del filtro`;
- `Seleccionar visibles` sólo afecta el resultado filtrado;
- `Limpiar selección` elimina todo;
- si una habitación desaparece después de refetch, remover su ID.

## 12. Detalle progresivo de habitación

Crear un cuerpo común, por ejemplo `RoomDetailWorkspace.tsx`:

- desktop ancho: panel inline;
- tablet/mobile: `Sheet`;
- una sola lógica y un solo árbol funcional;
- no mantener dos implementaciones divergentes.

### 12.1 Header del detalle

Mostrar:

- `Habitación {number}`;
- tipo;
- badge de estado;
- tarifa base;
- una acción principal contextual;
- cerrar sólo cuando está dentro de sheet.

### 12.2 Tabs internas

Orden y visibilidad:

1. `Resumen`: todos con `rooms.read`.
2. `Operación`: sólo `rooms.status.write`.
3. `Configuración`: sólo `rooms.write`.
4. `Bloqueos`: lectura con `rooms.read`; mutaciones con `rooms.write`.
5. `Historial`: sólo `audit.events.read`.

No renderizar tabs vacías.

#### Resumen

- número;
- tipo;
- estado exacto;
- tarifa base;
- próximo movimiento sólo si se deriva de reglas reales;
- cantidad de holds si ya fue cargada;
- CTA `Reservar` sólo si Available + `bookings.write`.

#### Operación

- estado actual;
- transiciones válidas hacia Available o Dirty según matriz;
- explicación cuando Maintenance debe resolverse en Housekeeping;
- loading por mutación;
- sin doble submit;
- error inline y toast coherente.

No ofrecer botones que backend rechazará.

#### Configuración

- reutilizar `RoomFormFields`;
- número;
- tipo;
- tarifa base;
- validaciones actuales;
- guardado explícito;
- advertir cambios sin guardar antes de cerrar/cambiar tab;
- no duplicar formulario de creación.

#### Bloqueos

Modo lectura:

- lista por fecha;
- tipo traducido;
- motivo;
- estado vacío;
- loading y retry.

Con `rooms.write`:

- crear;
- editar;
- liberar;
- validar salida posterior a entrada;
- motivo requerido;
- confirmar `Liberar`;
- conservar formulario ante error;
- impedir doble submit/delete.

#### Historial

- reutilizar `AuditTimeline`;
- carga sólo cuando tab está activa;
- no exponer a roles sin capability;
- refrescar tras mutaciones exitosas.

### 12.3 Acción sticky

En mobile, el CTA principal debe quedar visible al fondo del sheet sin tapar
campos. Puede ser:

- `Reservar`;
- `Guardar cambios`;
- `Marcar disponible`;
- `Enviar a limpieza`.

Nunca mostrar más de una acción primaria simultánea.

## 13. Vista Disponibilidad

### 13.1 Formulario

Mostrar:

- fecha de entrada;
- fecha de salida;
- cantidad de noches;
- `Buscar disponibilidad`;
- `Limpiar` sólo después de seleccionar fechas.

Reglas:

- salida posterior a entrada;
- fechas en `yyyy-MM-dd` para API;
- no ejecutar búsqueda automáticamente al elegir parcialmente el rango;
- ejecutar sólo al presionar Buscar;
- evitar doble request por `onSelect` + botón, problema presente hoy;
- mantener últimas fechas visibles;
- `Limpiar` elimina sólo resultados comerciales.

No usar microcopy `¿Cuándo vienes?`; el usuario es operador. Usar
`Seleccionar entrada y salida`.

### 13.2 Resultados

Antes de buscar:

- estado instructivo compacto.

Loading:

- skeleton sólo en resultados.

Éxito:

- rango y noches visibles;
- cantidad encontrada;
- lista compacta con número, tipo, tarifa y estado;
- CTA `Reservar` sólo con `bookings.write`;
- click abre `BookingDrawer` con habitación y fechas exactas.

Vacío:

- `No hay habitaciones disponibles para este rango`;
- acciones `Cambiar fechas` y, si corresponde, `Ver Planificador`;
- no sugerir overbooking.

Error:

- error local y retry con mismas fechas;
- Inventario permanece utilizable.

### 13.3 Aislamiento

- no modificar contadores de Inventario;
- no cambiar selección masiva;
- no reemplazar habitación seleccionada salvo click explícito;
- no refrescar planner innecesariamente;
- reserva exitosa invalida inventario, disponibilidad y planner relacionados.

## 14. Vista Planificador

Objetivo: visualizar siete días, no administrar todo desde la timeline.

Datos:

- `inventoryRooms`;
- bookings del rango si `bookings.read`;
- holds del rango si `rooms.read`.

### Desktop

- siete columnas de fecha;
- primera columna sticky con habitación, tipo y estado;
- orden por número de habitación;
- no llamar `Piso` a un grupo inferido;
- si se conserva agrupación por numeración, rotular `Grupo {prefijo}` y explicar
  que no representa un piso contractual; preferencia: eliminar agrupación;
- reservas y holds con texto/icono además de color;
- click de habitación abre detalle;
- leyenda compacta.

### Mobile

No usar la grilla ancha como única interfaz.

Usar:

1. selector de día dentro de los siete días;
2. lista de habitaciones del día;
3. número, estado, reserva/hold y acción `Ver detalle`;
4. botones día anterior/siguiente accesibles.

No exponer nombre de huésped a un usuario sin `bookings.read`.

### Estados

- loading separado de inventario;
- fallo de bookings conserva habitaciones y holds;
- fallo de holds conserva habitaciones y bookings;
- empty de reservas no significa habitación disponible si existe hold/estado no
  vendible;
- evitar tooltips como única fuente de información.

## 15. Vista Bloqueos

Objetivo: analizar inventario retirado de venta por rango.

### Filtros

- Desde;
- Hasta;
- tipo de hold opcional;
- búsqueda por número de habitación;
- máximo 31 días visibles en V1;
- salida posterior a entrada;
- default hoy + 30 días.

Si el usuario intenta más de 31 días, mostrar validación client-side. No truncar
silenciosamente.

### Desktop

- timeline por habitación;
- primera columna sticky;
- scroll horizontal interno permitido;
- página sin overflow;
- lista de detalle debajo sólo para el hold seleccionado, no repetir todos los
  holds como cards tras la timeline;
- click de bloque selecciona hold y abre resumen/detalle;
- CTA `Gestionar habitación` abre detalle compartido.

### Mobile

- no renderizar timeline completa;
- lista agrupada por habitación o fecha;
- tipo, motivo, rango y estado;
- filtro accesible;
- gestión abre sheet de habitación.

### Permisos

- `rooms.read`: consultar;
- `rooms.write`: crear/editar/liberar desde detalle;
- no mostrar formularios mutantes a ops/receptionist;
- motivos pueden ser sensibles operativamente: no enviarlos a telemetría.

## 16. Estado frontend recomendado

```ts
type RoomsWorkspaceTab = "inventory" | "availability" | "planner" | "holds";
type InventoryDisplayMode = "compact" | "table";
type InventoryStatusFilter = "all" | "available" | "occupied" | "cleaning" | "maintenance";

type RoomsWorkspaceState = {
  activeTab: RoomsWorkspaceTab;
  displayMode: InventoryDisplayMode;
  search: string;
  statusFilter: InventoryStatusFilter;
  selectedRoomId: string | null;
  bulkSelectedRoomIds: string[];
  availabilityRange: { start: string; end: string } | null;
  plannerStart: string;
  holdsRange: { start: string; end: string };
};
```

Reglas:

- tab y filtros locales en V1;
- no localStorage;
- no nueva librería de estado;
- separar selección de detalle y selección masiva;
- query keys incluyen rango;
- no incluir nombres de huésped en keys;
- limpiar estado de formulario sólo después de éxito o cancelación explícita;
- cambiar tab durante mutación debe bloquearse o pedir confirmación si hay datos
  sin guardar.

## 17. Queries y errores parciales

Keys sugeridas:

```text
rooms:inventory
rooms:availability:{start}:{end}
rooms:planner-bookings:{start}:{end}
rooms:holds-board:{start}:{end}
rooms:detail:{roomId}:holds
audit:room:{roomId}
```

Comportamiento:

- Inventario no depende de las demás queries;
- disponibilidad `enabled` sólo tras submit válido;
- planner bookings/holds `enabled` sólo al abrir Planificador;
- board `enabled` sólo al abrir Bloqueos o cuando Planificador lo necesita;
- detalle holds sólo con habitación seleccionada y tab pertinente;
- retry local;
- conservar datos anteriores durante refetch cuando sea seguro;
- invalidar sólo recursos afectados después de mutación;
- no hard reload;
- no convertir error de auditoría en fallo de detalle;
- evitar carrera: respuesta de rango anterior no debe reemplazar rango actual.

## 18. Estados de UI obligatorios

### Loading inicial

- header y tabs visibles;
- toolbar skeleton;
- filas/cards skeleton;
- no mostrar contadores cero como datos reales.

### Error de inventario

- panel local `No se pudo cargar el inventario`;
- botón Reintentar;
- Disponibilidad puede seguir usándose si su endpoint funciona;
- no renderizar resumen falso.

### Empty real

- sin habitaciones en hotel: mensaje administrativo y `Nueva habitación` sólo
  con `rooms.write`;
- filtro sin resultados: `No hay coincidencias`; ofrecer limpiar filtros;
- disponibilidad sin resultados: mensaje específico de fechas;
- planner sin bookings: no afirmar disponibilidad comercial;
- bloqueos vacíos: `No hay bloqueos en este rango`.

### Refresh

- `Actualizando…`;
- impedir múltiples refresh;
- mantener datos previos;
- anunciar éxito de manera `aria-live="polite"` sin toast excesivo.

### Mutaciones

- loading específico por acción;
- evitar deshabilitar toda la página;
- éxito con resultado concreto;
- error conserva contexto, selección y formulario;
- no usar sólo toast si el usuario necesita corregir un campo.

## 19. Accesibilidad

Obligatorio:

- headings con jerarquía coherente;
- tabs con semántica y teclado;
- filtros con labels accesibles;
- chips como botones con `aria-pressed`;
- checkboxes con número de habitación;
- checkbox `Seleccionar visibles` refleja checked/indeterminate correctamente;
- fila clickeable también operable con teclado o contiene botón explícito;
- menú de acciones con nombre `Acciones de habitación {number}`;
- no usar `div` clickeable;
- foco visible;
- target mínimo 44 x 44 px;
- estado y holds con texto además de color;
- contraste WCAG AA;
- reduced motion;
- timeline con alternativa mobile/textual;
- Sheet conserva focus trap, Escape y retorno de foco;
- confirmaciones destructivas accesibles;
- errores asociados a sus campos;
- date picker usable con teclado;
- no depender de hover o `title` para información esencial.

## 20. Lenguaje y microcopy

Todos los textos visibles deben usar español consistente y tildes:

- `Habitación`, no `Habitacion`;
- `Gestión`, no `Gestion`;
- `Acción`, no `Accion`;
- `Selección`, no `seleccion`;
- `Más`, no `mas`;
- `Compacta`, no `Grid`;
- `Bloqueos`, no `holds`, salvo documentación técnica;
- `Planificador`, no `Planner` en UI;
- `Mantenimiento`, no `Maintenance` en UI.

No modificar valores del contrato TypeScript/backend; traducir sólo presentación.

## 21. Densidad y CSS

Objetivos:

- eliminar sección de prioridades grande;
- eliminar stat cards duplicadas;
- una toolbar compacta;
- filas de inventario de 56 a 72 px;
- cards compactas de máximo aproximado 150 px si se usa vista compacta;
- no repetir `rounded-3xl` y `shadow-2xl` en cada nivel;
- spacing principal de 16 a 24 px;
- no agregar CSS global si Tailwind resuelve;
- no aumentar significativamente `frontend/src/index.css`;
- no crear componentes superiores a 400 líneas sin justificación;
- dividir `RoomsPage.tsx` y `RoomAdminSheet.tsx` por responsabilidad;
- no crear un sistema genérico para todos los módulos en este ticket.

## 22. Componentes propuestos

Nombres orientativos; responsabilidades obligatorias.

### Workspace

- `RoomsWorkspace.tsx`: layout y tabs.
- `RoomsWorkspaceTabs.tsx`: navegación accesible.
- `RoomsPage.tsx`: queries, mutations, permisos y coordinación.

### Inventario

- `RoomsInventoryPanel.tsx`: toolbar + lista + detalle.
- `RoomsInventoryToolbar.tsx`: search, chips y display mode.
- `RoomCompactList.tsx` / `RoomCompactItem.tsx`.
- reutilizar `DataTable` para tabla, evitando buscador duplicado.
- `RoomBulkActionBar.tsx`.

### Detalle

- `RoomDetailWorkspace.tsx`: cuerpo compartido.
- `RoomDetailTabs.tsx`.
- `RoomSummaryPanel.tsx`.
- `RoomOperationsPanel.tsx`.
- `RoomConfigurationPanel.tsx`.
- `RoomHoldsPanel.tsx`.
- `RoomDetailSheet.tsx`: contenedor responsive, no segunda implementación.

### Disponibilidad

- adaptar `AvailabilityPicker.tsx` para submit explícito.
- `RoomAvailabilityPanel.tsx`.
- `RoomAvailabilityResults.tsx`.

### Planificador y bloqueos

- adaptar `RoomInventoryPlanner.tsx`.
- adaptar `RoomHoldsBoardPanel.tsx`.
- agregar presentación mobile explícita.

### Reutilizar

- `RoomFormFields.tsx`;
- `BookingDrawer.tsx`;
- `RoomCreateDrawer.tsx`;
- `AuditTimeline.tsx`;
- helpers `roomPresentation.tsx` y `roomHoldPresentation.tsx`;
- primitives UI actuales;
- `useResourceQuery`.

### Evitar

- duplicar detalle desktop/mobile;
- duplicar formularios create/edit;
- lógica de transición dispersa en JSX;
- un nuevo componente monolítico;
- nueva librería de estado o tabla;
- helpers que repliquen reglas backend sin test.

## 23. Archivos previstos

Modificar:

- `frontend/src/features/rooms/RoomsPage.tsx`
- `frontend/src/features/rooms/services/roomService.ts`
- `frontend/src/features/rooms/components/AvailabilityPicker.tsx`
- `frontend/src/features/rooms/components/RoomAdminSheet.tsx` o reemplazo
  incremental
- `frontend/src/features/rooms/components/RoomActionsMenu.tsx`
- `frontend/src/features/rooms/components/RoomInventoryPlanner.tsx`
- `frontend/src/features/rooms/components/RoomHoldsBoardPanel.tsx`
- tests del segmento
- E2E de Habitaciones

Posibles nuevos:

- componentes descritos en sección 22;
- `frontend/e2e/rooms-role-smoke.spec.ts`;
- `docs/validation/wf-016-rooms-inventory-workspace-evidence-YYYY-MM-DD.md`.

Modificar sólo si un test lo exige:

- `frontend/src/App.guards.test.tsx`;
- `frontend/src/components/ui/data-table.tsx`;
- `frontend/src/components/ui/sheet.tsx`.

No modificar:

- backend Rust;
- migraciones;
- `backend/openapi.yaml`;
- `docs/openapi.yaml`;
- cliente OpenAPI generado;
- canon RBAC ni capabilities generadas;
- Housekeeping;
- Recepción;
- Dashboard;
- Reportes;
- Red Global;
- layout general;
- `index.css` salvo necesidad mínima documentada.

## 24. Implementación incremental obligatoria

Máximo ocho pasos:

1. Crear tests de caracterización de inventario, permisos, reserva, estados y
   holds; registrar baseline.
2. Separar queries `inventoryRooms` y `availableRooms` sin cambiar layout.
3. Crear tabs y mover cada sección a su vista con carga diferida.
4. Implementar Inventario compacto, filtros, tabla y acciones masivas válidas.
5. Extraer detalle compartido con tabs internas y responsive sheet/inline.
6. Completar Disponibilidad aislada y reserva con fechas.
7. Adaptar Planificador/Bloqueos desktop-mobile, accesibilidad y errores parciales.
8. Ejecutar suites, Playwright, gates, review y evidencia.

Después de cada paso:

- ejecutar tests focalizados;
- registrar PASS/FAIL;
- corregir antes de avanzar;
- revisar `git diff --stat` para evitar scope creep.

## 25. Criterios de aceptación

### Navegación

- `AC-01`: existen exactamente cuatro tabs principales en el orden definido.
- `AC-02`: Inventario es default.
- `AC-03`: cambiar tab no requiere scroll a anchors.
- `AC-04`: tab state es local y no crea rutas/query params.

### Separación de datos

- `AC-05`: Inventario usa exclusivamente `/rooms`.
- `AC-06`: Disponibilidad usa exclusivamente `/rooms/available` tras submit.
- `AC-07`: buscar fechas no cambia contadores, selección ni lista de Inventario.
- `AC-08`: planner/holds no cargan antes de abrir su vista.
- `AC-09`: errores de una vista no inutilizan las demás.
- `AC-10`: respuestas tardías de un rango anterior no reemplazan el actual.

### Inventario

- `AC-11`: search encuentra número, tipo y estado traducido.
- `AC-12`: chips muestran conteos del inventario completo.
- `AC-13`: Limpieza agrupa Dirty + Cleaning sin perder estado exacto.
- `AC-14`: existe selector Compacta/Tabla dentro de Inventario.
- `AC-15`: toolbar no duplica buscadores.
- `AC-16`: seleccionar detalle y selección masiva son estados independientes.
- `AC-17`: desktop >=1280 conserva lista y detalle simultáneos.
- `AC-18`: <1280 usa el mismo cuerpo dentro de sheet.
- `AC-19`: sin selección existe estado instructivo.
- `AC-20`: no permanecen grandes bloques/stat cards duplicados.

### Acciones masivas

- `AC-21`: sólo aparecen con `rooms.status.write`.
- `AC-22`: Available sólo admite Cleaning/Available.
- `AC-23`: Dirty sólo admite Occupied/Dirty.
- `AC-24`: Maintenance bloquea el lote.
- `AC-25`: lote mixto inválido no envía request.
- `AC-26`: confirmación muestra cantidad, destino y desglose.
- `AC-27`: doble click no genera doble POST.
- `AC-28`: error conserva selección.
- `AC-29`: éxito limpia selección y refresca inventario.

### Detalle

- `AC-30`: tabs internas se filtran por capability.
- `AC-31`: Resumen nunca contiene controles no autorizados.
- `AC-32`: Operación no ofrece transición rechazada por backend.
- `AC-33`: Maintenance remite a Housekeeping sin mutación local.
- `AC-34`: Configuración advierte cambios sin guardar.
- `AC-35`: Bloqueos separa lectura y mutación por capability.
- `AC-36`: liberar hold exige confirmación.
- `AC-37`: auditoría carga sólo con capability/tab activa.
- `AC-38`: mutación exitosa actualiza detalle, lista y auditoría pertinente.

### Disponibilidad

- `AC-39`: fechas parciales no disparan búsqueda.
- `AC-40`: elegir rango no duplica request con submit.
- `AC-41`: salida debe ser posterior a entrada.
- `AC-42`: resultado muestra rango, noches y cantidad.
- `AC-43`: Reservar sólo aparece con `bookings.write`.
- `AC-44`: BookingDrawer recibe habitación y fechas correctas.
- `AC-45`: error/empty/loading son locales.

### Planificador y bloqueos

- `AC-46`: planner muestra siete días.
- `AC-47`: no presenta pisos como dato contractual inferido.
- `AC-48`: mobile usa selector de día + lista.
- `AC-49`: reservas y holds no dependen sólo del color.
- `AC-50`: fallo de bookings no oculta holds/habitaciones.
- `AC-51`: fallo de holds no oculta bookings/habitaciones.
- `AC-52`: rango de Bloqueos valida máximo 31 días.
- `AC-53`: timeline sólo tiene overflow interno.
- `AC-54`: mobile Bloqueos usa lista, no timeline ancha obligatoria.

### RBAC

- `AC-55`: admin conserva todas las operaciones actuales.
- `AC-56`: ops no puede crear/editar habitación ni holds.
- `AC-57`: ops puede cambiar estados válidos.
- `AC-58`: receptionist sólo consulta/reserva.
- `AC-59`: housekeeping y saas_admin continúan sin acceso a `/rooms`.
- `AC-60`: no se modifica canon RBAC.

### Accesibilidad y responsive

- `AC-61`: tabs funcionan con teclado.
- `AC-62`: filtros exponen estado pressed.
- `AC-63`: select-all expone indeterminate.
- `AC-64`: cada menú tiene nombre con número de habitación.
- `AC-65`: estado/holds usan texto además de color.
- `AC-66`: sheet devuelve foco al trigger.
- `AC-67`: targets mínimos 44 x 44 px.
- `AC-68`: no hay overflow de página a 375, 390, 430, 768, 1024, 1280 y
  1440 px.

### Calidad

- `AC-69`: UI visible usa español consistente y tildes.
- `AC-70`: ningún componente nuevo supera 400 líneas sin justificación.
- `AC-71`: no se agregan dependencias.
- `AC-72`: no cambian backend, OpenAPI ni API v1.
- `AC-73`: tests, Playwright y gates quedan verdes.

## 26. Tests unitarios obligatorios

No existe una cobertura focalizada suficiente hoy. Crear tests antes de extraer
comportamiento.

### `RoomsPage.test.tsx`

Cubrir:

1. carga `/rooms` inicial;
2. no carga disponibilidad, planner ni holds anticipadamente;
3. tabs visibles según `rooms.read`;
4. `Nueva habitación` sólo con `rooms.write`;
5. refresh de inventario;
6. error inicial y retry;
7. error de inventario no rompe Disponibilidad;
8. reserva exitosa invalida recursos pertinentes;
9. traducciones visibles;
10. no renderiza bloques landing eliminados.

### `RoomsInventoryPanel.test.tsx`

Cubrir:

1. búsqueda por número;
2. búsqueda por tipo;
3. búsqueda por `limpieza`;
4. filtro y conteos;
5. Compacta/Tabla;
6. detalle vs checkbox no se mezclan;
7. seleccionar visibles;
8. estado indeterminate;
9. selección fuera del filtro;
10. room desaparecida tras refetch.

### `RoomBulkActionBar.test.tsx`

Cubrir matriz completa:

1. Cleaning -> Available;
2. Available -> Available no-op permitido;
3. Occupied -> Dirty;
4. Dirty -> Dirty no-op permitido;
5. Occupied no puede Available;
6. Cleaning no puede Dirty;
7. Maintenance bloquea;
8. lote mixto bloquea;
9. confirmación;
10. submit único;
11. éxito;
12. error conserva selección.

### `RoomDetailWorkspace.test.tsx`

Cubrir:

1. tabs por capability;
2. CTA Reservar;
3. transiciones válidas;
4. Maintenance read-only;
5. form dirty y confirmación de salida;
6. create/edit/delete hold;
7. delete confirmado;
8. error de holds local;
9. auditoría condicional;
10. refresh posterior a mutaciones.

### `RoomAvailabilityPanel.test.tsx`

Cubrir:

1. rango incompleto;
2. rango inválido;
3. submit único;
4. params exactos;
5. loading;
6. empty;
7. error/retry;
8. resultados aislados;
9. drawer con fechas;
10. limpiar no afecta inventario.

### `RoomInventoryPlanner.test.tsx`

Cubrir:

1. siete días;
2. orden por número;
3. reserva activa;
4. hold activo;
5. precedence visual no oculta información;
6. errores parciales;
7. mobile day selector;
8. sin inferencia contractual de piso.

### `RoomHoldsBoardPanel.test.tsx`

Cubrir:

1. default 30 días;
2. end > start;
3. máximo 31;
4. filtro tipo;
5. filtro habitación;
6. read-only por capability;
7. timeline desktop;
8. lista mobile;
9. empty/error/retry;
10. selección y gestión.

### Guards/regresión

- admin/ops/receptionist acceden según capability;
- housekeeping/saas_admin no acceden;
- `RoomCreateDrawer` sigue creando;
- `RoomFormFields` conserva validaciones;
- `BookingDrawer` sigue recibiendo fechas;
- estados de mantenimiento siguen resolviéndose desde Housekeeping;
- OpenAPI client/contract permanece alineado.

## 27. Playwright/E2E obligatorio

Crear `frontend/e2e/rooms-role-smoke.spec.ts`.

No agregar secretos. Reusar harness de autenticación por rol y variables E2E.

Escenarios mínimos:

1. admin abre `/rooms`, ve Inventario activo y cuatro tabs;
2. búsqueda/filtro encuentra una habitación determinista;
3. selección abre detalle inline en 1440 px;
4. detalle abre sheet a 1024/390 px;
5. admin ve Configuración y Bloqueos mutables;
6. ops no ve creación/configuración/gestión de holds;
7. ops selecciona transición masiva válida y confirma;
8. lote inválido no envía request;
9. receptionist ve Disponibilidad y puede abrir reserva;
10. elegir rango no dispara request hasta Buscar;
11. disponibilidad no cambia contador de Inventario;
12. Planificador carga al abrirse, no antes;
13. Bloqueos valida rango >31 días;
14. Maintenance dirige a Housekeeping sin mutación local;
15. error interceptado de disponibilidad mantiene Inventario usable;
16. error interceptado de holds mantiene planner parcial;
17. tabs funcionan con teclado;
18. mobile 390 px sin overflow de página;
19. planner mobile usa día/lista;
20. cerrar detalle devuelve foco.

Capturas obligatorias:

- Inventario desktop 1440 x 900;
- Inventario tablet 1024 x 768;
- Inventario mobile 390 x 844;
- Disponibilidad con resultados;
- Planificador desktop/mobile;
- Bloqueos desktop/mobile;
- detalle admin y detalle receptionist.

Usar datos deterministas o documentar seed y IDs.

## 28. Comandos exactos de validación

### Baseline

```bash
git status --short
git log -5 --oneline --decorate
docker compose exec -T frontend npm run test -- --run src/App.guards.test.tsx
docker compose exec -T frontend npm run build
```

### Focalizados

```bash
docker compose exec -T frontend npm run test -- --run src/features/rooms/RoomsPage.test.tsx
docker compose exec -T frontend npm run test -- --run src/features/rooms/components/RoomsInventoryPanel.test.tsx
docker compose exec -T frontend npm run test -- --run src/features/rooms/components/RoomBulkActionBar.test.tsx
docker compose exec -T frontend npm run test -- --run src/features/rooms/components/RoomDetailWorkspace.test.tsx
docker compose exec -T frontend npm run test -- --run src/features/rooms/components/RoomAvailabilityPanel.test.tsx
docker compose exec -T frontend npm run test -- --run src/features/rooms/components/RoomInventoryPlanner.test.tsx
docker compose exec -T frontend npm run test -- --run src/features/rooms/components/RoomHoldsBoardPanel.test.tsx
```

Si Gate 0 cambia nombres, documentar mapeo uno a uno. No omitir cobertura.

### Frontend completo

```bash
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm run test -- --run
docker compose exec -T frontend npm run build
```

### Playwright

```bash
docker compose exec -T frontend npx playwright test e2e/rooms-role-smoke.spec.ts --project=chromium
```

Usar harness equivalente si ése es el estándar efectivo del repositorio y
registrar el comando exacto.

### Contrato y recorridos

```bash
./scripts/check-openapi-alignment.sh
./scripts/qa-core-journeys.sh
```

### Gate final

```bash
./scripts/gate.sh
```

Registrar exit code y PASS/FAIL por comando. Un fallo de infraestructura sigue
siendo FAIL hasta reejecución verde. No borrar evidencia del fallo inicial.

## 29. Evidencia obligatoria

Crear:

`docs/validation/wf-016-rooms-inventory-workspace-evidence-YYYY-MM-DD.md`

Contenido mínimo:

- branch;
- SHA base y final;
- estado Git inicial/final;
- archivos modificados;
- cambios por archivo;
- AC-01 a AC-73 con evidencia;
- comandos, exit codes y resultados;
- cantidad de tests;
- escenarios Playwright;
- viewports/capturas;
- requests que prueban carga diferida;
- matriz de transiciones probada;
- matriz RBAC probada;
- fallos encontrados y resolución;
- review Critical/High/Medium/Low;
- performance y seguridad;
- riesgos residuales;
- DoD completa;
- confirmación de API/OpenAPI/RBAC sin cambios.

## 30. Review estricto obligatorio

### Critical

- mutación sin capability;
- transición masiva aplicada a habitación incorrecta;
- contaminación cross-tenant por cache/ID;
- reserva creada con habitación o fechas diferentes;
- eliminación de hold sin confirmación o sobre otro roomId;
- API v1/RBAC modificado accidentalmente.

### High

- búsqueda de disponibilidad reemplaza inventario;
- lote parcialmente válido llega a backend;
- doble POST de estado/hold/reserva;
- Maintenance editable fuera de Housekeeping;
- detalle desktop/mobile diverge;
- planner revela huésped sin bookings.read;
- error de una vista derriba todas;
- consultas de planner/holds siempre activas;
- selección invisible persiste y se aplica por error.

### Medium

- tabs sin teclado;
- timeline sin alternativa mobile;
- estado sólo por color;
- search/tabs pierden foco;
- texto sin tildes o en inglés;
- cards/scroll excesivos;
- loading presenta cero como real;
- cambio de tab pierde form sin advertencia.

### Low

- spacing/radios inconsistentes;
- animación innecesaria;
- iconografía redundante;
- detalles cosméticos sin impacto.

## 31. Qué rompería producción

- operar estado sobre selección oculta por filtros;
- marcar Available una habitación Occupied;
- enviar Dirty desde Cleaning;
- permitir resolver Maintenance fuera de Housekeeping;
- reservar resultado viejo después de cambiar fechas;
- mostrar inventario disponible como resumen total;
- mezclar respuestas de rangos por una carrera;
- borrar un hold sin identificar habitación y rango;
- exponer motivo de hold en telemetría;
- usar prefijo de número como piso contractual;
- montar cientos de columnas por un rango sin límite;
- cargar bookings/holds repetidamente;
- perder cambios de tarifa al cerrar sheet;
- abrir dos implementaciones diferentes del detalle;
- romper el focus trap o retorno de foco.

## 32. Performance

Objetivos verificables:

- una consulta `/rooms` inicial;
- cero `/rooms/available` antes de submit;
- cero planner bookings/hold board antes del tab correspondiente;
- máximo una consulta por recurso/rango no cacheado;
- sin duplicación por `onSelect` + submit;
- lista filtrada memorizada razonablemente;
- no hacer `find/filter` de bookings por habitación y día de forma cuadrática
  para inventarios grandes si puede preindexarse;
- no montar timeline desktop en mobile;
- límite 31 días en Bloqueos;
- no agregar dependencias;
- no cargar auditoría hasta solicitarla;
- mutaciones invalidan sólo keys relacionadas.

Registrar conteo de requests en Playwright.

## 33. Seguridad y privacidad

- capabilities antes de render y antes de handler;
- backend autoridad final;
- query keys y cache no deben sobrevivir cambio de tenant sin invalidación;
- no telemetría con huésped, motivo de hold, tarifa modificada o roomId si no es
  necesario;
- no secretos E2E;
- no HTML sin sanitizar;
- no rutas construidas desde texto libre;
- no localStorage con inventario/holds;
- confirmación para liberar hold y acciones masivas;
- mensaje backend seguro, sin stack traces;
- no ampliar defaults inseguros fuera de local.

## 34. Fuera de alcance definitivo

- implementación de WF-015;
- Housekeeping/mantenimiento;
- Recepción;
- calendario general;
- mapa físico por piso;
- nuevas entidades de habitación;
- fotos/amenities;
- tarifas avanzadas;
- drag and drop;
- cambio de habitación de una reserva;
- overbooking;
- acciones masivas nuevas;
- borrar habitaciones;
- realtime/WebSocket;
- exportación;
- configuración persistente de vistas;
- sistema de diseño global;
- refactor general de DataTable/Sheet;
- backend, migraciones, OpenAPI o RBAC.

## 35. Definition of Done

- [ ] Gate 0 entregado antes de editar.
- [ ] Rama limpia `feature/wf-016-rooms-inventory-workspace`.
- [ ] Cuatro tabs implementados.
- [ ] Inventario default.
- [ ] Inventario y disponibilidad usan colecciones separadas.
- [ ] Carga diferida verificada.
- [ ] Toolbar compacta y contadores reales.
- [ ] Compacta/Tabla sin búsqueda duplicada.
- [ ] Selección detalle y masiva separadas.
- [ ] Acciones masivas respetan matriz real.
- [ ] Confirmación y doble submit cubiertos.
- [ ] Detalle compartido desktop/sheet.
- [ ] Tabs internas por capability.
- [ ] Disponibilidad sólo busca por submit.
- [ ] Reserva recibe fechas correctas.
- [ ] Planificador desktop/mobile.
- [ ] Bloqueos máximo 31 días y alternativa mobile.
- [ ] No se infiere piso contractual.
- [ ] Textos en español con tildes.
- [ ] RBAC por capability verificado.
- [ ] No hay overflow en siete anchos.
- [ ] Accesibilidad por teclado verificada.
- [ ] Tests focalizados PASS.
- [ ] Suite frontend PASS.
- [ ] Lint PASS.
- [ ] Build PASS.
- [ ] Playwright PASS.
- [ ] OpenAPI alignment PASS.
- [ ] QA core journeys PASS.
- [ ] `./scripts/gate.sh` PASS.
- [ ] Review estricto completado.
- [ ] Evidencia creada.
- [ ] API/OpenAPI/RBAC sin cambios.
- [ ] Worktree final limpio o cambios propios delimitados.
- [ ] Commit sólo después de DoD y autorización.

## 36. Gate 0 esperado

La primera respuesta del agente implementador debe incluir:

### Resumen en cinco líneas

1. convertir Habitaciones en workspace de cuatro tareas;
2. separar inventario y disponibilidad;
3. implementar detalle progresivo y acciones seguras;
4. preservar RBAC/API v1 y cargar por demanda;
5. validar unitarios, Playwright y gates.

### Archivos

Lista exacta confirmada contra la base real.

### Pasos

Máximo ocho, siguiendo sección 24.

### Tests

Comandos exactos con `PENDIENTE`, luego `PASS` o `FAIL`.

No aceptar `mejorar cards`, `hacer responsive`, `refactorizar página` o `agregar
tests` sin comportamiento, archivos y comandos concretos.

## 37. Criterio final de éxito

WF-016 está terminado sólo si cada tarea tiene un espacio inequívoco; una
búsqueda comercial nunca altera el inventario operativo; el usuario puede
seleccionar y operar una habitación sin perder contexto; las acciones masivas no
pueden enviar transiciones inválidas; los permisos se respetan; planner y
bloqueos funcionan en desktop y mobile; y todos los gates tienen evidencia.

Una interfaz más bonita que conserve la página larga, las colecciones mezcladas,
las consultas anticipadas o las acciones inseguras no cumple este ticket.
