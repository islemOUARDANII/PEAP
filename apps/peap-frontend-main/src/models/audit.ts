export interface AuditLog {
  id: string;
  actorUserId: string;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  traceId: string;
  resultCode: number;
  occurredAt: string;
  status: "success" | "warning" | "error";
  payload: Record<string, unknown>;
  trace?: string;
  timestamp?: string;
  actor?: string;
  entity?: string;
}
