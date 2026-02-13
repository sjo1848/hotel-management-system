# Registro Breve de Cambio

Objetivo:  
Formalizar política de versionado/deprecación de API para cerrar deuda de gobernanza de contratos.

Contexto:  
El diagnóstico técnico marcaba como pendiente la ausencia de política explícita de versionado y deprecación de endpoints/campos API.

Decisión:  
1. Se creó `docs/API_VERSIONING_POLICY.md` con reglas de compatibilidad en `v1`.
2. Se definieron criterios de deprecación (ventana mínima, documentación, alternativa).
3. Se definió proceso para breaking changes (`/api/v2`, coexistencia y sunset).
4. Se fijaron reglas de estabilidad del contrato de errores (`error_code`, `message`, `request_id`, `details`).
5. Se enlazó la política desde `README.md` para visibilidad operativa.

Impacto:  
- Reduce ambigüedad en evolución de API y decisiones de breaking changes.
- Mejora previsibilidad para frontend e integraciones externas.
- Cierra pendiente de checklist sobre versión/deprecación documentada.

Próximo paso:  
Aplicar la política en cada cambio de contrato API actualizando `docs/openapi.yaml` y `docs/CHANGELOG.md` como parte del Definition of Done.
