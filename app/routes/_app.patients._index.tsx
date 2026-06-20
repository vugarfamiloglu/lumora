import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { useState } from "react";
import db from "~/lib/db.server";
import { requireCap } from "~/lib/session.server";
import { newId, mrn } from "~/lib/ids.server";
import { writeAudit } from "~/lib/audit.server";
import { can } from "~/lib/rbac.server";
import { Card, PageHeader, Button, Badge, Avatar, Modal, Field } from "~/components/ui";
import { DataTable, type Column } from "~/components/DataTable";
import { Icon } from "~/components/Icon";
import { age, dateShort } from "~/lib/format";

export const meta: MetaFunction = () => [{ title: "Patients · Lumora" }];
export const handle = { title: "Patients", crumb: "REGISTRY" };

export async function loader({ request }: LoaderFunctionArgs) {
  const staff = await requireCap(request, "view_patients");
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const like = `%${q}%`;
  const rows = db.prepare(`SELECT p.*, (SELECT MAX(created_at) FROM encounters WHERE patient_id=p.id) AS last_visit,
      (SELECT status FROM encounters WHERE patient_id=p.id AND status IN ('admitted','in_progress','open') ORDER BY created_at DESC LIMIT 1) AS active
    FROM patients p ${q ? "WHERE p.full_name LIKE ? OR p.mrn LIKE ?" : ""} ORDER BY p.created_at DESC LIMIT 200`)
    .all(...(q ? [like, like] : [])) as any[];
  return json({ patients: rows, q, canEdit: can(staff.role, "edit_patients") });
}

export async function action({ request }: ActionFunctionArgs) {
  const staff = await requireCap(request, "edit_patients");
  const f = await request.formData();
  const id = newId();
  db.prepare(`INSERT INTO patients (id, mrn, full_name, gender, birth_date, blood_group, phone, payer_type, payer_name, allergies, chronic_conditions, photo_color)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, mrn(), String(f.get("full_name")), String(f.get("gender") || "male"), String(f.get("birth_date") || ""),
    String(f.get("blood_group") || ""), String(f.get("phone") || ""), String(f.get("payer_type") || "self"),
    String(f.get("payer_name") || ""), JSON.stringify(String(f.get("allergies") || "").split(",").map((s) => s.trim()).filter(Boolean)),
    JSON.stringify(String(f.get("chronic") || "").split(",").map((s) => s.trim()).filter(Boolean)), "#0ea5e9");
  writeAudit(staff, "patient.create", "patient", id, String(f.get("full_name")));
  return redirect(`/patients/${id}`);
}

export default function Patients() {
  const { patients, q, canEdit } = useLoaderData<typeof loader>();
  const nav = useNavigate();
  const search = useFetcher();
  const [open, setOpen] = useState(false);

  const cols: Column<any>[] = [
    { key: "name", header: "Patient", width: 240, render: (p) => <span className="cluster"><Avatar name={p.full_name} color={p.photo_color} size={32} /><span><b style={{ fontSize: 13.5 }}>{p.is_anonymous ? "Unknown patient" : p.full_name}</b><br /><span className="dim mono">{p.mrn}</span></span></span> },
    { key: "age", header: "Age / Sex", width: 110, render: (p) => <span>{age(p.birth_date)} · {p.gender ?? "—"}</span> },
    { key: "blood", header: "Blood", width: 80, render: (p) => p.blood_group ? <Badge tone="b-pulse">{p.blood_group}</Badge> : "—" },
    { key: "payer", header: "Payer", width: 130, render: (p) => <span className="tag">{p.payer_type}</span> },
    { key: "active", header: "Status", width: 120, render: (p) => p.active ? <Badge tone="b-accent">{p.active.replace("_", " ")}</Badge> : <span className="dim">outpatient</span> },
    { key: "last", header: "Last visit", width: 130, render: (p) => <span className="dim">{dateShort(p.last_visit)}</span> },
  ];

  return (
    <div className="stack">
      <PageHeader title="Patient Registry" sub="Master patient index — search, register and open the electronic medical record."
        action={canEdit && <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>Register patient</Button>} />
      <Card>
        <div className="card-body">
          <search.Form method="get" className="search" style={{ maxWidth: 420 }}>
            <Icon name="search" /><input name="q" defaultValue={q} placeholder="Search by name or MRN…" onChange={(e) => search.submit(e.currentTarget.form)} />
          </search.Form>
        </div>
        <DataTable columns={cols} rows={patients} rowKey={(p) => p.id} onRowClick={(p) => nav(`/patients/${p.id}`)} empty={{ icon: "patients", title: "No patients found" }} />
      </Card>
      {open && <NewPatient onClose={() => setOpen(false)} />}
    </div>
  );
}

function NewPatient({ onClose }: { onClose: () => void }) {
  const fetcher = useFetcher();
  return (
    <Modal title="Register patient" onClose={onClose} wide
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" form="np" type="submit">Register</Button></>}>
      <fetcher.Form id="np" method="post">
        <div className="form-grid">
          <Field label="Full name" required><input name="full_name" required autoFocus /></Field>
          <Field label="Gender"><select name="gender"><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></Field>
          <Field label="Date of birth"><input type="date" name="birth_date" /></Field>
          <Field label="Blood group"><select name="blood_group"><option value="">—</option>{["A+", "O+", "B+", "AB+", "A-", "O-", "B-", "AB-"].map((b) => <option key={b}>{b}</option>)}</select></Field>
          <Field label="Phone"><input name="phone" /></Field>
          <Field label="Payer"><select name="payer_type"><option value="self">Self-pay</option><option value="insurance">Insurance</option><option value="corporate">Corporate</option><option value="government">Government</option></select></Field>
        </div>
        <Field label="Allergies" hint="Comma-separated"><input name="allergies" placeholder="Penicillin, Latex" /></Field>
        <Field label="Chronic conditions" hint="Comma-separated"><input name="chronic" placeholder="Hypertension, Diabetes" /></Field>
      </fetcher.Form>
    </Modal>
  );
}
