# Guest Lifecycle P0 Roadmap

## Objetivo
Traducir el flujo operativo del huesped a un plan P0 ejecutable para HMS Elite, con tickets concretos, dependencias, criterios de aceptacion y orden recomendado de implementacion.

## Principio Rector
No implementar pantallas aisladas. El eje del flujo P0 debe ser `reserva`, con `habitacion` como inventario operativo sincronizado y `huesped` como contexto relacional.

## Resultado Esperado del P0
Al finalizar este bloque, el hotel debe poder:
- recibir llegadas del dia
- registrar `walk-in`
- hacer check-in
- agregar cargos durante la estadia
- hacer check-out
- pasar la habitacion a limpieza
- devolver la habitacion al inventario

## Secuencia Recomendada
1. Centro operativo de reserva
2. Llegadas del dia
3. Walk-in y nueva reserva
4. Check-in
5. Cuenta y cargos
6. Check-out
7. Housekeeping board

## Tickets P0

### P0-01 `Detalle de reserva como centro operativo`
Objetivo:
- convertir la reserva en la pantalla central de trabajo para recepcion

Alcance:
- encabezado con estado
- huesped asociado
- habitacion asociada
- fechas
- tarifa base
- resumen financiero
- observaciones
- timeline simple de acciones
- CTAs visibles para `check-in`, `check-out`, `agregar cargo`, `cambiar habitacion`

No incluye:
- facturacion avanzada
- auditoria completa

Dependencias:
- ninguna

Criterios de aceptacion:
- desde una reserva se puede entender el estado comercial y operativo sin navegar a otra pantalla
- los CTAs criticos estan visibles y contextuales
- la pantalla refleja consistentemente estado de reserva y habitacion

Impacto:
- maximo

### P0-02 `Llegadas de hoy`
Objetivo:
- darle a recepcion una bandeja operativa para entradas del dia

Alcance:
- listado de reservas con check-in hoy
- filtros basicos
- estado de habitacion visible
- alertas de bloqueo operativo
- CTA directo a `check-in`
- CTA a `detalle de reserva`

No incluye:
- reglas avanzadas de priorizacion

Dependencias:
- P0-01

Criterios de aceptacion:
- recepcion puede ver en una sola vista todas las llegadas del dia
- una llegada bloqueada se distingue claramente de una lista para entrar
- desde la lista se llega al flujo de check-in en un clic

Impacto:
- muy alto

### P0-03 `Walk-in / nueva reserva unificada`
Objetivo:
- resolver huesped sin reserva en un solo flujo de front desk

Alcance:
- busqueda de huesped existente
- alta rapida de huesped si no existe
- seleccion de fechas
- disponibilidad
- asignacion de habitacion
- confirmacion de reserva
- opcion de continuar a check-in

No incluye:
- promociones complejas
- politicas tarifarias avanzadas

Dependencias:
- P0-01

Criterios de aceptacion:
- un `walk-in` puede resolverse sin salir del flujo
- no se duplica huesped si ya existe
- al confirmar se crea una reserva utilizable inmediatamente

Impacto:
- muy alto

### P0-04 `Check-in formal`
Objetivo:
- convertir la entrada del huesped en una transicion segura y auditable

Alcance:
- validacion previa obligatoria
- formulario minimo de confirmacion
- bloqueo si la habitacion no esta `Available`
- bloqueo si faltan datos minimos
- cambio de estado `Confirmed -> CheckedIn`
- cambio de habitacion `Available -> Occupied`

No incluye:
- overrides complejos

Dependencias:
- P0-01
- P0-02 o P0-03

Criterios de aceptacion:
- no se puede ejecutar check-in con habitacion sucia o en mantenimiento
- al finalizar, reserva y habitacion quedan sincronizadas
- el usuario ve claramente por que un check-in fue bloqueado

Impacto:
- maximo

### P0-05 `Cuenta y cargos extra`
Objetivo:
- sostener la estadia y preparar un checkout correcto

Alcance:
- listado de cargos por reserva
- agregar cargo manual
- subtotal alojamiento
- subtotal extras
- total acumulado
- estado financiero simple

No incluye:
- facturacion fiscal completa
- multiples medios de pago complejos

Dependencias:
- P0-01

Criterios de aceptacion:
- durante la estadia se pueden agregar cargos sin salir de la reserva
- el resumen financiero se actualiza en tiempo real
- recepcion puede llegar al checkout con cuenta clara

Impacto:
- muy alto

### P0-06 `Checkout formal`
Objetivo:
- cerrar la estadia y liberar la habitacion al flujo de limpieza

Alcance:
- resumen final
- validacion de saldo
- politica de bloqueo por deuda o deuda permitida explicitamente
- cambio de estado `CheckedIn -> CheckedOut`
- cambio de habitacion `Occupied -> Dirty`
- cierre visible del flujo

No incluye:
- reglas avanzadas de cobranza posterior

Dependencias:
- P0-01
- P0-05

Criterios de aceptacion:
- no se puede cerrar la estadia sin reglas claras sobre saldo
- la habitacion siempre sale de checkout en `Dirty`
- recepcion termina el flujo con confirmacion visible

Impacto:
- maximo

### P0-07 `Housekeeping board`
Objetivo:
- cerrar el ciclo operativo de la habitacion despues del checkout

Alcance:
- tablero por estado `Dirty`, `Cleaning`, `Available`, `Maintenance`
- transiciones `Dirty -> Cleaning -> Available`
- opcion de derivar a mantenimiento
- foco en salidas del dia

No incluye:
- planificacion avanzada por camarera o turno

Dependencias:
- P0-06

Criterios de aceptacion:
- housekeeping puede ver rapido que habitaciones quedaron para limpiar
- una habitacion solo vuelve a inventario cuando finaliza limpieza
- si se detecta problema, puede marcarse `Maintenance`

Impacto:
- muy alto

## Dependencias Resumidas
- P0-01 desbloquea casi todo
- P0-02 y P0-03 alimentan entradas
- P0-04 habilita ocupacion real
- P0-05 sostiene estadia y alimenta checkout
- P0-06 dispara housekeeping
- P0-07 cierra el ciclo del inventario

## Orden de Implementacion Recomendado

### Sprint P0-A
- P0-01 `Detalle de reserva`
- P0-02 `Llegadas de hoy`
- P0-04 `Check-in formal`

Objetivo:
- recepcion puede gestionar una llegada real

### Sprint P0-B
- P0-03 `Walk-in / nueva reserva`
- P0-05 `Cuenta y cargos`
- P0-06 `Checkout formal`

Objetivo:
- recepcion cubre entrada, estadia y salida

### Sprint P0-C
- P0-07 `Housekeeping board`

Objetivo:
- habitacion completa su ciclo operativo

## Riesgos que hay que evitar
- construir `habitaciones` antes que `detalle de reserva`
- mezclar check-in y alta de huesped sin validaciones claras
- permitir checkout sin sincronizar estado de habitacion
- agregar reportes antes de cerrar el flujo operativo base
- duplicar logica entre recepcion y habitaciones

## Criterios de Done del Bloque P0
- un huesped con reserva puede ingresar sin friccion
- un `walk-in` puede resolverse en flujo unico
- durante la estadia se pueden registrar cargos
- el checkout cambia el estado correcto de reserva y habitacion
- housekeeping puede devolver la habitacion a inventario
- no hay transiciones inconsistentes entre `reserva` y `habitacion`

## Recomendacion Final
Si solo se pudiera empezar por un ticket, el primero debe ser:
- `P0-01 Detalle de reserva como centro operativo`

Es la mejor inversion porque absorbe check-in, cargos, cambio de habitacion y checkout sin dispersar la UX en modulos desconectados.
