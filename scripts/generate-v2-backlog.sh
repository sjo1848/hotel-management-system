#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 [--output FILE] [--start-date YYYY-MM-DD]
          [--product-owner NAME] [--tech-lead-backend NAME]
          [--tech-lead-frontend NAME] [--sre-owner NAME]
          [--security-owner NAME] [--require-owners]

Generates an executable V2 backlog with epics, tasks, owners, dates, dependencies and DoD.
USAGE
}

OUTPUT=""
START_DATE="$(date +%F)"
PRODUCT_OWNER="TBD"
TECH_LEAD_BACKEND="TBD"
TECH_LEAD_FRONTEND="TBD"
SRE_OWNER="TBD"
SECURITY_OWNER="TBD"
REQUIRE_OWNERS=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) OUTPUT="$2"; shift 2 ;;
    --start-date) START_DATE="$2"; shift 2 ;;
    --product-owner) PRODUCT_OWNER="$2"; shift 2 ;;
    --tech-lead-backend) TECH_LEAD_BACKEND="$2"; shift 2 ;;
    --tech-lead-frontend) TECH_LEAD_FRONTEND="$2"; shift 2 ;;
    --sre-owner) SRE_OWNER="$2"; shift 2 ;;
    --security-owner) SECURITY_OWNER="$2"; shift 2 ;;
    --require-owners) REQUIRE_OWNERS=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if ! [[ "$START_DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "Invalid --start-date format, expected YYYY-MM-DD" >&2
  exit 1
fi
if [[ "$REQUIRE_OWNERS" == "true" ]]; then
  for owner in "$PRODUCT_OWNER" "$TECH_LEAD_BACKEND" "$TECH_LEAD_FRONTEND" "$SRE_OWNER" "$SECURITY_OWNER"; do
    if [[ -z "${owner// }" || "$owner" == "TBD" ]]; then
      echo "--require-owners is set, but at least one owner is missing or TBD" >&2
      exit 1
    fi
  done
fi

if date -d "$START_DATE" >/dev/null 2>&1; then
  phase_a_end="$(date -d "$START_DATE +42 days" +%F)"
  phase_b_end="$(date -d "$phase_a_end +56 days" +%F)"
  phase_c_end="$(date -d "$phase_b_end +42 days" +%F)"
else
  phase_a_end="TBD"
  phase_b_end="TBD"
  phase_c_end="TBD"
fi

now="$(date '+%Y-%m-%d %H:%M:%S %Z')"

render() {
  cat <<MD
# V2 Backlog Ejecutable

- generated_at: $now
- planning_start_date: $START_DATE
- phase_a_target_end: $phase_a_end
- phase_b_target_end: $phase_b_end
- phase_c_target_end: $phase_c_end

## Owners sugeridos
- product_owner: $PRODUCT_OWNER
- tech_lead_backend: $TECH_LEAD_BACKEND
- tech_lead_frontend: $TECH_LEAD_FRONTEND
- sre_owner: $SRE_OWNER
- security_owner: $SECURITY_OWNER

## Epic A - Tenant Admin Core
### A1 API tenant lifecycle
- owner: tech_lead_backend
- owner_name: $TECH_LEAD_BACKEND
- target_date: $phase_a_end
- depends_on: none
- DoD:
  - endpoints CRUD tenant + lifecycle (active|suspended|terminated)
  - pruebas unit + integración para transiciones inválidas
  - contrato OpenAPI v2 actualizado

### A2 Tenant limits enforcement
- owner: tech_lead_backend
- owner_name: $TECH_LEAD_BACKEND
- target_date: $phase_a_end
- depends_on: A1
- DoD:
  - modelo tenant_plan_limits + enforcement en runtime
  - errores de contrato estables (LIMIT_EXCEEDED_*)
  - dashboard operativo por tenant con métricas de consumo

### A3 SaaS Admin console
- owner: tech_lead_frontend
- owner_name: $TECH_LEAD_FRONTEND
- target_date: $phase_a_end
- depends_on: A1
- DoD:
  - alta/baja/suspensión de tenant desde UI
  - impersonation segura auditada
  - e2e crítico de lifecycle tenant

## Epic B - Billing SaaS Avanzado
### B1 Subscription engine
- owner: tech_lead_backend
- owner_name: $TECH_LEAD_BACKEND
- target_date: $phase_b_end
- depends_on: A2
- DoD:
  - estados trial|active|past_due|suspended
  - prorrateo en cambio de plan
  - tests de regresión financiera determinísticos

### B2 Usage metering
- owner: tech_lead_backend
- owner_name: $TECH_LEAD_BACKEND
- target_date: $phase_b_end
- depends_on: B1
- DoD:
  - ledger de consumo por tenant (usuarios, reservas, API)
  - job diario de consolidación
  - reporte comparativo consumo vs plan

### B3 Payments + dunning
- owner: security_owner
- owner_name: $SECURITY_OWNER
- target_date: $phase_b_end
- depends_on: B1
- DoD:
  - webhooks idempotentes
  - reintentos de cobro y suspensión automática configurable
  - reconciliación diaria con tolerancia < 0.1%

## Epic C - Auditoría y Retención Avanzada
### C1 Retention policies
- owner: security_owner
- owner_name: $SECURITY_OWNER
- target_date: $phase_c_end
- depends_on: A1
- DoD:
  - políticas por tipo de dato y tenant
  - purge jobs con dry-run y evidencia auditable
  - tests de no-regresión de retención

### C2 Tamper-evident audit chain
- owner: tech_lead_backend
- owner_name: $TECH_LEAD_BACKEND
- target_date: $phase_c_end
- depends_on: C1
- DoD:
  - hash-chain diaria de eventos auditables
  - verificador offline de integridad
  - runbook de respuesta a incidente de integridad

### C3 Legal hold / eDiscovery
- owner: product_owner
- owner_name: $PRODUCT_OWNER
- target_date: $phase_c_end
- depends_on: C1
- DoD:
  - export legal hold por tenant/rango
  - trazabilidad completa de exportaciones
  - validación con checklist compliance

## Milestones de control
1. M1 (fin Fase A): tenant admin + límites en producción.
2. M2 (fin Fase B): billing recurrente y metering activos.
3. M3 (fin Fase C): auditoría/retención compliance-ready.

## Riesgos abiertos
- $(if [[ "$PRODUCT_OWNER" == "TBD" || "$TECH_LEAD_BACKEND" == "TBD" || "$TECH_LEAD_FRONTEND" == "TBD" || "$SRE_OWNER" == "TBD" || "$SECURITY_OWNER" == "TBD" ]]; then echo "falta owner nominal por frente"; else echo "owners asignados, pendiente validación de capacidad/commitment"; fi)
- falta validación legal final de retención
- falta entorno staging productivo para pruebas de carga billing
MD
}

if [[ -n "$OUTPUT" ]]; then
  mkdir -p "$(dirname "$OUTPUT")"
  render > "$OUTPUT"
  echo "Backlog generado en: $OUTPUT"
else
  render
fi
