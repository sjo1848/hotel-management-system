# HMS Elite: operaciones de producción

Este runbook es deliberadamente independiente del proveedor. Los comandos que conectan con almacenamiento externo, cifrado y migraciones se inyectan mediante variables revisadas por el operador; ningún script selecciona un vendor ni ejecuta provisionamiento.

## Backup, cifrado y retención

Antes de operar se inyectan `DB_USER` y, fuera de local, `ALLOW_DATABASE_OPERATIONS=true`. `scripts/backup.sh` crea un `pg_dump` comprimido, checksum SHA-256 y conserva por defecto 35 días (`BACKUP_RETENTION_DAYS`). Para cifrado se define `BACKUP_ENCRYPT_COMMAND`, que recibe `BACKUP_INPUT` y debe producir `BACKUP_OUTPUT`; para copia off-host se define `BACKUP_OFFSITE_COMMAND`, que recibe `BACKUP_INPUT`. El operador debe verificar que el destino sea durable, restringido, cifrado en tránsito/reposo y con retención/versionado equivalente.

Si el artefacto termina en `.enc`, `restore.sh` y `restore-drill.sh` requieren `BACKUP_DECRYPT_COMMAND`, con interfaz `BACKUP_INPUT`/`BACKUP_OUTPUT`; crean un archivo plaintext temporal bajo `umask 077` y lo eliminan al finalizar. Un decrypt ausente o sin salida válida detiene la operación.

Objetivo operativo: RPO <= 15 minutos (frecuencia de backup fuera de este script) y RTO <= 10 minutos para la restauración validada en el entorno objetivo. Son objetivos, no una garantía. `restore-drill.sh` mide el RTO, pero **no mide RPO real**: genera el backup inmediatamente antes de restaurar, por lo que reporta `rpo_seconds: NOT_MEASURED` y termina `INCONCLUSIVE` con código distinto de cero; el RPO debe calcularse con la cadencia y metadata del backup productivo.

## Secuencia de release

La secuencia obligatoria es: **build/version → backup → migración controlada → smoke → rollback de aplicación si falla**. En producción, deploy usa `docker-compose.prod.yml` como archivo standalone, incluido explícitamente también al ejecutar el backup; nunca mezcla el compose base de desarrollo. El rollback de aplicación vuelve al artefacto/ref anterior y no revierte automáticamente la base de datos.

1. Fijar la versión/commit y producir el artefacto build verificable.
2. Preparar backup verificable y copia off-host; registrar checksum. En producción debe inyectarse `BACKUP_DATABASE_URL` o `DATABASE_URL`; el fallback `docker compose ... db` es solo para dev. Para crear/recrear una base con URL se requiere además `DATABASE_ADMIN_URL` o `RESTORE_DATABASE_ADMIN_URL`, apuntando a una base administrativa.
3. Activar mantenimiento y, solo si se suministran `MIGRATION_COMMAND` y `MIGRATION_CONFIRMATION=APPLY-MIGRATIONS`, ejecutar la migración controlada con aprobación explícita. Si no se suministra el comando, la migración se omite.
4. Ejecutar smoke de base y smoke autenticado con credenciales sintéticas. En producción, el smoke HTTP requiere `SMOKE_BASE_URL` apuntando a la URL publicada del frontend/proxy; no usa backend localhost.
5. Si falla la validación, ejecutar rollback de aplicación; evaluar un restore de DB por separado y solo bajo el procedimiento destructivo autorizado.

## Migraciones

1. Preparar release/version y backup verificable/off-host; registrar checksum.
2. Anunciar ventana y activar `MAINTENANCE_MODE=true`.
3. Revisar el SQL/plan, compatibilidad hacia atrás y rollback de la migración.
4. Ejecutar `MIGRATION_CONFIRMATION=APPLY-MIGRATIONS MIGRATION_COMMAND='...' ./scripts/migrate-prod.sh` con `ALLOW_DATABASE_OPERATIONS=true`.
5. Ejecutar `./scripts/production-smoke.sh` y `./scripts/smoke-test.sh` con credenciales sintéticas inyectadas.
6. Desactivar mantenimiento solo con evidencia PASS. Una migración fallida se diagnostica; no se restaura destructivamente por reflejo.

## Restore y rollback

`deploy-with-rollback.sh` hace rollback de aplicación (ref/servicios) únicamente. Nunca hace restore destructivo automático. Cualquier restore productivo exige `MAINTENANCE_MODE=true` y `ALLOW_DATABASE_OPERATIONS=true`; un restore destructivo exige además `--recreate-db --yes` y aprobación explícita. Si se usan URLs, `RESTORE_SOURCE_DATABASE_URL`/`SOURCE_DATABASE_URL` y `RESTORE_DATABASE_URL` no pueden ser iguales para un restore destructivo. Después se verifica la existencia de las tablas materiales (`hotels`, `users`, `rooms`, `guests`, `bookings`, `invoices`, `payment_entries`) y se ejecuta el smoke autenticado con identidad sintética.

El procedimiento de DR es `ALLOW_DATABASE_OPERATIONS=true DB_USER=... ./scripts/restore-drill.sh`; con PostgreSQL externo se inyectan `DRILL_SOURCE_DATABASE_URL` y `DRILL_TARGET_DATABASE_URL`, y el drill no provisiona el target. Restore/SMOKE aceptan `DATABASE_URL` o sus variables específicas; el fallback compose `db` es solo dev. No usarlo contra datos reales sin autorización y ventana controlada. No se hardcodean contraseñas demo, tenants de ejemplo ni secretos.
