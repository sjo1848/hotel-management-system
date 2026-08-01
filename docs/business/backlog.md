# HMS Elite — Backlog Ejecutivo y Operativo

Fecha de referencia: 2026-08-01

## Cerrado tecnicamente al 2026-08-01

- planner de habitaciones y ocupacion futura
- front desk, check-in, checkout, caja y housekeeping como flujo continuo
- excepciones de cancelacion, no-show, late arrival y mantenimiento
- auditoria visible y contratos V1 alineados
- pricing, onboarding, entregables, soporte y materiales comerciales como baseline

Evidencia tecnica:
- [workflows canonicos](../ops/user-workflows-v1.md)
- [evidencia de gates](../validation/gate-evidence-2026-07-31.md)

## P0 — Tiene impacto directo en venta o implementacion

### Validacion / Operacion
- ejecutar QA manual completo por rol y ancho
- validar los recorridos con un hotel objetivo y registrar defectos observados
- estabilizar staging con dataset de demo reproducible
- ejecutar un simulacro de onboarding y go-live con owners definidos

### Comercial / Delivery
- validar pricing y disposicion de pago con prospectos reales
- confirmar que onboarding, entregables y soporte son sostenibles en una implementacion
- convertir la baseline de SLA en compromiso contractual solo con capacidad operativa aprobada

## P1 — Mejora conversion, adopcion y escalabilidad

### Producto
- reportes mas ejecutivos y exportables
- dashboard HQ mas comercial
- acciones masivas mas ricas sobre inventario
- optimizaciones del planner respaldadas por feedback de usuarios

### Operacion
- observabilidad y alertas de staging
- E2E visual de recorridos criticos en un entorno estable
- plan de rollback y recuperacion ensayado

### Comercial
- deck comercial
- comparativa vs PMS legacy
- propuesta de ROI por segmento

## P2 — Expansion

- onboarding enterprise multi-hotel
- feature flags comerciales por plan
- soporte premium y TAM/CSM
- reporting financiero avanzado

## Backlog por owner

### CEO / Comercial
- pricing
- narrativa de valor
- politica de descuentos
- materiales de venta

### Product / Operaciones
- onboarding
- soporte
- entregables
- playbook de go-live

### Engineering
- defectos surgidos de validacion real
- staging, observabilidad y automatizacion
- performance medida sobre volumen representativo

## Regla de priorizacion

Ordenar siempre por:
1. impacto en venta
2. impacto en implementacion real
3. impacto en operacion diaria del hotel
4. costo tecnico

## Definition of Ready

Una tarea entra a sprint cuando tiene:
- objetivo claro
- owner
- criterio de aceptacion
- impacto esperado
- dependencia explicitada

## Definition of Done

Una tarea sale de sprint cuando tiene:
- evidencia PASS/FAIL
- documentacion minima actualizada
- sin ambiguedad operativa para el usuario final
