import { apiGet } from "@/api/sdk";
import type { AuditEvent } from "@/types/domain";

export const getAuditEvents = async (limit = 80) => {
  return apiGet<AuditEvent[]>("/audit/events", { limit });
};

const auditService = {
  getAuditEvents,
};

export default auditService;
