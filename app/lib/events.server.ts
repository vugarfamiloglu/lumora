import db from "./db.server";
import { newId } from "./ids.server";

// In-process pub/sub powering Server-Sent Events (live vitals, alerts, notifications).
type Listener = (event: { type: string; data: unknown }) => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit(type: string, data: unknown): void {
  for (const fn of listeners) {
    try { fn({ type, data }); } catch { /* dropped */ }
  }
}

export interface NotifyInput {
  scope?: string; targetRole?: string; targetStaffId?: string;
  severity?: "info" | "warn" | "critical"; title: string; body?: string;
  link?: string; entity?: string; entityId?: string;
}

// Persist a notification and push it to live listeners.
export function notify(n: NotifyInput): string {
  const id = newId();
  db.prepare(`INSERT INTO notifications (id, scope, target_role, target_staff_id, severity, title, body, link, entity, entity_id)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    id, n.scope ?? "global", n.targetRole ?? null, n.targetStaffId ?? null,
    n.severity ?? "info", n.title, n.body ?? "", n.link ?? null, n.entity ?? null, n.entityId ?? null
  );
  emit("notification", { id, severity: n.severity ?? "info", title: n.title, body: n.body ?? "", link: n.link ?? null,
    targetRole: n.targetRole ?? null, createdAt: new Date().toISOString() });
  return id;
}
