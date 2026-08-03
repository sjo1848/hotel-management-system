# WF-015 — Centro de Control del Hotel

Fecha: 2026-08-02
Producto: HMS Elite
Área: Dashboard principal (`/`)
Estado: plan detallado; implementación no iniciada
Audiencia de implementación: siguiente agente Codex

## 1. Mandato para el siguiente agente

Actuá como Principal Engineer, Product Designer, QA Lead y Security Engineer.
Implementá WF-015 respetando arquitectura existente, RBAC, API v1, feature
flags, accesibilidad y todos los gates del repositorio.

Este documento es una especificación ejecutable. Si la implementación necesita
apartarse de una decisión marcada como obligatoria, detenerse antes de ampliar
el alcance, registrar la razón y pedir autorización.

Antes de modificar archivos:

1. Leer este documento completo.
2. Leer [WF-014](wf-014-reception-workspace-plan-2026-08-01.md) para conservar
   el patrón de reducción de carga cognitiva, sin copiar componentes de
   Recepción dentro del Dashboard.
3. Ejecutar `git status --short` y `git log -5 --oneline --decorate`.
4. Confirmar que el trabajo activo de WF-014 fue preservado, cerrado o separado.
5. No comenzar WF-015 sobre un árbol sucio perteneciente a otro agente.
6. Crear `feature/wf-015-dashboard-control-center` desde la última base de
   integración autorizada y registrar su SHA exacto en Gate 0.
7. No usar `git reset`, `git checkout --`, `git clean` ni descartar cambios
   ajenos.
8. Ejecutar Gate 0 antes de editar código.

### Situación observada al redactar este plan

El 2026-08-02 el repositorio estaba en
`feature/wf-014-reception-workspace`, con implementación de WF-014 activa y
cambios locales sin cerrar. Ese estado no es una base válida para iniciar este
ticket. Por esa razón este documento no fija un commit base futuro: el agente
debe usar el último commit aprobado después de preservar o cerrar WF-014.

WF-015 no depende funcionalmente de terminar el rediseño de Recepción. La espera
es una precaución de Git y propiedad de cambios, no una dependencia de producto.

## 2. Decisión de producto

El Dashboard debe dejar de ser una landing page formada por tarjetas, gráficos,
alertas y tablas apiladas. Debe convertirse en un centro de control que responda
en menos de cinco segundos:

1. ¿Cómo está el hotel ahora?
2. ¿Qué necesita atención primero?
3. ¿A qué módulo debo ir para resolverlo?

Nombre visible recomendado: `Centro de control`.

Subtítulo recomendado: `Pulso operativo y rendimiento del hotel`.

La solución elegida tiene dos vistas:

- `Operación`: estado actual, prioridades y caja del turno.
- `Rendimiento`: indicadores económicos y tendencias históricas.

La vista inicial obligatoria es `Operación`.

El Dashboard sirve para detectar, priorizar y navegar. No debe duplicar los
workflows completos de Recepción, Housekeeping, Habitaciones o Reportes.

## 3. Alcance exacto

Incluido:

- ruta principal `/` cuando el usuario posee `analytics.kpis.read`;
- composición y presentación de `DashboardHome`;
- separación entre operación y rendimiento;
- carga independiente por dominio de datos;
- prioridades accionables;
- resumen operativo compacto;
- resumen de caja y cierre de turno existente;
- gráficos de ingresos y ocupación;
- responsive desktop, tablet y mobile;
- estados loading, partial error, full error, empty y stale;
- accesibilidad de tabs, prioridades, métricas y gráficos;
- telemetría existente y nueva sólo cuando sea necesaria;
- tests unitarios y Playwright del Dashboard.

No incluido:

- rediseño de Recepción;
- rediseño de Housekeeping;
- rediseño de Habitaciones;
- rediseño de Reportes;
- rediseño de Red Global;
- un sistema de diseño global;
- nuevas métricas backend;
- cambios de API v1;
- nuevos roles o capacidades;
- personalización libre de widgets;
- drag and drop;
- persistencia de la vista elegida;
- comparación entre hoteles;
- forecasting o recomendaciones generadas por IA.

## 4. Usuarios y RBAC reales

No inventar variantes para roles que actualmente no acceden al Dashboard.

El enrutamiento vigente usa `analytics.kpis.read`:

- `admin`: accede al Dashboard.
- `ops`: accede al Dashboard.
- `receptionist`: es redirigido a `/bookings`.
- `housekeeping`: es redirigido a `/housekeeping`.
- `saas_admin`: es redirigido a `/network`.

WF-015 debe conservar esos redirects.

Dentro del Dashboard:

- leer KPIs sólo con `analytics.kpis.read`;
- mostrar balance sólo con `billing.balance.read`;
- mostrar el CTA de cierre sólo con `billing.close_cash.write`;
- permitir navegación a cada destino sólo si existe la capability requerida;
- no asumir que ocultar un botón reemplaza la autorización backend;
- no exponer importes en UI ni en telemetría a un rol sin permiso financiero.

Actualmente `admin` y `ops` poseen las capacidades financieras requeridas. Aun
así, implementar visibilidad por capability y no por nombre de rol para evitar
una regresión futura de RBAC.

## 5. Diagnóstico del Dashboard actual

La pantalla actual presenta, en una columna extensa:

1. título `Vista General`;
2. cuatro KPI cards grandes;
3. `Revenue Cockpit` con ADR, RevPAR, ocupación y tres prioridades;
4. `Automation & Alerts` con hasta tres tarjetas;
5. gráfico de ingresos;
6. gráfico de ocupación;
7. tarjeta grande de cierre de caja;
8. llegadas y salidas del día;
9. lista completa de últimas reservas;
10. editor de reserva en drawer.

Problemas concretos:

- parece una landing page comercial;
- requiere demasiado scroll;
- operación y análisis compiten por atención;
- ocupación aparece en más de un bloque;
- reservas se consultan y editan fuera del workspace de Recepción;
- cada sección usa tarjetas grandes, sombras fuertes y mucho espacio vertical;
- los indicadores de tendencia `12%` y `4%` están hardcodeados y no representan
  datos reales;
- términos como `Revenue Cockpit` y `Automation & Alerts` rompen consistencia de
  idioma;
- `Promise.all` agrupa KPIs, reportes y caja: el fallo de un gráfico puede
  inutilizar todo el Dashboard;
- reportes históricos se descargan aunque el usuario sólo necesita operación;
- `AlertItem` usa un `div` clickeable y un botón decorativo sin acción clara;
- los gráficos dependen principalmente de color y no tienen alternativa textual
  suficiente;
- el Dashboard duplica `BookingList` y `BookingEditDrawer`;
- `DashboardHomeView.tsx` concentra demasiadas responsabilidades;
- existe un atributo `size="sm"` duplicado en el botón de reintento que debe
  desaparecer al tocar ese bloque.

## 6. Resultado esperado

Un usuario `admin` u `ops` debe poder:

1. Entrar a `/` y reconocer el estado general en menos de cinco segundos.
2. Ver primero las excepciones que requieren intervención.
3. Distinguir operación actual de rendimiento histórico.
4. Navegar al módulo responsable con una acción inequívoca.
5. Conocer el estado de caja sin que domine toda la pantalla.
6. Cerrar caja usando el flujo actual, sin regresiones.
7. Consultar tendencias sólo cuando abre `Rendimiento`.
8. Seguir utilizando el Dashboard si falla caja o uno de los reportes.
9. Entender un gráfico con teclado o lector de pantalla.
10. Operar en mobile sin scroll horizontal ni CTAs fuera de pantalla.

## 7. Arquitectura de información definitiva

### 7.1 Header

Orden obligatorio:

1. título `Centro de control`;
2. subtítulo `Pulso operativo y rendimiento del hotel`;
3. fecha local visible;
4. estado de actualización: `Actualizado HH:mm`;
5. botón secundario `Actualizar` con icono y texto.

No agregar saludos decorativos, banners comerciales ni accesos rápidos globales.

La hora de actualización puede ser hora cliente registrada después de una carga
exitosa. No presentarla como hora de servidor.

### 7.2 Tabs principales

Usar dos tabs accesibles:

- `Operación`;
- `Rendimiento`.

Estado local en V1. No crear rutas ni query params.

La pestaña activa debe tener indicador visual que no dependa únicamente de
color. Implementar semántica `tablist`, `tab`, `tabpanel`, `aria-selected`,
`aria-controls` e IDs estables. Permitir `ArrowLeft`, `ArrowRight`, `Home` y
`End` si el primitive existente no lo resuelve.

### 7.3 Operación

Contiene únicamente:

- cola `Necesita atención`;
- bloque `Pulso del hotel`;
- resumen `Caja del turno`;
- estado de automatizaciones cuando el feature flag está habilitado.

No contiene gráficos históricos, BookingList ni editor de reservas.

### 7.4 Rendimiento

Contiene únicamente:

- KPIs económicos reales;
- selector de rango de reportes;
- tendencia de ingresos;
- tendencia de ocupación;
- enlace secundario `Abrir Reportes`, si el usuario tiene
  `reports.revenue.read`.

No contiene llegadas, salidas, caja ni lista de reservas.

## 8. Layout objetivo

### 8.1 Desktop ancho (`>= 1280px`)

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Centro de control                        Actualizado 10:42 [Actualizar]│
│ Pulso operativo y rendimiento del hotel                              │
├──────────────────────────────────────────────────────────────────────┤
│ [Operación] [Rendimiento]                                             │
├──────────────────────────────────────────┬───────────────────────────┤
│ Necesita atención                       │ Pulso del hotel            │
│                                          │ Ocupación       78%        │
│ ● 3 llegadas requieren preparación      │ Llegadas        12         │
│   Primera ventana 14:00  [Ir a recepción]│ Salidas          8         │
│ ● 4 habitaciones sucias [Housekeeping]  │ Reservas activas 63         │
│ ● Caja con cobros pendientes [Revisar]  ├───────────────────────────┤
│                                          │ Caja del turno             │
│                                          │ Total · efectivo · cobros  │
│                                          │ [Cerrar turno]              │
└──────────────────────────────────────────┴───────────────────────────┘
```

Reglas:

- contenedor principal con ancho máximo coherente con el layout global;
- columna izquierda entre 60% y 65%;
- columna derecha entre 35% y 40%;
- `Necesita atención` no debe superar seis elementos visibles;
- no anidar tarjetas dentro de tarjetas;
- la vista Operación debe caber idealmente en una pantalla y no superar una
  pantalla y media a 900 px de alto;
- sombras moderadas y radios coherentes con componentes compartidos.

### 8.2 Desktop/tablet (`768px` a `1279px`)

- tabs conservan ancho natural;
- `Necesita atención` ocupa ancho completo;
- `Pulso del hotel` y `Caja del turno` aparecen debajo en dos columnas cuando
  hay espacio;
- entre 768 y 899 px pueden apilarse;
- CTAs mantienen texto visible;
- no usar grids que generen columnas menores de 280 px.

### 8.3 Mobile (`375px`, `390px`, `430px`)

Orden obligatorio:

1. header compacto;
2. tabs con scroll horizontal sólo dentro del tablist si fuese necesario;
3. contador de prioridades críticas;
4. cola de prioridades;
5. pulso compacto en lista de pares etiqueta/valor;
6. caja colapsable o resumen compacto;
7. CTA correspondiente.

Reglas:

- sin scroll horizontal de página;
- target mínimo 44 x 44 px;
- CTA ancho completo dentro de cada prioridad;
- gráficos con altura mínima de 220 px;
- tooltips no pueden ser el único modo de leer valores;
- no usar hover como requisito de interacción.

## 9. Vista Operación

### 9.1 Cola `Necesita atención`

Unificar conceptualmente `dailyPriorities` y `automationInsights` en un modelo
de presentación, sin mezclar lógica de dominio dentro de JSX.

Modelo sugerido:

```ts
type DashboardPriority = {
  id: string;
  source: "operations" | "automation" | "cash";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  actionLabel: string;
  route?: string;
  action?: "navigate" | "close-cash";
};
```

Orden obligatorio:

1. `high`;
2. `medium`;
3. `low`;
4. para igual severidad, orden estable de negocio;
5. máximo seis elementos.

Cada fila muestra:

- indicador de severidad con icono y texto;
- título;
- explicación concreta;
- una acción;
- destino comprensible.

No usar solamente `high`, `medium`, `low` en inglés. Texto visible:

- `Crítica` o `Alta` según semántica elegida;
- `Media`;
- `Informativa`.

No inventar timestamps, SLA, monto perdido, ventana horaria ni datos que las
APIs actuales no exponen.

### 9.2 Estado estable

Si no hay prioridades reales:

- mostrar un solo estado compacto `Operación estable`;
- texto `No hay alertas operativas con los datos disponibles`;
- ofrecer como máximo un enlace secundario al calendario;
- no generar tres tarjetas verdes para llenar espacio.

### 9.3 Automatizaciones

Si `automation_alerts_enabled` es `false`:

- no mostrar una sección vacía;
- no presentar upsell dentro de Operación.

Si está habilitado:

- integrar alertas reales en la cola;
- respetar `pricing_assistant_enabled`;
- no etiquetar una regla determinística como IA;
- no afirmar que una recomendación es óptima;
- no mostrar mensajes comerciales sobre planes en el flujo crítico.

La información sobre disponibilidad de plan puede quedar como nota secundaria
en Rendimiento o eliminarse del Dashboard. No debe competir con una alerta.

### 9.4 Pulso del hotel

Máximo cuatro indicadores en V1, usando datos existentes:

- ocupación actual;
- llegadas de hoy;
- salidas de hoy;
- reservas activas.

Cada indicador debe incluir etiqueta, valor y contexto temporal. No usar flechas
de tendencia si no existe un cálculo real.

No repetir ADR, RevPAR ni ingresos aquí.

Los valores de llegadas y salidas deben derivarse de las listas actuales o del
campo contractual correspondiente de forma consistente. Agregar un test que
evite discrepancia entre contador y lista.

### 9.5 Caja del turno

Conservar `CashShiftCloseSheet` y su contrato.

El resumen compacto muestra:

- total acumulado;
- efectivo;
- tarjeta;
- cantidad de cobros;
- pendiente por cobrar y reservas abiertas;
- hora de apertura si existe.

CTA visible sólo con `billing.close_cash.write`:

- etiqueta `Cerrar turno`;
- deshabilitado durante submit;
- conservar validaciones de efectivo contado, handoff y notas;
- conservar toast, telemetría y refetch exitoso;
- no cerrar el sheet si la mutación falla;
- impedir doble envío.

Si balance falla, mostrar error local con `Reintentar caja`; no ocultar las
prioridades operativas ni convertirlo en fallo global.

## 10. Vista Rendimiento

### 10.1 KPIs

Mostrar cuatro KPIs reales:

- ingresos del mes;
- ocupación actual;
- ADR;
- RevPAR.

Reglas:

- formato monetario consistente `es-AR` y moneda definida por la configuración
  disponible; si no existe moneda de tenant, conservar ARS sin inventar selector;
- no mostrar porcentajes comparativos hardcodeados;
- no decir `vs mes pasado` sin consultar y calcular el periodo anterior;
- no mezclar el rango de los gráficos con KPIs cuyo contrato representa otro
  periodo;
- etiquetar explícitamente `Mes actual` o `Hoy` según el dato.

### 10.2 Rango

Selector segmentado:

- `7 días`;
- `30 días`.

Default: `30 días`.

El rango afecta únicamente `getRevenueReport(start, end)` y
`getOccupancyReport(start, end)`.

Calcular fechas en una utilidad testeable. Documentar que son fechas calendario
del cliente mientras API v1 no exponga timezone del hotel. No enviar timestamps
si el endpoint acepta fechas.

No incluir `Hoy`: un único punto no aporta una tendencia útil.

### 10.3 Carga diferida

No solicitar reportes históricos durante la carga inicial de `Operación`.

Al abrir `Rendimiento`:

1. cargar ingresos y ocupación;
2. cachear por rango;
3. mantener datos previos al cambiar rango mientras se refresca;
4. mostrar loading local en cada gráfico;
5. evitar duplicar solicitudes por re-render.

Puede usarse `useResourceQuery` con keys que incluyan el rango. No introducir
otra librería de estado.

### 10.4 Gráficos

Ingresos:

- area/line chart;
- eje X con fechas legibles;
- eje Y con formato monetario compacto;
- tooltip con fecha y valor completo.

Ocupación:

- bar o line chart;
- dominio 0 a 100;
- formato porcentual;
- no depender sólo de color para distinguir umbrales.

Cada gráfico debe incluir:

- título;
- rango visible;
- resumen textual accesible con mínimo, máximo y último valor;
- estado vacío;
- error y retry independientes;
- `aria-label` o descripción asociada;
- colores compatibles con tema claro y oscuro.

No crear tablas extensas debajo de cada gráfico en V1. Un resumen textual para
lector de pantalla es suficiente si comunica tendencia y extremos.

## 11. Estrategia de datos y errores parciales

No conservar un único `Promise.all` que colapse todo el Dashboard.

Separar al menos:

1. `dashboard:kpis`;
2. `dashboard:cash-balance`;
3. `dashboard:feature-flags`;
4. `dashboard:dirty-rooms`, condicionado por flag;
5. `dashboard:revenue:<start>:<end>`, condicionado por tab;
6. `dashboard:occupancy:<start>:<end>`, condicionado por tab.

Comportamiento:

- si KPIs falla, Operación muestra error principal y retry;
- si caja falla, sólo falla caja;
- si feature flags falla, ocultar automatizaciones y mantener base operativa;
- si dirty rooms falla, no fabricar contador cero como si fuese dato confirmado;
- si ingresos falla, ocupación sigue visible;
- si ocupación falla, ingresos sigue visible;
- `Actualizar` refresca las queries activas y disponibles;
- evitar hard reload;
- no borrar datos correctos por un error posterior si el hook permite conservar
  estado previo.

Registrar errores sin incluir datos sensibles, nombres de huéspedes o montos
innecesarios.

## 12. Navegación y acciones

Destinos permitidos con APIs/rutas existentes:

- prioridades de llegadas/salidas: `/bookings`;
- inventario u ocupación baja: `/rooms`;
- habitaciones sucias: `/housekeeping`;
- tendencia o RevPAR: `/reports`;
- operación estable: `/calendar`.

Antes de renderizar un CTA, verificar capability del destino:

- `/bookings`: `bookings.read`;
- `/rooms`: `rooms.read`;
- `/housekeeping`: `housekeeping.read`;
- `/reports`: `reports.revenue.read`;
- `/calendar`: `bookings.read`.

Si el usuario no posee el destino:

- conservar el mensaje informativo;
- no mostrar un CTA que terminará en `/forbidden`;
- no ampliar RBAC como parte de WF-015.

Eliminar del Dashboard:

- `BookingList`;
- `BookingEditDrawer`;
- `selectedBookingId`;
- `isDrawerOpen`;
- callbacks asociados.

Las reservas se resuelven en WF-014/Recepción. El Dashboard puede navegar a
`/bookings`, pero no editar una reserva localmente.

## 13. Estados de UI obligatorios

### Loading inicial

- header y tabs visibles;
- skeleton de cola y pulso;
- skeleton local de caja;
- no renderizar valores `0` como si fuesen datos cargados;
- no mostrar simultáneamente skeleton y error.

### Error principal

- mensaje `No se pudo cargar el pulso operativo`;
- explicación breve;
- botón `Reintentar`;
- foco gestionado si el error aparece después de una acción del usuario;
- no ocultar caja si caja cargó correctamente.

### Error parcial

- contenido correcto permanece visible;
- cada bloque fallido tiene retry local;
- no repetir múltiples banners globales.

### Empty

- operación sin alertas: estado estable compacto;
- reportes sin puntos: `No hay datos para el rango seleccionado`;
- balance sin cobros: mostrar `$0` sólo después de carga exitosa y explicar
  `Todavía no hay cobros registrados en el turno`.

### Refresh

- botón anuncia `Actualizando…`;
- impedir múltiples refresh simultáneos;
- mantener contenido anterior;
- actualizar hora sólo después de éxito relevante;
- usar `aria-live="polite"` para el estado, sin anuncios repetitivos.

## 14. Accesibilidad

Obligatorio:

- un solo `h1` o heading principal coherente con el layout de la aplicación;
- jerarquía de headings sin saltos arbitrarios;
- tabs con teclado y semántica completa;
- prioridades implementadas como elementos semánticos, no `div` clickeables;
- botones con nombre accesible específico;
- foco visible;
- target mínimo 44 x 44 px;
- texto y iconos para severidad, no sólo color;
- contraste WCAG AA;
- `prefers-reduced-motion` respetado por animaciones existentes;
- gráficos con resumen textual;
- tooltips accesibles o no esenciales;
- sheet de caja conserva focus trap, Escape y retorno de foco;
- errores asociados a retry y anunciados de forma moderada;
- no ocultar acciones únicamente mediante hover.

## 15. Responsive y densidad visual

Objetivos:

- reducir scroll vertical al menos de forma perceptible respecto del Dashboard
  actual;
- eliminar sombras `shadow-2xl` repetidas como jerarquía principal;
- evitar radios `rounded-3xl` indiscriminados;
- usar espaciado de 16 a 24 px entre bloques principales;
- usar filas compactas para prioridades;
- máximo cuatro KPIs simultáneos;
- no duplicar un mismo KPI en ambas vistas salvo que el contexto lo justifique;
- no agregar CSS global si Tailwind y primitives existentes resuelven el layout;
- no aumentar significativamente `frontend/src/index.css`.

Presupuesto orientativo:

- ningún componente nuevo superior a 350 líneas sin justificación;
- `DashboardHomeView.tsx` debe reducirse o dividirse por responsabilidades;
- evitar una abstracción genérica prematura para futuros segmentos;
- no crear más de una capa de wrappers visuales sin valor semántico.

## 16. Componentes propuestos

Los nombres pueden ajustarse, pero no las responsabilidades.

### Contenedor

- `DashboardHome.tsx`: queries, estado de tab/rango, mutaciones y navegación.
- `DashboardControlCenter.tsx`: composición visual de header, tabs y panels.

### Operación

- `DashboardOperationPanel.tsx`: layout de la vista Operación.
- `DashboardPriorityList.tsx`: lista ordenada accesible.
- `DashboardPriorityItem.tsx`: fila y CTA.
- `HotelPulseSummary.tsx`: cuatro indicadores compactos.
- `CashShiftSummary.tsx`: resumen y apertura de sheet.

### Rendimiento

- `DashboardPerformancePanel.tsx`: KPIs, rango y gráficos.
- `DashboardMetricStrip.tsx`: indicadores económicos sin tendencias falsas.
- `DashboardRangeSelector.tsx`: 7/30 días.
- `AccessibleMetricChart.tsx` o componentes específicos si una abstracción
  común no mejora claridad.

### Reutilizar

- `CashShiftCloseSheet.tsx`;
- `Button`, `Badge`, `Skeleton`, `Card` y primitives existentes;
- `useResourceQuery`;
- `trackUiEvent`;
- servicios existentes.

### Eliminar de la composición

- `BookingList`;
- `BookingEditDrawer`;
- `AlertItem` basado en `div` clickeable;
- `KPICard` con tendencia hardcodeada.

## 17. Archivos previstos

Confirmar lista exacta en Gate 0.

Modificar:

- `frontend/src/features/dashboard/DashboardHome.tsx`
- `frontend/src/features/dashboard/components/DashboardHomeView.tsx` o
  reemplazarlo de forma incremental
- `frontend/src/features/dashboard/DashboardHome.test.tsx`
- `frontend/e2e/core-journeys.spec.ts`

Posibles archivos nuevos:

- componentes bajo `frontend/src/features/dashboard/components/`
- tests colocados junto a cada componente
- `frontend/e2e/dashboard-role-smoke.spec.ts`
- utilidad de rango bajo `frontend/src/features/dashboard/`
- evidencia bajo `docs/validation/`

Modificar sólo si es estrictamente necesario:

- `frontend/src/features/dashboard/components/CashShiftCloseSheet.tsx`
- `frontend/src/features/dashboard/services/analyticsService.ts`
- `frontend/src/layouts/DashboardLayout.tsx`

No se esperan cambios en:

- backend Rust;
- migraciones SQL;
- `backend/openapi.yaml`;
- `docs/openapi.yaml`;
- cliente OpenAPI generado;
- canon RBAC;
- `frontend/src/features/auth/capabilities.ts` generado;
- `HotelNetworkPage.tsx`;
- páginas de Recepción, Housekeeping, Habitaciones o Reportes;
- rutas principales de `App.tsx` salvo un ajuste de test no funcional.

Si parece necesario modificar backend, OpenAPI, roles o rutas, detenerse y pedir
ampliación de alcance.

## 18. Implementación incremental obligatoria

Máximo ocho pasos:

1. Crear tests de caracterización para cierre de caja, errores y redirects; dejar
   evidencia de baseline.
2. Separar queries de KPIs, caja, flags y reportes sin cambiar todavía el layout.
3. Crear tabs accesibles y vista Operación con cola priorizada y pulso compacto.
4. Extraer resumen de caja preservando completamente `CashShiftCloseSheet`.
5. Crear Rendimiento con rango 7/30, carga diferida y gráficos accesibles.
6. Eliminar BookingList/drawer, tendencias falsas y secciones duplicadas.
7. Completar responsive, errores parciales, accesibilidad y telemetría.
8. Ejecutar unitarios, Playwright, gates, review estricto y documento de
   evidencia.

Después de cada paso:

- ejecutar tests focalizados;
- registrar PASS/FAIL;
- corregir antes de avanzar;
- revisar que no aparezcan cambios fuera de alcance.

## 19. Criterios de aceptación

### Arquitectura de información

- `AC-01`: `/` muestra `Centro de control` para usuarios autorizados.
- `AC-02`: existen exactamente dos vistas: `Operación` y `Rendimiento`.
- `AC-03`: `Operación` es la vista inicial.
- `AC-04`: gráficos históricos sólo aparecen en `Rendimiento`.
- `AC-05`: caja y prioridades sólo aparecen en `Operación`.
- `AC-06`: no se renderiza `BookingList` ni `BookingEditDrawer` en Dashboard.

### Datos

- `AC-07`: KPIs y caja fallan de forma independiente.
- `AC-08`: ingresos y ocupación fallan de forma independiente.
- `AC-09`: reportes no se solicitan antes de abrir `Rendimiento`.
- `AC-10`: cambiar 7/30 días consulta fechas correctas y no duplica requests.
- `AC-11`: no existen porcentajes o comparaciones hardcodeados.
- `AC-12`: un valor cero sólo se muestra después de carga exitosa.
- `AC-13`: refresh conserva contenido anterior y actualiza hora tras éxito.

### Operación

- `AC-14`: prioridades se ordenan por severidad de forma estable.
- `AC-15`: se muestran como máximo seis prioridades.
- `AC-16`: cada prioridad posee como máximo una acción.
- `AC-17`: el estado sin prioridades es compacto y no comercial.
- `AC-18`: Pulso muestra como máximo cuatro indicadores no duplicados.
- `AC-19`: cierre de caja conserva validación, submit único, toast y refetch.
- `AC-20`: error de caja no impide consultar prioridades.

### Rendimiento

- `AC-21`: KPIs explican su periodo real.
- `AC-22`: rango default es 30 días.
- `AC-23`: cada gráfico tiene loading, empty, error y retry local.
- `AC-24`: cada gráfico expone resumen textual accesible.
- `AC-25`: `Abrir Reportes` sólo aparece con capability válida.

### RBAC

- `AC-26`: receptionist continúa redirigido a `/bookings`.
- `AC-27`: housekeeping continúa redirigido a `/housekeeping`.
- `AC-28`: saas_admin continúa redirigido a `/network`.
- `AC-29`: CTA financiero se controla por capability.
- `AC-30`: ningún CTA visible navega a un destino no autorizado.

### Responsive y accesibilidad

- `AC-31`: no hay scroll horizontal a 375, 390, 430, 768, 1024, 1280 y
  1440 px.
- `AC-32`: tabs funcionan con teclado y anuncian selección.
- `AC-33`: prioridades no dependen de hover.
- `AC-34`: severidad no depende sólo de color.
- `AC-35`: todos los targets interactivos miden al menos 44 x 44 px.
- `AC-36`: cerrar el sheet devuelve foco al CTA `Cerrar turno`.
- `AC-37`: la vista Operación no supera una pantalla y media a 1280 x 900 con
  datos normales.

### Calidad

- `AC-38`: ningún componente nuevo supera 350 líneas sin justificación escrita.
- `AC-39`: no se agregan dependencias frontend.
- `AC-40`: API v1, OpenAPI y canon RBAC permanecen sin cambios.
- `AC-41`: tests anteriores equivalentes se conservan o migran sin pérdida.
- `AC-42`: lint, tests, build, Playwright y gate final están verdes.

## 20. Tests unitarios requeridos

### Baseline y contenedor

Actualizar `DashboardHome.test.tsx` para cubrir:

1. carga inicial solicita KPIs y caja;
2. carga inicial no solicita reportes;
3. apertura de Rendimiento solicita ambos reportes;
4. refresh vuelve a consultar recursos activos;
5. fallo de KPIs no oculta caja válida;
6. fallo de caja no oculta operación válida;
7. cierre exitoso conserva request exacto, toast, telemetría y refetch;
8. cierre fallido conserva sheet abierto y permite reintentar;
9. submit doble no genera dos POST;
10. feature flags fallidos no rompen base operativa.

### `DashboardPriorityList.test.tsx`

Cubrir:

1. orden high/medium/low;
2. estabilidad dentro de igual severidad;
3. límite de seis;
4. estado estable;
5. una acción por fila;
6. destino correcto;
7. ausencia de CTA cuando falta capability;
8. interacción por teclado.

### `HotelPulseSummary.test.tsx`

Cubrir:

1. cuatro indicadores máximos;
2. etiquetas temporales;
3. cero posterior a carga;
4. sin flechas/tendencias ficticias;
5. contador de llegadas consistente con datos.

### `DashboardPerformancePanel.test.tsx`

Cubrir:

1. default 30 días;
2. cambio a 7 días;
3. fechas start/end exactas;
4. caching por rango;
5. fallo independiente de cada gráfico;
6. retry independiente;
7. empty state;
8. resumen accesible mínimo/máximo/último;
9. labels de periodo en KPIs;
10. no comparación hardcodeada.

### Tabs y RBAC

Cubrir:

1. semántica tablist/tab/tabpanel;
2. navegación con flechas/Home/End;
3. panel inactivo no expuesto como contenido activo;
4. redirects existentes en `App.guards.test.tsx` siguen verdes;
5. capacidades de destinos filtran CTAs.

### Regresión obligatoria

No eliminar sin equivalente:

- `refreshes dashboard data after close cash without hard reload`;
- retry del Dashboard;
- evento `dashboard_load_failed`;
- `close_cash_success`;
- `close_cash_failure`;
- recorrido de Revenue/priority CTA, adaptado a los nuevos textos;
- guards de receptionist, housekeeping y saas_admin.

## 21. Playwright/E2E requerido

Crear preferentemente `frontend/e2e/dashboard-role-smoke.spec.ts` para no inflar
`core-journeys.spec.ts`. Reusar autenticación segura existente; no agregar
secretos ni ampliar el fallback `admin123` fuera de local.

Escenarios mínimos:

1. admin abre `/` y ve `Centro de control` + tab `Operación` activo;
2. Operación muestra `Necesita atención`, `Pulso del hotel` y caja;
3. CTA de una prioridad navega a un módulo permitido;
4. `Rendimiento` carga al activarse y muestra rango 30 días;
5. selector cambia a 7 días sin recarga completa;
6. cierre de caja abre sheet, valida campos y puede cancelarse;
7. mock/intercepción de error de caja mantiene prioridades visibles;
8. mock/intercepción de error de ingresos mantiene ocupación visible;
9. navegación de tabs funciona con teclado;
10. receptionist que llega a `/` termina en `/bookings`;
11. housekeeping que llega a `/` termina en `/housekeeping`;
12. saas_admin que llega a `/` termina en `/network`;
13. mobile 390 px no tiene overflow horizontal;
14. desktop 1280 x 900 mantiene la vista Operación dentro del límite acordado.

Validar capturas en:

- 390 x 844;
- 768 x 1024;
- 1280 x 900;
- 1440 x 900.

Las capturas deben usar datos deterministas o documentar exactamente el seed.

## 22. Comandos exactos de validación

Registrar PASS/FAIL individual. No agrupar resultados ambiguos.

### Baseline

```bash
git status --short
git log -5 --oneline --decorate
docker compose exec -T frontend npm run test -- --run frontend/src/features/dashboard/DashboardHome.test.tsx
```

Si Vitest dentro del contenedor interpreta rutas desde `/app`, usar la ruta
relativa real confirmada por `pwd`, por ejemplo:

```bash
docker compose exec -T frontend npm run test -- --run src/features/dashboard/DashboardHome.test.tsx
```

### Tests focalizados finales

```bash
docker compose exec -T frontend npm run test -- --run src/features/dashboard/DashboardHome.test.tsx
docker compose exec -T frontend npm run test -- --run src/features/dashboard/components/DashboardPriorityList.test.tsx
docker compose exec -T frontend npm run test -- --run src/features/dashboard/components/HotelPulseSummary.test.tsx
docker compose exec -T frontend npm run test -- --run src/features/dashboard/components/DashboardPerformancePanel.test.tsx
docker compose exec -T frontend npm run test -- --run src/App.guards.test.tsx
```

Adaptar nombres sólo si Gate 0 documentó componentes equivalentes.

### Frontend completo

```bash
docker compose exec -T frontend npm run lint
docker compose exec -T frontend npm run test -- --run
docker compose exec -T frontend npm run build
```

### Playwright

```bash
docker compose exec -T frontend npx playwright test e2e/dashboard-role-smoke.spec.ts --project=chromium
```

Si Playwright se ejecuta mediante el harness del repositorio, registrar el
comando equivalente exacto y no ocultar el cambio.

### Contrato y recorridos

```bash
./scripts/check-openapi-alignment.sh
./scripts/qa-core-journeys.sh
```

### Gate final

```bash
./scripts/gate.sh
```

Si un comando falla por infraestructura:

1. registrar `FAIL`;
2. guardar salida relevante;
3. corregir o estabilizar el entorno;
4. reejecutar;
5. registrar el PASS posterior sin borrar el fallo inicial.

## 23. Evidencia obligatoria

Crear:

`docs/validation/wf-015-dashboard-control-center-evidence-YYYY-MM-DD.md`

Debe contener:

- branch y SHA base;
- SHA final;
- `git status --short` inicial y final;
- archivos modificados;
- cambios por archivo;
- criterios AC-01 a AC-42 con evidencia;
- comandos exactos;
- PASS/FAIL y exit code;
- cantidad de tests;
- escenarios Playwright ejecutados;
- viewport y rutas de capturas;
- errores encontrados y resolución;
- revisión Critical/High/Medium/Low;
- performance y seguridad;
- riesgos residuales;
- DoD firmada;
- confirmación de que API/OpenAPI/RBAC no cambiaron.

No escribir `PASS` sin comando o evidencia observable.

## 24. Review estricto obligatorio

### Critical

- cierre de caja ejecutable sin capability;
- doble cierre o doble POST;
- datos financieros expuestos a rol no autorizado;
- navegación que opera sobre hotel/tenant incorrecto;
- modificación accidental de API v1, OpenAPI o RBAC.

### High

- fallo de un reporte inutiliza toda Operación;
- valores ficticios presentados como reales;
- reportes cargados siempre pese a estar fuera de vista;
- cierre exitoso no refresca balance;
- CTA visible dirige sistemáticamente a `/forbidden`;
- mobile impide cerrar caja o navegar prioridades;
- se pierden tests de seguridad o caja existentes.

### Medium

- tab sin teclado;
- gráficos sin alternativa textual;
- severidad dependiente sólo de color;
- duplicación de KPIs;
- loading muestra cero engañoso;
- exceso de scroll o cards anidadas;
- términos visibles sin traducir.

### Low

- microcopy inconsistente;
- spacing o radios levemente divergentes;
- animación innecesaria;
- detalles cosméticos sin impacto operativo.

## 25. Qué rompería producción

- permitir cerrar caja dos veces por doble submit;
- esconder una diferencia o cobro pendiente al compactar caja;
- mostrar balance de otro tenant por key de cache incompleta;
- usar hora cliente como si fuese hora contable del servidor;
- navegar a módulos sin capability y bloquear al operador;
- convertir un fallo de reporte en caída total del home;
- etiquetar reglas simples como predicción confiable;
- mostrar porcentajes falsos y provocar decisiones comerciales incorrectas;
- disparar múltiples reportes por cada render o cambio rápido de tab;
- eliminar redirects de roles especializados;
- reintroducir edición de reservas duplicada fuera de Recepción;
- perder focus trap o retorno de foco del cierre de caja.

## 26. Performance

Objetivos verificables:

- Operación no solicita `/reports/revenue` ni `/reports/occupancy` antes de abrir
  Rendimiento;
- una apertura de Rendimiento dispara como máximo una consulta por reporte y
  rango no cacheado;
- cambiar de tab no duplica requests cacheadas dentro del stale time;
- gráficos no se remountan por callbacks inestables sin necesidad;
- no agregar dependencias;
- build no incrementa de forma material por duplicar Recharts u otra librería;
- lista de prioridades limitada a seis nodos visibles;
- evitar `BookingList` y su carga adicional en Dashboard.

Registrar requests en Playwright o DevTools para probar carga diferida.

## 27. Seguridad y privacidad

- UI financiera controlada por capability;
- backend continúa siendo autoridad final;
- no registrar nombres de huéspedes, notas de handoff ni montos contados en
  telemetría nueva;
- conservar manejo seguro de errores;
- no agregar credenciales E2E al repositorio;
- `admin123`, `dev-secret` o cookies inseguras sólo pueden existir en harness
  local explícito, nunca como default de producción;
- no interpolar rutas desde datos externos;
- no usar HTML sin sanitizar;
- no almacenar balance o handoff en localStorage;
- no enviar requests financieros al usuario sin capability.

## 28. Fuera de alcance

- implementar WF-014;
- modificar `HotelNetworkPage`;
- dashboard para receptionist;
- dashboard para housekeeping;
- dashboard para saas_admin;
- preferencias persistentes por usuario;
- reordenamiento de widgets;
- comparación multi-hotel;
- alertas push;
- notificaciones en tiempo real por WebSocket;
- forecast de demanda;
- recomendaciones de IA;
- nuevas fórmulas ADR/RevPAR;
- currency selector;
- timezone de hotel nuevo en API;
- drill-down dentro de gráficos;
- exportación desde Dashboard;
- sistema de diseño global;
- refactor general de `DashboardLayout` o `index.css`;
- cambios backend/OpenAPI/RBAC.

## 29. Definition of Done

- [ ] Gate 0 publicado antes de editar.
- [ ] Branch `feature/wf-015-dashboard-control-center` creada desde base limpia.
- [ ] No se descartaron cambios de WF-014 ni de otro agente.
- [ ] Dos tabs accesibles implementados.
- [ ] Operación es vista inicial.
- [ ] Cola priorizada limitada a seis.
- [ ] Pulso compacto sin KPIs duplicados.
- [ ] Caja compacta conserva el flujo completo.
- [ ] Rendimiento carga sólo al abrirse.
- [ ] Rango 7/30 funciona con fechas testeadas.
- [ ] No quedan tendencias hardcodeadas.
- [ ] BookingList y BookingEditDrawer salen del Dashboard.
- [ ] Errores parciales preservan contenido sano.
- [ ] RBAC y redirects preservados.
- [ ] Mobile/tablet/desktop verificados.
- [ ] Accesibilidad por teclado verificada.
- [ ] Gráficos tienen resumen textual.
- [ ] Tests focalizados PASS.
- [ ] Suite frontend PASS.
- [ ] Lint PASS.
- [ ] Build PASS.
- [ ] Playwright PASS.
- [ ] OpenAPI alignment PASS.
- [ ] QA core journeys PASS.
- [ ] `./scripts/gate.sh` PASS.
- [ ] Review Critical/High/Medium/Low completado.
- [ ] Performance y seguridad revisadas.
- [ ] Evidencia creada con comandos y resultados.
- [ ] Worktree final limpio o cambios propios claramente delimitados.
- [ ] Commit intencional creado sólo después de autorización correspondiente.

## 30. Gate 0 esperado del agente implementador

La primera respuesta del agente debe contener exactamente estas categorías.

### Resumen en cinco líneas

1. convertir Dashboard en Centro de control;
2. separar Operación y Rendimiento;
3. independizar queries y errores;
4. preservar caja, RBAC y API v1;
5. validar unitarios, Playwright y gates.

### Archivos

Lista concreta confirmada después de inspeccionar el estado real.

### Pasos

Máximo ocho, basados en la sección 18.

### Tests

Comandos exactos con estado inicial `PENDIENTE`, luego `PASS` o `FAIL`.

No aceptar como Gate 0 frases genéricas como `mejorar componentes`, `hacerlo
responsive` o `agregar tests` sin nombres, responsabilidades y comandos.

## 31. Criterio final de éxito

WF-015 está terminado sólo si un usuario autorizado puede abrir `/`, comprender
el estado del hotel y encontrar la primera acción en menos de cinco segundos;
puede cambiar a Rendimiento sin haber pagado el costo de sus reportes durante la
carga inicial; puede cerrar caja sin regresiones; puede usar la pantalla con
teclado y en mobile; y toda afirmación numérica visible proviene de datos reales.

Una interfaz visualmente más atractiva que mantenga contenido duplicado,
tendencias ficticias, fallos globales o workflows copiados no cumple este ticket.
