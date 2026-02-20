# ADR-0003: Contrato Único FE/BE para Capabilities y Error Envelope

- Fecha: `2026-02-14 21:10:33 -0300`
- Estado: Aceptado

## Contexto
Se detectó riesgo alto de drift entre frontend y backend en capacidades RBAC y parsing de errores. Aunque existe verificación de drift RBAC, faltaba cerrar la decisión arquitectónica para declarar una única fuente contractual para capabilities y errores, con gobernanza explícita de cambios.

## Decisión
1. Capabilities:
   - Backend (`rbac.rs`) se mantiene como fuente normativa de capabilities por rol.
   - Frontend (`capabilities.ts`) se mantiene como espejo tipado para UX/guards.
   - Todo cambio de capabilities requiere ejecutar y pasar `scripts/check-rbac-drift.sh`.
2. Error envelope:
   - Se adopta envelope estándar para errores API:
     - `error_code`, `message`, `request_id`, `details`.
   - El catálogo contractual se mantiene en `docs/errors/error-codes-v1.md`.
   - Todo `error_code` nuevo en backend requiere documentación en catálogo v1 dentro del mismo PR.
3. Gates obligatorios:
   - Gate RBAC drift en CI.
   - Gate de gobernanza de errores/validación (`scripts/check-validation-governance.sh`).
4. Compatibilidad y rollout:
   - Cambios breaking en capabilities o envelope requieren nota explícita en `docs/api-changelog.md`.

## Tradeoffs
- Reduce bugs de autorización y discrepancias FE/BE.
- Mejora observabilidad y soporte (mismos códigos de error en todos los clientes).
- Incrementa disciplina de proceso en PRs de producto.

## Impacto y costo
- Impacto: Alto (seguridad + confiabilidad operativa).
- Costo: Bajo/Medio (gates y documentación, sin refactor masivo inmediato).

## Validación
- Ejecutar `scripts/check-rbac-drift.sh`.
- Ejecutar `scripts/check-validation-governance.sh`.
- Verificar actualización de `docs/api-changelog.md` cuando corresponda.

## Rollback
- Si un gate rompe por transición parcial, bloquear merge y mantener contrato previo hasta completar sincronización FE/BE y documentación.
