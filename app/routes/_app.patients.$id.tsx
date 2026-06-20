import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Form, Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { useState } from "react";
import db from "~/lib/db.server";
import { requireCap, requireStaff } from "~/lib/session.server";
import { newId } from "~/lib/ids.server";
import { notify } from "~/lib/events.server";
import { writeAudit } from "~/lib/audit.server";
import { can } from "~/lib/rbac.server";
import { Card, CardHead, Badge, Avatar, Button, Modal, Field, EmptyState } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { age, dateShort, dateTime, jsonArr, money, FLAG_CLASS, STATUS_BADGE, relTime } from "~/lib/format";

export const meta: MetaFunction = () => [{ title: "Patient record · Lumora" }];
export const handle = { title: "Patient Record", crumb: "EMR" };

export async function loader({ request, params }: LoaderFunctionArgs) {
  const staff = await requireCap(request, "view_emr");
  const p = db.prepare("SELECT * FROM patients WHERE id=?").get(params.id) as any;
  if (!p) throw new Response("Not found", { status: 404 });
  const encs = db.prepare(`SELECT e.*, d.name AS dept, st.full_name AS attending FROM encounters e
    LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN staff st ON st.id=e.attending_id
    WHERE e.patient_id=? ORDER BY e.created_at DESC`).all(p.id) as any[];
  const encIds = encs.map((e) => e.id);
  const inClause = encIds.length ? `(${encIds.map(() => "?").join(",")})` : "(NULL)";
  const labs = encIds.length ? db.prepare(`SELECT o.id AS oid, o.name, o.status, o.created_at, lr.analyte, lr.value, lr.unit, lr.ref_range, lr.flag
    FROM orders o LEFT JOIN lab_results lr ON lr.order_id=o.id WHERE o.kind='lab' AND o.encounter_id IN ${inClause} ORDER BY o.created_at DESC`).all(...encIds) as any[] : [];
  const rads = encIds.length ? db.prepare(`SELECT rs.id, rs.modality, rs.body_part, rs.status, rs.impression, o.created_at FROM rad_studies rs
    JOIN orders o ON o.id=rs.order_id WHERE o.encounter_id IN ${inClause} ORDER BY o.created_at DESC`).all(...encIds) as any[] : [];
  const rx = encIds.length ? db.prepare(`SELECT * FROM prescriptions WHERE encounter_id IN ${inClause} ORDER BY created_at DESC`).all(...encIds) as any[] : [];
  const notes = encIds.length ? db.prepare(`SELECT n.*, s.full_name AS author FROM notes n LEFT JOIN staff s ON s.id=n.author_id WHERE n.encounter_id IN ${inClause} ORDER BY n.created_at DESC`).all(...encIds) as any[] : [];
  const refs = db.prepare(`SELECT r.*, fd.name AS from_d, td.name AS to_d, ts.full_name AS to_s FROM referrals r
    LEFT JOIN departments fd ON fd.id=r.from_department_id LEFT JOIN departments td ON td.id=r.to_department_id
    LEFT JOIN staff ts ON ts.id=r.to_staff_id WHERE r.patient_id=? ORDER BY r.created_at DESC`).all(p.id) as any[];
  const invoices = db.prepare("SELECT * FROM invoices WHERE patient_id=? ORDER BY created_at DESC").all(p.id) as any[];
  const vitals = encIds.length ? db.prepare(`SELECT * FROM vitals WHERE encounter_id IN ${inClause} ORDER BY captured_at DESC LIMIT 12`).all(...encIds) as any[] : [];
  const departments = db.prepare("SELECT id, name, category FROM departments WHERE active=1 ORDER BY name").all() as any[];
  const docs = db.prepare("SELECT id, full_name, department_id FROM staff WHERE role IN ('doctor','department_head') ORDER BY full_name").all() as any[];
  return json({ p, encs, labs, rads, rx, notes, refs, invoices, vitals, departments, docs,
    canEdit: can(staff.role, "edit_emr"), canRefer: can(staff.role, "manage_referrals"), me: staff });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const staff = await requireStaff(request);
  const f = await request.formData();
  const intent = String(f.get("intent"));
  const back = `/patients/${params.id}?tab=${f.get("tab") ?? "overview"}`;

  if (intent === "note") {
    const encId = String(f.get("encounter_id"));
    if (!encId) return redirect(back);
    db.prepare("INSERT INTO notes (id, encounter_id, author_id, kind, body) VALUES (?,?,?,?,?)")
      .run(newId(), encId, staff.id, String(f.get("kind") || "progress"), String(f.get("body") || ""));
    writeAudit(staff, "note.add", "encounter", encId);
    return redirect(back);
  }
  if (intent === "referral") {
    const id = newId();
    const toDept = String(f.get("to_department_id"));
    const toStaff = String(f.get("to_staff_id") || "") || null;
    db.prepare(`INSERT INTO referrals (id, patient_id, encounter_id, from_department_id, to_department_id, from_staff_id, to_staff_id, reason, priority, status)
      VALUES (?,?,?,?,?,?,?,?,?,'pending')`).run(id, params.id, String(f.get("encounter_id") || "") || null, staff.departmentId, toDept, staff.id, toStaff, String(f.get("reason") || ""), String(f.get("priority") || "routine"));
    notify({ scope: "global", targetRole: "doctor", severity: f.get("priority") === "urgent" ? "warn" : "info", title: "New referral received", body: String(f.get("reason") || ""), link: "/referrals", entity: "referral", entityId: id });
    writeAudit(staff, "referral.create", "referral", id);
    return redirect(back);
  }
  return redirect(back);
}

const TABS = [
  { id: "overview", label: "Overview", icon: "patients" },
  { id: "encounters", label: "Encounters", icon: "file" },
  { id: "results", label: "Results", icon: "flask" },
  { id: "meds", label: "Medications", icon: "pill" },
  { id: "notes", label: "Clinical Notes", icon: "edit" },
  { id: "referrals", label: "Referrals", icon: "share" },
  { id: "billing", label: "Billing", icon: "receipt" },
];

export default function PatientRecord() {
  const d = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const tab = params.get("tab") ?? "overview";
  const p = d.p;
  const allergies = jsonArr(p.allergies);
  const chronic = jsonArr(p.chronic_conditions);
  const openEnc = d.encs.find((e: any) => ["admitted", "in_progress", "open"].includes(e.status));
  const [refOpen, setRefOpen] = useState(false);

  return (
    <div className="stack">
      <div className="cluster"><Link to="/patients" className="btn btn-ghost btn-sm"><Icon name="chevron-left" size={15} />Patients</Link><span className="kicker">EMR</span></div>

      <Card>
        <div className="profile-head">
          <Avatar name={p.full_name} color={p.photo_color} size={68} />
          <div className="profile-id" style={{ flex: 1 }}>
            <div className="cluster"><h1>{p.is_anonymous ? "Unknown patient" : p.full_name}</h1>
              {p.blood_group && <Badge tone="b-pulse">{p.blood_group}</Badge>}
              {openEnc && <Badge tone="b-accent">{openEnc.status.replace("_", " ")}</Badge>}
            </div>
            <div className="meta">
              <span className="mono">{p.mrn}</span>
              <span className="tag">{age(p.birth_date)} · {p.gender ?? "—"}</span>
              <span className="tag">{p.payer_type}</span>
              {p.phone && <span><Icon name="phone" size={12} /> {p.phone}</span>}
            </div>
            {allergies.length > 0 && <div className="cluster" style={{ marginTop: 10 }}>
              <span className="kicker">Allergies</span>{allergies.map((a) => <span key={a} className="badge b-danger">{a}</span>)}
            </div>}
          </div>
          {d.canRefer && <Button variant="primary" icon="share" onClick={() => setRefOpen(true)}>Refer</Button>}
        </div>
      </Card>

      <Card>
        <div className="tabbar">
          {TABS.map((t) => (
            <Link key={t.id} to={`?tab=${t.id}`} className={tab === t.id ? "on" : ""}><Icon name={t.icon} size={15} />{t.label}</Link>
          ))}
        </div>

        {tab === "overview" && (
          <div className="card-body grid-2">
            <div>
              <dl className="def-list">
                <dt>MRN</dt><dd className="mono">{p.mrn}</dd>
                <dt>Date of birth</dt><dd>{dateShort(p.birth_date)}</dd>
                <dt>Gender</dt><dd>{p.gender ?? "—"}</dd>
                <dt>Blood group</dt><dd>{p.blood_group ?? "—"}</dd>
                <dt>Phone</dt><dd>{p.phone ?? "—"}</dd>
                <dt>Address</dt><dd>{p.address ?? "—"}</dd>
                <dt>Payer</dt><dd>{p.payer_type}{p.payer_name && p.payer_name !== "—" ? ` · ${p.payer_name}` : ""}</dd>
                <dt>Emergency contact</dt><dd>{p.emergency_contact ?? "—"}</dd>
              </dl>
            </div>
            <div className="stack">
              <Card><CardHead title="Allergies" /><div className="card-body cluster">{allergies.length ? allergies.map((a) => <span key={a} className="badge b-danger">{a}</span>) : <span className="muted">No known allergies</span>}</div></Card>
              <Card><CardHead title="Chronic conditions" /><div className="card-body cluster">{chronic.length ? chronic.map((c) => <span key={c} className="badge b-warn">{c}</span>) : <span className="muted">None recorded</span>}</div></Card>
            </div>
          </div>
        )}

        {tab === "encounters" && (
          <div className="list-rows">
            {d.encs.length === 0 ? <div className="card-body"><EmptyState icon="file" title="No encounters" /></div> : d.encs.map((e: any) => (
              <div key={e.id} className="list-row">
                <div className="spread"><b style={{ fontSize: 13.5 }}>{e.chief_complaint || e.type}</b><span className="mut-sm">{e.dept} · {e.attending ?? "—"} · {dateTime(e.created_at)}</span></div>
                <div className="cluster"><span className="tag">{e.type}</span><Badge tone={STATUS_BADGE[e.status] ?? "b-muted"}>{e.status.replace("_", " ")}</Badge></div>
              </div>
            ))}
          </div>
        )}

        {tab === "results" && (
          <div className="card-body stack">
            <Card><CardHead title="Laboratory" /><div className="tbl-wrap"><table className="tbl"><thead><tr><th>Test</th><th>Analyte</th><th className="num">Value</th><th>Reference</th><th>Flag</th><th>Status</th></tr></thead>
              <tbody>{d.labs.length === 0 ? <tr><td colSpan={6}><span className="muted">No lab results</span></td></tr> : d.labs.map((l: any, i: number) => (
                <tr key={i}><td>{l.name}</td><td>{l.analyte ?? "—"}</td><td className={`num ${FLAG_CLASS[l.flag] ?? ""}`}>{l.value ?? "—"} {l.unit}</td><td className="mono dim">{l.ref_range}</td>
                  <td>{l.flag ? <span className={FLAG_CLASS[l.flag]}>{l.flag}</span> : "—"}</td><td><Badge tone={STATUS_BADGE[l.status] ?? "b-muted"}>{l.status}</Badge></td></tr>
              ))}</tbody></table></div></Card>
            <Card><CardHead title="Radiology" /><div className="list-rows">
              {d.rads.length === 0 ? <div className="card-body"><span className="muted">No imaging studies</span></div> : d.rads.map((r: any) => (
                <Link key={r.id} to={`/radiology/${r.id}`} className="list-row click">
                  <div className="spread"><b style={{ fontSize: 13.5 }}>{r.modality} · {r.body_part}</b><span className="mut-sm">{r.impression || "Report pending"}</span></div>
                  <div className="cluster"><Badge tone={STATUS_BADGE[r.status] ?? "b-muted"}>{r.status}</Badge><Icon name="scan" size={16} /></div>
                </Link>
              ))}
            </div></Card>
          </div>
        )}

        {tab === "meds" && (
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Medication</th><th>Dose</th><th>Route</th><th>Frequency</th><th>Duration</th><th>Status</th></tr></thead>
            <tbody>{d.rx.length === 0 ? <tr><td colSpan={6}><span className="muted">No active prescriptions</span></td></tr> : d.rx.map((m: any) => (
              <tr key={m.id}><td><b>{m.name}</b></td><td className="mono">{m.dose}</td><td>{m.route}</td><td>{m.frequency}</td><td>{m.duration}</td><td><Badge tone={STATUS_BADGE[m.status] ?? "b-muted"}>{m.status}</Badge></td></tr>
            ))}</tbody></table></div>
        )}

        {tab === "notes" && (
          <div className="card-body grid-2">
            <div className="timeline">
              {d.notes.length === 0 && <span className="muted">No notes recorded</span>}
              {d.notes.map((nt: any) => (
                <div key={nt.id} className="tl-item">
                  <span className="tl-dot" />
                  <div className="between"><b style={{ fontSize: 13 }}>{nt.kind}</b><span className="dim">{dateTime(nt.created_at)}</span></div>
                  <p className="mut-sm" style={{ margin: "4px 0" }}>{nt.body}</p>
                  <span className="dim">{nt.author ?? "—"}</span>
                </div>
              ))}
            </div>
            {d.canEdit && openEnc && (
              <Card><CardHead title="Add progress note" /><div className="card-body">
                <Form method="post">
                  <input type="hidden" name="intent" value="note" />
                  <input type="hidden" name="tab" value="notes" />
                  <input type="hidden" name="encounter_id" value={openEnc.id} />
                  <Field label="Note type"><select name="kind"><option value="progress">Progress</option><option value="consult">Consultation</option><option value="nursing">Nursing</option></select></Field>
                  <Field label="Note" required><textarea name="body" rows={5} required placeholder="Clinical findings, assessment and plan…" /></Field>
                  <Button variant="primary" type="submit">Save note</Button>
                </Form>
              </div></Card>
            )}
          </div>
        )}

        {tab === "referrals" && (
          <div className="list-rows">
            {d.refs.length === 0 ? <div className="card-body"><EmptyState icon="share" title="No referrals" /></div> : d.refs.map((r: any) => (
              <div key={r.id} className="list-row">
                <div className="spread"><b style={{ fontSize: 13.5 }}>{r.from_d ?? "—"} → {r.to_d}</b><span className="mut-sm">{r.reason}{r.response ? ` · ${r.response}` : ""}</span><span className="dim">{relTime(r.created_at)}</span></div>
                <Badge tone={STATUS_BADGE[r.status] ?? "b-muted"}>{r.status}</Badge>
              </div>
            ))}
          </div>
        )}

        {tab === "billing" && (
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Invoice</th><th className="num">Total</th><th className="num">Paid</th><th>Payer</th><th>Status</th></tr></thead>
            <tbody>{d.invoices.length === 0 ? <tr><td colSpan={5}><span className="muted">No invoices</span></td></tr> : d.invoices.map((inv: any) => (
              <tr key={inv.id}><td className="mono">{inv.number}</td><td className="num">{money(inv.total)}</td><td className="num">{money(inv.paid)}</td><td className="tag">{inv.payer_type}</td><td><Badge tone={STATUS_BADGE[inv.status] ?? "b-muted"}>{inv.status}</Badge></td></tr>
            ))}</tbody></table></div>
        )}
      </Card>

      {refOpen && <ReferralModal patient={p} encId={openEnc?.id} departments={d.departments} docs={d.docs} onClose={() => setRefOpen(false)} />}
    </div>
  );
}

function ReferralModal({ patient, encId, departments, docs, onClose }: { patient: any; encId?: string; departments: any[]; docs: any[]; onClose: () => void }) {
  const [dept, setDept] = useState("");
  return (
    <Modal title={`Refer ${patient.is_anonymous ? "patient" : patient.full_name}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" form="ref" type="submit">Send referral</Button></>}>
      <Form id="ref" method="post" onSubmit={() => setTimeout(onClose, 50)}>
        <input type="hidden" name="intent" value="referral" />
        <input type="hidden" name="tab" value="referrals" />
        {encId && <input type="hidden" name="encounter_id" value={encId} />}
        <Field label="To department" required>
          <select name="to_department_id" required value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">Select…</option>{departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Field label="To specialist" hint="Optional — leave for department triage">
          <select name="to_staff_id"><option value="">Any available</option>{docs.filter((x) => !dept || x.department_id === dept).map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select>
        </Field>
        <Field label="Priority"><select name="priority"><option value="routine">Routine</option><option value="urgent">Urgent</option></select></Field>
        <Field label="Reason for referral" required><textarea name="reason" rows={4} required placeholder="Clinical question / reason for consult…" /></Field>
      </Form>
    </Modal>
  );
}
