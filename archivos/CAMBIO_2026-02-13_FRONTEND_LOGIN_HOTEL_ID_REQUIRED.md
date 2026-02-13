# Registro Breve de Cambio

Objetivo:  
Eliminar el fallback hardcodeado de `hotel_id` en login frontend para alinear autenticación tenant-aware con el contrato backend.

Contexto:  
Después del hardening de auth en backend, el endpoint `/auth/login` requiere `hotel_id` explícito. El frontend aún enviaba un valor por defecto del hotel central, manteniendo riesgo de acoplamiento y comportamiento ambiguo.

Decisión:  
1. Se removió `DEFAULT_HOTEL_ID` en `frontend/src/features/auth/authService.ts`.
2. `login(username, password, hotelId)` ahora exige `hotelId` explícito.
3. Se actualizó `AuthContext` para propagar la nueva firma.
4. Se añadió campo obligatorio `Hotel ID` en `frontend/src/features/auth/LoginPage.tsx`.
5. Se ajustaron tests de `authService` para validar envío explícito de `hotel_id`.

Impacto:  
- El frontend deja de depender del hotel central hardcodeado.
- El contrato de login queda consistente end-to-end con el modelo multi-tenant.
- Quality gates frontend validadas en Docker:
  - `docker compose exec frontend npm run lint` -> PASS
  - `docker compose exec frontend npm run test -- --run` -> PASS (12 tests)
  - `docker compose exec frontend npm run build` -> PASS

Próximo paso:  
Reemplazar ingreso manual de `hotel_id` por selector/descubrimiento de hotel para mejorar UX y reducir errores operativos.
