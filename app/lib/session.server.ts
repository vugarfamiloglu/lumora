import { createCookieSessionStorage, redirect } from "@remix-run/node";
import bcrypt from "bcryptjs";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import db from "./db.server";
import { can, type Capability } from "./rbac.server";

function sessionSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const path = join(process.cwd(), "data", ".session-key");
  if (existsSync(path)) return readFileSync(path, "utf8").trim();
  const s = randomBytes(32).toString("hex");
  writeFileSync(path, s, "utf8");
  return s;
}

const storage = createCookieSessionStorage({
  cookie: {
    name: "lumora_session",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secrets: [sessionSecret()],
    maxAge: 60 * 60 * 12,
  },
});

export interface Staff {
  id: string; email: string; fullName: string; role: string; title: string | null;
  departmentId: string | null; departmentName: string | null; specialty: string | null; photoColor: string;
}

function loadStaff(id: string): Staff | null {
  const r = db.prepare(`SELECT s.id, s.email, s.full_name, s.role, s.title, s.department_id, s.specialty, s.photo_color, d.name AS dept_name
    FROM staff s LEFT JOIN departments d ON d.id = s.department_id WHERE s.id = ? AND s.status = 'active'`).get(id) as any;
  if (!r) return null;
  return { id: r.id, email: r.email, fullName: r.full_name, role: r.role, title: r.title,
    departmentId: r.department_id, departmentName: r.dept_name, specialty: r.specialty, photoColor: r.photo_color };
}

export async function login(email: string, password: string): Promise<Staff | null> {
  const r = db.prepare("SELECT * FROM staff WHERE email = ? AND status = 'active'").get(String(email).toLowerCase().trim()) as any;
  if (!r || !bcrypt.compareSync(password, r.password_hash)) return null;
  db.prepare("UPDATE staff SET last_login_at = datetime('now') WHERE id = ?").run(r.id);
  return loadStaff(r.id);
}

export async function createUserSession(staffId: string, redirectTo: string) {
  const session = await storage.getSession();
  session.set("staffId", staffId);
  return redirect(redirectTo, { headers: { "Set-Cookie": await storage.commitSession(session) } });
}

export async function getStaff(request: Request): Promise<Staff | null> {
  const session = await storage.getSession(request.headers.get("Cookie"));
  const id = session.get("staffId");
  return id ? loadStaff(id) : null;
}

export async function requireStaff(request: Request): Promise<Staff> {
  const staff = await getStaff(request);
  if (!staff) throw redirect(`/login?next=${encodeURIComponent(new URL(request.url).pathname)}`);
  return staff;
}

export async function requireCap(request: Request, cap: Capability): Promise<Staff> {
  const staff = await requireStaff(request);
  if (!can(staff.role, cap)) throw new Response("Insufficient permissions", { status: 403 });
  return staff;
}

export async function logout(request: Request) {
  const session = await storage.getSession(request.headers.get("Cookie"));
  return redirect("/login", { headers: { "Set-Cookie": await storage.destroySession(session) } });
}

export const hashPassword = (p: string) => bcrypt.hashSync(p, 10);
