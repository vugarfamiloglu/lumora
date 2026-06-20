import db from "./db.server";
import { newId } from "./ids.server";
import type { Staff } from "./session.server";

const stmt = db.prepare(`INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, action, entity, entity_id, detail, ip)
  VALUES (?,?,?,?,?,?,?,?,?)`);

export function writeAudit(actor: Staff | null, action: string, entity: string, entityId: string, detail = "", ip = ""): void {
  stmt.run(newId(), actor?.id ?? null, actor?.fullName ?? "system", actor?.role ?? "system", action, entity, entityId, detail, ip);
}
