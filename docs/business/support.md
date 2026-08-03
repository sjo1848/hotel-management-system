# HMS Elite — Soporte y Escalamiento

Fecha de referencia: 2026-03-09

## Objetivo

Definir un modelo de soporte que se pueda prometer y cumplir.

## Canales

- email de soporte
- chat o WhatsApp operativo
- canal de emergencia para incidencias criticas

## Severidades

### Sev 1
Definicion:
- el hotel no puede operar
- login caido
- recepcion bloqueada
- caja inutilizable

Objetivo de respuesta:
- prioridad maxima dentro del objetivo del plan contratado

### Sev 2
Definicion:
- una parte importante del flujo falla, pero hay workaround

Objetivo de respuesta:
- mismo dia operativo

### Sev 3
Definicion:
- error menor, bug no bloqueante, ajuste funcional

Objetivo de respuesta:
- siguiente ventana operativa

### Sev 4
Definicion:
- mejora, duda o cambio cosmetico

Objetivo de respuesta:
- backlog normal

## Flujo de soporte

1. recibir incidente
2. clasificar severidad
3. confirmar impacto y workaround
4. asignar owner
5. comunicar estado
6. cerrar con evidencia

## Reglas

- no prometer SLA enterprise si todavia no existe operacion capaz de sostenerlo
- los tiempos aplicables son los de [sla-by-plan.md](sla-by-plan.md) y solo se vuelven contractuales cuando la propuesta los incorpora expresamente
- dejar siempre workaround si no hay fix inmediato
- cada incidente relevante debe terminar en bitacora

## Escalamiento interno

- soporte operativo
- engineering
- owner del cliente

## Salidas obligatorias

- incidente registrado
- decision tomada
- responsable asignado
- proximo paso claro
