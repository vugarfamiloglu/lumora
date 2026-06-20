import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams, Form } from "@remix-run/react";
import { useState } from "react";
import db from "~/lib/db.server";
import { requireStaff, requireCap, hashPassword } from "~/lib/session.server";
import { can } from "~/lib/rbac.server";
import { newId, staffNo } from "~/lib/ids.server";
import { writeAudit } from "~/lib/audit.server";
import { PageHeader, Card, CardHead, Avatar, Badge, Stars, Button, Modal, Field } from "~/components/ui";
import { Icon } from "~/components/Icon";

export const meta: MetaFunction = () => [{ title: "Medical Staff · Lumora" }];
export const handle = { title: "Staff Directory", crumb: "DIRECTORY" };

const avatar = (seed: string) => `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&radius=50&backgroundColor=dbe9ff,e9e0ff,ffe0ec,e0fff1,fff3d6,e0f2ff`;

export async function loader({ request }: LoaderFunctionArgs) {
  const me = await requireStaff(request);
  const url = new URL(request.url);
  const role = url.searchParams.get("role") ?? "";
  const deptFilter = url.searchParams.get("dept") ?? "";
  const canManage = can(me.role, "manage_staff");
  const departments = db.prepare("SELECT id, name FROM departments WHERE active=1 ORDER BY name").all() as any[];

  if (role) {
    const rows = db.prepare(`SELECT s.id, s.full_name, s.title, s.role, s.specialty, s.phone, s.photo_color, s.photo_url, s.rating, s.status, d.name AS dept
      FROM staff s LEFT JOIN departments d ON d.id=s.department_id WHERE s.role=? ORDER BY s.full_name`).all(role) as any[];
    return json({ mode: "flat" as const, role, rows, departments, canManage });
  }
  const rows = db.prepare(`SELECT s.id, s.full_name, s.title, s.role, s.specialty, s.subspecialty, s.phone, s.photo_color, s.photo_url, s.rating, s.status, s.consult_fee, d.id AS dept_id, d.name AS dept
    FROM staff s JOIN departments d ON d.id=s.department_id
    WHERE s.role IN ('doctor','department_head','radiology') ${deptFilter ? "AND d.id=?" : ""}
    ORDER BY d.name, (s.title LIKE 'Head%') DESC, s.full_name`).all(...(deptFilter ? [deptFilter] : [])) as any[];
  const groups: Array<{ dept: string; deptId: string; docs: any[] }> = [];
  for (const r of rows) { let g = groups.find((x) => x.deptId === r.dept_id); if (!g) { g = { dept: r.dept, deptId: r.dept_id, docs: [] }; groups.push(g); } g.docs.push(r); }
  const counts = db.prepare(`SELECT d.id, d.name, COUNT(s.id) AS n FROM departments d JOIN staff s ON s.department_id=d.id AND s.role IN ('doctor','department_head','radiology') GROUP BY d.id ORDER BY d.name`).all() as any[];
  return json({ mode: "grouped" as const, groups, depts: counts, departments, deptFilter, total: rows.length, canManage });
}

export async function action({ request }: ActionFunctionArgs) {
  const me = await requireCap(request, "manage_staff");
  const f = await request.formData();
  const name = String(f.get("full_name") ?? "").trim();
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (!name || !email) return json({ error: "Name and email are required." }, { status: 400 });
  if (db.prepare("SELECT 1 FROM staff WHERE email=?").get(email)) return json({ error: "Email already in use." }, { status: 400 });
  const id = newId();
  db.prepare(`INSERT INTO staff (id, staff_no, email, password_hash, full_name, role, title, department_id, specialty, subspecialty, phone, gender,
      photo_color, photo_url, rating, license_no, consult_fee, room, languages, bio)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, staffNo(), email, hashPassword(String(f.get("password") || "Lumora2026!")), name, String(f.get("role") || "doctor"),
    String(f.get("title") || ""), String(f.get("department_id") || "") || null, String(f.get("specialty") || ""), String(f.get("subspecialty") || ""),
    String(f.get("phone") || ""), String(f.get("gender") || "male"), "#6366f1", avatar(name + id.slice(-3)), 4.7,
    String(f.get("license_no") || "") || null, Number(f.get("consult_fee")) || 0, String(f.get("room") || ""),
    JSON.stringify(String(f.get("languages") || "English").split(",").map((s) => s.trim()).filter(Boolean)), String(f.get("bio") || ""));
  writeAudit(me, "staff.create", "staff", id, `${name} (${f.get("role")})`);
  return redirect(`/staff/${id}`);
}

const ROLE_PILLS = [
  { id: "", label: "Physicians" }, { id: "nurse", label: "Nurses" }, { id: "lab", label: "Laboratory" },
  { id: "radiology", label: "Radiology" }, { id: "pharmacy", label: "Pharmacy" }, { id: "reception", label: "Reception" },
  { id: "billing", label: "Cashier / Billing" }, { id: "super_admin", label: "Administration" },
];

export default function Staff() {
  const data = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  const role = params.get("role") ?? "";
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="stack">
      <PageHeader title="Staff Directory" sub="Browse the clinical and administrative team. Administrators can add and edit any staff member."
        action={data.canManage && <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>Add staff</Button>} />

      <Card><div className="card-body cluster">
        <div className="pill-tabs">{ROLE_PILLS.map((p) => <button key={p.id} className={role === p.id ? "on" : ""} onClick={() => setParams(p.id ? { role: p.id } : {})}>{p.label}</button>)}</div>
      </div></Card>

      {data.mode === "grouped" && data.groups.map((g) => (
        <Card key={g.deptId}>
          <CardHead title={g.dept} sub={`${g.docs.length} physicians`} />
          <div className="card-body grid-3">
            {g.docs.map((s: any) => <DocCard key={s.id} s={s} />)}
          </div>
        </Card>
      ))}

      {data.mode === "flat" && (
        <Card>
          <CardHead title={ROLE_PILLS.find((p) => p.id === role)?.label ?? "Staff"} sub={`${data.rows.length} staff`} />
          <div className="card-body grid-3">
            {data.rows.length === 0 && <span className="muted">No staff in this role</span>}
            {data.rows.map((s: any) => <DocCard key={s.id} s={s} />)}
          </div>
        </Card>
      )}

      {addOpen && <AddStaff departments={data.departments} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function DocCard({ s }: { s: any }) {
  return (
    <Link to={`/staff/${s.id}`} className="card" style={{ display: "block", padding: 18, textDecoration: "none" }}>
      <div className="cluster">
        <Avatar name={s.full_name} color={s.photo_color} src={s.photo_url} size={52} />
        <div className="spread" style={{ minWidth: 0 }}>
          <b style={{ fontFamily: "var(--font-display)", fontSize: 14.5 }}>{s.full_name}</b>
          <span className="mut-sm">{s.title}</span>
          {s.rating != null && <Stars rating={s.rating} />}
        </div>
      </div>
      <div className="between" style={{ marginTop: 12 }}>
        <span className="dim"><Icon name="phone" size={12} /> {s.phone ?? "—"}</span>
        {s.status !== "active" ? <Badge tone="b-danger">inactive</Badge> : s.consult_fee > 0 ? <span className="dim">${s.consult_fee}</span> : <span className="tag">{s.dept}</span>}
      </div>
    </Link>
  );
}

const ROLES = ["doctor", "nurse", "lab", "radiology", "pharmacy", "reception", "billing", "department_head"];

function AddStaff({ departments, onClose }: { departments: any[]; onClose: () => void }) {
  return (
    <Modal title="Add staff member" onClose={onClose} wide
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" form="addstaff" type="submit">Create account</Button></>}>
      <Form id="addstaff" method="post">
        <div className="form-grid">
          <Field label="Full name" required><input name="full_name" required autoFocus placeholder="Dr. Jane Doe" /></Field>
          <Field label="Role"><select name="role">{ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}</select></Field>
          <Field label="Work email" required><input type="email" name="email" required /></Field>
          <Field label="Temp password" hint="Default: Lumora2026!"><input name="password" placeholder="Lumora2026!" /></Field>
          <Field label="Department"><select name="department_id"><option value="">—</option>{departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Title"><input name="title" placeholder="Consultant / Specialist" /></Field>
          <Field label="Specialty"><input name="specialty" /></Field>
          <Field label="Subspecialty"><input name="subspecialty" /></Field>
          <Field label="Phone"><input name="phone" /></Field>
          <Field label="Gender"><select name="gender"><option value="male">Male</option><option value="female">Female</option></select></Field>
          <Field label="License no."><input name="license_no" /></Field>
          <Field label="Consultation fee"><input type="number" name="consult_fee" defaultValue={0} /></Field>
          <Field label="Room"><input name="room" /></Field>
          <Field label="Languages" hint="Comma-separated"><input name="languages" placeholder="English, Azerbaijani" /></Field>
        </div>
        <Field label="Biography"><textarea name="bio" rows={3} /></Field>
      </Form>
    </Modal>
  );
}
