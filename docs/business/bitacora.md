# HMS Elite — Bitacora Ejecutiva y Operativa

Objetivo:
- registrar hitos, decisiones y cambios visibles para negocio y delivery

Formato recomendado:
- fecha
- hito
- decision
- impacto
- proximo paso

## Entradas iniciales

### 2026-03-09
Hito:
- HMS Elite ya opera como PMS SaaS multi-hotel con front desk, habitaciones, housekeeping, caja y reportes en estado avanzado.

Decision:
- ordenar documentacion de negocio/operacion en un paquete estable y no seguir dependiendo de notas dispersas.

Impacto:
- mejora ventas, onboarding y handoff con cliente.

Proximo paso:
- usar este bloque como fuente de verdad para roadmap, pricing, soporte y entregables.

### 2026-03-09
Hito:
- se definio que el foco comercial inmediato no es agregar mas features aisladas, sino cerrar onboarding, pricing y soporte.

Decision:
- priorizar documentacion y proceso repetible antes de vender mas fuerte.

Impacto:
- baja riesgo de improvisacion en implementacion.

Proximo paso:
- completar pricing base y playbook de go-live con cliente real.

### 2026-03-10
Hito:
- HMS Elite quedo con paquete comercial por segmento, proceso comercial, propuestas base y casos de referencia.

Decision:
- fijar foco principal en hotel mediano y ejecutar una semana 1 orientada a validacion real, no a seguir abriendo scope.

Impacto:
- mejor direccion para producto, comercial y delivery.

Proximo paso:
- correr QA manual por rol y ancho, y cerrar defects puntuales antes de seguir puliendo o agregando features.

### 2026-08-01
Hito:
- se cerraron tecnicamente los workflows canonicos WF-001 a WF-012, incluidos cancelacion/no-show/late arrival, mantenimiento y alineacion del contrato V1.

Decision:
- dejar de tratar front desk, caja, housekeeping y planner como backlog abierto; el siguiente riesgo es validacion operativa real, staging y go-live repetible.

Impacto:
- los gates tecnicos quedaron verdes y el paquete comercial puede apoyarse en una cobertura funcional verificable, sin prometer aun SLA enterprise ni validacion de mercado.

Evidencia:
- commit tecnico `24eff0e024aaf1c00baa81d8caa358f0da533dc5`
- [workflows canonicos](../ops/user-workflows-v1.md)
- [Engineering Case Study](../ENGINEERING_CASE_STUDY.md)

Proximo paso:
- completar QA manual por rol y ancho, validar con un hotel objetivo y ejecutar staging/onboarding antes de ampliar alcance.

## Regla

La bitacora ejecutiva no reemplaza:
- el changelog tecnico
- la bitacora local en `archivos/`

Se complementan:
- `docs/business/bitacora.md`: hitos de negocio, delivery y operacion
- `archivos/`: evidencia tecnica y cierres de bloque
