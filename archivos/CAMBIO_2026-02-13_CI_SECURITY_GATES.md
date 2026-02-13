# Registro Breve de Cambio

Objetivo:  
Hacer explícitos en CI los quality gates de seguridad y frontend para que fallen por PR ante regresiones.

Contexto:  
Ya existían suites de seguridad backend (`rbac_authorization` y `csrf_authn_security`), pero faltaba visibilidad/gate explícito en workflow y faltaba `lint` frontend como paso formal.

Decisión:  
1. Se actualizó `.github/workflows/full-stack-ci.yml`.
2. Backend CI ahora ejecuta explícitamente:
   - `cargo test --test rbac_authorization`
   - `cargo test --test csrf_authn_security`
3. Frontend CI ahora ejecuta explícitamente:
   - `npm run lint`
   - `npm run test -- --run`
   - `npm run build`

Impacto:  
- Seguridad authz/csrf/authn queda como gate visible y obligatorio por PR.
- Frontend agrega gate de tipado/lint antes de tests/build.
- Reducción de riesgo de merges con regresiones de permisos o flujo de sesión.

Próximo paso:  
Abrir PR de validación y confirmar semáforo verde en GitHub Actions con evidencia (run URL + job logs) para cerrar el pendiente de CI en el checklist.
