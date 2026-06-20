import { json, type ActionFunctionArgs } from "@remix-run/node";
import bcrypt from "bcryptjs";
import db from "~/lib/db.server";
import { requireStaff, hashPassword } from "~/lib/session.server";
import { writeAudit } from "~/lib/audit.server";

// Self-service: any signed-in employee changes their own password.
export async function action({ request }: ActionFunctionArgs) {
  const staff = await requireStaff(request);
  const f = await request.formData();
  const current = String(f.get("current") ?? "");
  const next = String(f.get("password") ?? "");
  const confirm = String(f.get("confirm") ?? "");
  const row = db.prepare("SELECT password_hash FROM staff WHERE id=?").get(staff.id) as any;
  if (!row || !bcrypt.compareSync(current, row.password_hash)) return json({ error: "Current password is incorrect." }, { status: 400 });
  if (next.length < 6) return json({ error: "New password must be at least 6 characters." }, { status: 400 });
  if (next !== confirm) return json({ error: "New passwords do not match." }, { status: 400 });
  db.prepare("UPDATE staff SET password_hash=? WHERE id=?").run(hashPassword(next), staff.id);
  writeAudit(staff, "account.password", "staff", staff.id);
  return json({ ok: true });
}
