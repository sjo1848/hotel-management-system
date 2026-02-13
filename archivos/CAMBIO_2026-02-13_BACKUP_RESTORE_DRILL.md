# Registro Breve de Cambio

Objetivo:  
Ejecutar y evidenciar un drill real de backup + restore de PostgreSQL para reducir riesgo operacional de pérdida de datos.

Contexto:  
El estado de hardening tenía pendiente explícito de backups/DR con evidencia. Los scripts existían pero eran básicos y restore era interactivo/sobre DB principal.

Decisión:  
1. Se robusteció `scripts/backup.sh`:
   - uso de `docker compose exec -T db`
   - configuración por variables (`DB_NAME`, `DB_USER`, `BACKUP_DIR`)
   - creación automática de directorio.
2. Se robusteció `scripts/restore.sh`:
   - soporte `--db <destino>`
   - soporte `--create-db`
   - soporte `--yes` para modo no interactivo (útil en drills/automatización).
3. Se actualizó `scripts/smoke-test.sh` para login actual (`hotel_id` requerido, ahora usando nombre de hotel).
4. Se ejecutó drill real:
   - backup generado: `scripts/backups/hms_backup_hms_core_20260213_012109.sql.gz`
   - restore en DB temporal: `hms_core_drill_20260213_012120`
   - comparación de integridad por conteos de tablas críticas.

Impacto:  
- DR pasa de “teórico” a “validado con evidencia operativa”.
- Restore seguro en DB temporal evita sobreescrituras accidentales durante pruebas.
- Base para automatizar drills periódicos.

Evidencia del drill (conteos origen vs restaurado):  
- `audit_events`: `126` vs `126`
- `bookings`: `7` vs `7`
- `extra_charges`: `0` vs `0`
- `hotels`: `2` vs `2`
- `invoices`: `1` vs `1`
- `rooms`: `6` vs `6`
- `users`: `5` vs `5`
- Diff: sin diferencias.

Próximo paso:  
Automatizar este drill (job programado) y registrar evidencia periódica con retención de backups + política de restauración documentada.
