import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import db from "~/lib/db.server";
import { requireCap } from "~/lib/session.server";
import { newId, mrn, visitNo } from "~/lib/ids.server";
import { notify } from "~/lib/events.server";
import { writeAudit } from "~/lib/audit.server";
import { Kpi, Button, Modal, Field, Badge } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { relTime } from "~/lib/format";

export const meta: MetaFunction = () => [{ title: "Emergency · Lumora" }];
export const handle = { title: "Emergency Department", crumb: "TRIAGE" };

export async function loader({ request }: LoaderFunctionArgs) {
  await requireCap(request, "view_ed");
  const ed = db.prepare("SELECT id FROM departments WHERE kind='ed'").get() as any;
  const rows = db.prepare(`SELECT e.id, e.chief_complaint, e.acuity, e.created_at, p.full_name, p.is_anonymous, p.id AS pid,
      (SELECT hr FROM vitals WHERE encounter_id=e.id ORDER BY captured_at DESC LIMIT 1) AS hr,
      (SELECT bp_sys FROM vitals WHERE encounter_id=e.id ORDER BY captured_at DESC LIMIT 1) AS bp,
      (SELECT spo2 FROM vitals WHERE encounter_id=e.id ORDER BY captured_at DESC LIMIT 1) AS spo2
    FROM encounters e JOIN patients p ON p.id=e.patient_id
    WHERE e.department_id=? AND e.status IN ('open','in_progress') ORDER BY e.created_at`).all(ed?.id) as any[];
  const zones = { red: [] as any[], yellow: [] as any[], green: [] as any[] };
  for (const r of rows) (zones[(r.acuity as keyof typeof zones)] ?? zones.green).push(r);
  return json({ zones, edId: ed?.id ?? null });
}

export async function action({ request }: ActionFunctionArgs) {
  const staff = await requireCap(request, "manage_ed");
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const ed = db.prepare("SELECT id FROM departments WHERE kind='ed'").get() as any;

  if (intent === "register") {
    const name = String(form.get("name") ?? "").trim();
    const cc = String(form.get("complaint") ?? "").trim() || "Undifferentiated complaint";
    const acuity = String(form.get("acuity") ?? "yellow");
    const anon = name === "";
    const pid = newId();
    db.prepare(`INSERT INTO patients (id, mrn, full_name, is_anonymous, photo_color) VALUES (?,?,?,?,?)`)
      .run(pid, mrn(), anon ? "Unknown · ED" : name, anon ? 1 : 0, acuity === "red" ? "#ef4444" : "#0ea5e9");
    const eid = newId();
    db.prepare(`INSERT INTO encounters (id, visit_no, patient_id, type, department_id, status, chief_complaint, acuity, admitted_at)
      VALUES (?,?,?,'emergency',?,'in_progress',?,?,datetime('now'))`).run(eid, visitNo(), pid, ed.id, cc, acuity);
    const hr = 70 + Math.floor(Math.random() * 50), bp = 100 + Math.floor(Math.random() * 50), spo2 = 90 + Math.floor(Math.random() * 9);
    db.prepare(`INSERT INTO vitals (id, encounter_id, hr, bp_sys, bp_dia, spo2, resp, temp, source) VALUES (?,?,?,?,?,?,?,?,'manual')`)
      .run(newId(), eid, hr, bp, bp - 35, spo2, 16, 37.0);
    if (acuity === "red") notify({ scope: "ed", targetRole: "doctor", severity: "critical", title: `Red triage · ${cc}`, body: "New red-zone arrival awaiting review", link: "/emergency", entity: "encounter", entityId: eid });
    writeAudit(staff, "ed.register", "encounter", eid, `${acuity} · ${cc}`);
    return redirect("/emergency");
  }

  if (intent === "retriage") {
    const eid = String(form.get("eid"));
    const acuity = String(form.get("acuity"));
    db.prepare("UPDATE encounters SET acuity=? WHERE id=?").run(acuity, eid);
    writeAudit(staff, "ed.retriage", "encounter", eid, acuity);
    return json({ ok: true });
  }
  return json({ ok: false });
}

const ZONES: Array<{ key: "red" | "yellow" | "green"; label: string }> = [
  { key: "red", label: "Resuscitation · Red" }, { key: "yellow", label: "Urgent · Yellow" }, { key: "green", label: "Standard · Green" },
];

export default function Emergency() {
  const { zones } = useLoaderData<typeof loader>();
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher();
  const total = zones.red.length + zones.yellow.length + zones.green.length;

  return (
    <div className="stack">
      <div className="between" style={{ alignItems: "flex-start" }}>
        <div><h1 className="page-title">Emergency Department</h1><p className="page-sub">Triage board — patients grouped by clinical acuity. Red is seen first.</p></div>
        <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>Register arrival</Button>
      </div>

      <div className="grid-4">
        <Kpi label="In department" value={total} icon="emergency" />
        <Kpi label="Red zone" value={zones.red.length} icon="alert" tone="warn" delta={<span className="flag-critical">Resuscitation</span>} />
        <Kpi label="Yellow zone" value={zones.yellow.length} icon="clock" tone="accent" />
        <Kpi label="Green zone" value={zones.green.length} icon="check" tone="success" />
      </div>

      <div className="triage-board">
        {ZONES.map((z) => (
          <div key={z.key} className={`zone ${z.key === "yellow" ? "amber" : z.key}`}>
            <div className="zone-head">
              <span className="z-name"><span className="z-dot" />{z.label}</span>
              <Badge tone="b-muted">{zones[z.key].length}</Badge>
            </div>
            <div className="zone-list">
              {zones[z.key].length === 0 && <span className="dim center" style={{ padding: 14 }}>Empty</span>}
              {zones[z.key].map((e: any) => (
                <div key={e.id} className="ecard">
                  <div className="between">
                    <b>{e.is_anonymous ? "Unknown patient" : e.full_name}</b>
                    <span className="dim">{relTime(e.created_at)}</span>
                  </div>
                  <div className="cc">{e.chief_complaint}</div>
                  <div className="ed-vit">
                    {e.hr != null && <span>HR {e.hr}</span>}
                    {e.bp != null && <span>BP {e.bp}</span>}
                    {e.spo2 != null && <span>SpO₂ {e.spo2}%</span>}
                  </div>
                  <div className="cluster" style={{ marginTop: 8, gap: 6 }}>
                    {(["red", "yellow", "green"] as const).filter((a) => a !== e.acuity).map((a) => (
                      <button key={a} className="btn btn-sm btn-ghost" onClick={() => {
                        const fd = new FormData(); fd.set("intent", "retriage"); fd.set("eid", e.id); fd.set("acuity", a);
                        fetcher.submit(fd, { method: "post" });
                      }}>→ {a}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {open && <RegisterModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function RegisterModal({ onClose }: { onClose: () => void }) {
  const fetcher = useFetcher();
  const busy = fetcher.state !== "idle";
  return (
    <Modal title="Register ED arrival" onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" form="ed-reg" type="submit" disabled={busy}>{busy ? "Registering…" : "Register"}</Button>
      </>}>
      <fetcher.Form id="ed-reg" method="post" onSubmit={() => setTimeout(onClose, 50)}>
        <input type="hidden" name="intent" value="register" />
        <Field label="Patient name" hint="Leave blank for an unidentified / unconscious arrival (anonymous record).">
          <input name="name" placeholder="e.g. John Doe — or leave blank" autoFocus />
        </Field>
        <Field label="Chief complaint" required><input name="complaint" placeholder="e.g. Chest pain" /></Field>
        <Field label="Triage acuity">
          <select name="acuity" defaultValue="yellow">
            <option value="red">Red — Resuscitation</option>
            <option value="yellow">Yellow — Urgent</option>
            <option value="green">Green — Standard</option>
          </select>
        </Field>
        <p className="dim"><Icon name="alert" size={12} /> A provisional MRN and triage vitals are generated automatically.</p>
      </fetcher.Form>
    </Modal>
  );
}
