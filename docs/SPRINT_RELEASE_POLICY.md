# Sprint Release Policy

## Regla operativa
Al cerrar cada sprint se debe ejecutar `commit + push` a `origin/main` en la misma sesión.

## Checklist mínimo de cierre
1. Validar backend: `cargo clippy -- -D warnings` y tests relevantes.
2. Actualizar documentación breve en `archivos/` usando formato:
   - `Objetivo`
   - `Contexto`
   - `Decisión`
   - `Impacto`
   - `Próximo paso`
3. Crear commit con prefijo `sprint:` y resumen técnico corto.
4. Hacer `git push origin main`.

## Nota de repositorio
`archivos/` está ignorado por Git en este repo; esa documentación queda local.
