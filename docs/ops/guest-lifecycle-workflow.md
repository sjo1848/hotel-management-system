# Guest Lifecycle Workflow

## Objetivo
Definir el flujo operativo completo de HMS Elite desde la llegada de un huesped hasta su salida, con responsabilidades por rol, estados permitidos, pantallas necesarias y backlog priorizado.

Este documento es la fuente de reglas y transiciones del ciclo del huesped. La
jornada completa, los handoffs y la cobertura de cada usuario se definen en
[`user-workflows-v1.md`](user-workflows-v1.md).

## Alcance
- PMS hotelero operativo
- Flujo principal: recepcion, estadia, checkout, housekeeping
- Roles: recepcion, housekeeping, ops, admin
- Entidades centrales: huesped, reserva, habitacion

## Entidades y Rol en el Flujo

Los campos de esta seccion describen el modelo funcional objetivo. El alcance
persistido por API v1 se fija en la matriz siguiente; un campo objetivo que no
figure alli no debe asumirse disponible ni representarse como dato real en UI.

| Entidad | Campos persistidos V1 | Datos derivados/estructurados | Diferido |
| --- | --- | --- | --- |
| Huesped | `id`, `hotel_id`, `full_name`, `email`, `phone`, `created_at` | Contacto: email obligatorio y telefono opcional | Documento, preferencias e historial CRM consolidado |
| Reserva | `id`, `hotel_id`, `room_id`, `guest_id`, `guest_name`, `check_in`, `check_out`, `total_price_cents`, `status`, `operational_data` | Total calculado con tarifa base al crear; extras, cobros y evidencia operativa usan recursos tipados | Rate plans/tarifa nocturna explicita y notas libres generales |
| Habitacion | `id`, `hotel_id`, `room_number`, `room_type`, `status`, `price_cents` | Disponibilidad se calcula por fechas; holds e incidencias modelan restricciones y observaciones operativas | Amenidades y notas libres no estructuradas |

Decision V1: se priorizan datos con semantica, validacion y ciclo de vida claros.
No se agregan documento o preferencias hasta definir politica de identidad,
retencion, edicion y busqueda; tampoco se usa texto libre para reemplazar holds,
casos de mantenimiento o auditoria estructurada.

### Huesped
Es la identidad de la persona. No debe duplicarse por cada estadia.

Campos minimos:
- nombre completo
- email obligatorio y telefono opcional en V1
- documento y observaciones/preferencias como objetivo CRM posterior a V1

### Reserva
Es la unidad principal de operacion comercial.

Campos minimos:
- huesped
- habitacion
- check_in
- check_out
- estado
- tarifa
- extras
- total
- evidencia operativa tipada; observaciones libres quedan fuera de V1

### Habitacion
Es la unidad principal de inventario operativo.

Campos minimos:
- numero
- tipo
- tarifa base
- estado
- disponibilidad
- holds e incidencias estructuradas; notas libres quedan fuera de V1

## Estados y Transiciones

### Reserva
Estados:
- `Confirmed`
- `CheckedIn`
- `CheckedOut`
- `Cancelled`
- `NoShow`

Transiciones permitidas:
- `Confirmed -> CheckedIn`
- `CheckedIn -> CheckedOut`
- `Confirmed -> Cancelled`
- `Confirmed -> NoShow`

Transiciones restringidas:
- `CheckedIn -> Confirmed`: politica objetivo de override admin
- `CheckedOut -> CheckedIn`: politica objetivo de override admin con auditoria
- `Cancelled` y `NoShow` son terminales y no pueden reabrirse en V1

El permiso y enforcement backend especificos para estos overrides estan
pendientes. Tener `bookings.update` no debe interpretarse como autorizacion de
override.

### Habitacion
Estados:
- `Available`
- `Occupied`
- `Dirty`
- `Cleaning`
- `Maintenance`

Transiciones permitidas:
- `Available -> Occupied`
- `Occupied -> Dirty`
- `Dirty -> Cleaning`
- `Cleaning -> Available`
- `Dirty -> Maintenance`
- `Cleaning -> Maintenance`
- `Available -> Maintenance`
- `Maintenance -> Dirty`

Las transiciones hacia `Maintenance` requieren abrir un caso con motivo,
prioridad y responsable. La unica salida permitida es resolver el caso con
evidencia y volver a `Dirty`; nunca se libera inventario directamente desde
`Maintenance`.

Transiciones restringidas:
- `Dirty -> Occupied`
- `Maintenance -> Occupied`
- `Occupied -> Available` sin checkout o override admin

## Reglas de Negocio Criticas
- No permitir check-in si la habitacion no esta `Available`.
- No permitir dos reservas activas solapadas sobre la misma habitacion.
- No permitir checkout si la cuenta no esta cerrada, salvo politica explicita de saldo pendiente.
- No devolver una habitacion a `Available` sin pasar por limpieza, salvo override admin.
- Todo cambio critico debe quedar auditado con usuario, timestamp y accion.

## Flujo End-to-End

### 1. Llegadas del dia
Actor principal: recepcion

Objetivo:
- preparar la operacion de entrada

Acciones:
- ver reservas con check-in de hoy
- verificar habitacion asignada
- verificar estado de habitacion
- verificar garantia/saldo/pago
- identificar llegadas con excepciones
- registrar una ETA tardia con nota sin cambiar el estado `Confirmed`
- cancelar o marcar no-show con motivo cuando corresponda

Salida esperada:
- lista limpia de check-ins listos
- lista de casos bloqueados
- cancelaciones y no-shows auditados, con el inventario liberado

### 2. Llegada del huesped
Actor principal: recepcion

Escenarios:
- con reserva previa
- sin reserva (`walk-in`)

Acciones:
- buscar huesped por nombre, email, telefono, documento o reserva
- si existe reserva, abrirla
- si no existe, buscar huesped y crear `walk-in`

Salida esperada:
- una reserva activa lista para validacion previa al check-in

### 3. Validacion previa al check-in
Actor principal: recepcion

Validaciones obligatorias:
- reserva en `Confirmed`
- fechas coherentes
- datos minimos del huesped completos
- habitacion asignada
- habitacion en `Available`
- habitacion no bloqueada ni en `Maintenance`

Bloqueos:
- habitacion `Dirty`
- habitacion `Maintenance`
- reserva inconsistente
- datos minimos faltantes

Salida esperada:
- check-in habilitado o caso derivado

### 4. Check-in
Actor principal: recepcion

Acciones:
- confirmar identidad
- confirmar cantidad de huespedes
- confirmar fechas reales
- confirmar tarifa final
- registrar observaciones
- ejecutar check-in

Efectos de sistema:
- reserva `Confirmed -> CheckedIn`
- habitacion `Available -> Occupied`
- auditoria de accion
- timestamp real de entrada

### 5. Estadia
Actor principal: recepcion
Actores secundarios: housekeeping, ops, admin

Acciones sobre la reserva:
- agregar cargos extra
- extender o acortar estadia
- cambiar habitacion
- registrar incidencias
- consultar saldo
- emitir vista previa de cuenta

Acciones sobre la habitacion:
- ver estado actual
- ver salida estimada
- marcar necesidades operativas

Salida esperada:
- reserva actualizada y habitacion sincronizada

### 6. Cambio de habitacion
Actor principal: ops o admin
Actor solicitante: recepcion

Validaciones:
- nueva habitacion disponible
- nueva habitacion sin solapamiento

Efectos:
- la nueva habitacion pasa a `Occupied`
- la anterior pasa a `Dirty` cuando la estadia ya inicio
- la reserva mantiene continuidad
- auditoria obligatoria

### 7. Pre checkout
Actor principal: recepcion

Acciones:
- revisar noches reales
- revisar cargos extra
- revisar descuentos y ajustes
- revisar saldo pendiente
- definir metodo de pago

Salida esperada:
- cuenta final lista para cierre

### 8. Checkout
Actor principal: recepcion

Acciones:
- cobrar o registrar cierre financiero
- emitir/cerrar factura
- ejecutar checkout

Efectos de sistema:
- reserva `CheckedIn -> CheckedOut`
- habitacion `Occupied -> Dirty`
- auditoria de salida
- timestamp real de salida

### 9. Post salida
Actor principal: housekeeping

Acciones:
- tomar habitacion `Dirty`
- iniciar limpieza
- finalizar limpieza
- marcar incidencia si aplica

Efectos de sistema:
- `Dirty -> Cleaning -> Available`
- o `Dirty/Cleaning/Available -> Maintenance` con caso, prioridad y responsable
- al resolver: `Maintenance -> Dirty`, y luego limpieza normal antes de `Available`

Salida esperada:
- habitacion de nuevo en inventario vendible

## Flujo Especial: Walk-in
- buscar huesped existente
- si no existe, crear ficha rapida
- consultar habitaciones disponibles hoy
- seleccionar habitacion
- crear reserva inmediata
- ejecutar check-in

Objetivo:
- resolver en un flujo unico de front desk

## Flujo Especial: Checkout con saldo pendiente
Politica recomendada:
- default: bloquear
- opcion de negocio: permitir checkout con deuda marcada

Si se permite:
- registrar saldo pendiente explicitamente
- requerir rol con permiso
- auditoria obligatoria

## Responsabilidades por Rol

### Recepcion
Debe poder:
- buscar huesped
- crear `walk-in`
- crear reserva
- hacer check-in
- hacer check-out
- agregar cargos
- solicitar cambio de habitacion
- consultar balance

### Housekeeping
Debe poder:
- ver habitaciones sucias
- iniciar limpieza
- finalizar limpieza
- reportar incidencia con motivo y prioridad
- asignar responsable y derivar a mantenimiento
- resolver el caso con evidencia y devolver la habitacion a `Dirty`

### Ops
Debe poder:
- mover habitaciones
- reasignar una estadia cuando la politica lo permita
- corregir estados
- resolver conflictos operativos
- intervenir sobre inventario

### Admin
Debe poder:
- control total de inventario
- override de excepciones
- reportes
- auditoria
- configuracion operativa

## Pantallas Necesarias

### P0
- `Llegadas de hoy`
- `Walk-in / nueva reserva`
- `Detalle de reserva`
- `Check-in`
- `Cuenta y cargos`
- `Check-out`
- `Housekeeping board`
- `Habitaciones admin`

### P1
- `Detalle de huesped`
- `Cambio de habitacion`
- `Excepciones operativas`
- `Auditoria operativa`

### P2
- `Preferencias de huesped`
- `Bloqueos operativos`
- `Promesas de pago / saldo pendiente`

## Definicion de Cada Pantalla

### Llegadas de hoy
Debe mostrar:
- huesped
- reserva
- habitacion
- estado de habitacion
- saldo/garantia
- CTA `Check-in`

### Walk-in / nueva reserva
Debe permitir:
- buscar o crear huesped
- elegir fechas
- ver disponibilidad
- asignar habitacion
- fijar tarifa
- confirmar

### Detalle de reserva
Debe ser el centro del flujo.

Debe permitir:
- ver estado
- ver huesped
- ver habitacion
- editar fechas
- agregar cargos
- cambiar habitacion
- iniciar check-in/check-out

### Check-in
Debe ser corto y seguro.

Debe validar:
- identidad
- datos minimos
- habitacion lista
- condiciones comerciales

### Cuenta y cargos
Debe permitir:
- agregar extras
- ver subtotal
- ver impuestos
- ver pagos
- ver saldo

### Check-out
Debe mostrar:
- total alojamiento
- extras
- impuestos
- pagos
- saldo final
- accion final de cierre

### Housekeeping board
Debe agrupar:
- `Dirty`
- `Cleaning`
- `Maintenance`
- `Available`

Cada habitacion `Maintenance` debe mostrar caso, prioridad, motivo y responsable;
el contador de bloqueos incluye esos casos aunque no tengan salida ese dia.

### Habitaciones admin
Debe permitir:
- editar inventario
- cambiar estado
- ver disponibilidad
- ver tarifa
- ver detalle operativo

## Backlog Priorizado

### P0 Operacion real
1. Llegadas de hoy con CTA de check-in
2. Walk-in unificado
3. Detalle de reserva como pantalla central
4. Check-in formal
5. Checkout formal
6. Cuenta y cargos extra
7. Housekeeping board con transiciones completas

### P1 Control operativo
1. Cambio de habitacion
2. Excepciones operativas
3. Auditoria por entidad
4. Checkout con saldo pendiente gobernado
5. Historial de estadias por huesped

### P2 Madurez
1. Preferencias de huesped
2. Bloqueos operativos y fuera de servicio
3. Politicas comerciales avanzadas
4. Reglas de override por rol

## Criterios de Aceptacion Operativos
- un huesped con reserva puede entrar en menos de 2 minutos
- un `walk-in` puede resolverse en un flujo unico
- toda salida deja habitacion en `Dirty`
- housekeeping puede devolver una habitacion a `Available` sin ambiguedad
- toda excepcion critica queda auditada

## Recomendacion de Producto
- eje comercial: `reserva`
- eje operativo: `habitacion`
- eje relacional: `huesped`

El staff debe trabajar sobre la reserva, mientras el sistema sincroniza habitacion y huesped de forma consistente.
