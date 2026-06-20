import { json, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import db from "~/lib/db.server";
import { requireCap } from "~/lib/session.server";
import { writeAudit } from "~/lib/audit.server";
import { can } from "~/lib/rbac.server";
import { PageHeader, Card, Badge, Button, Kpi, EmptyState } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { dateTime, STATUS_BADGE } from "~/lib/format";

export const meta: MetaFunction = () => [{ title: "Theatres · Lumora" }];
export const handle = { title: "Operating Theatres", crumb: "PERI-OP" };

export async function loader({ request }: LoaderFunctionArgs) {
  const staff = await requireCap(request, "view_ot");
  const rows = db.prepare(`SELECT s.*, p.full_name AS patient, p.id AS pid, su.full_name AS surgeon, an.full_name AS anesthetist
    FROM surgeries s JOIN patients p ON p.id=s.patient_id LEFT JOIN staff su ON su.id=s.surgeon_id LEFT JOIN staff an ON an.id=s.anesthesiologist_id
    ORDER BY CASE s.status WHEN 'in_progress' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END, s.scheduled_at`).all() as any[];
  const k = {
    scheduled: rows.filter((r) => r.status === "scheduled").length,
    active: rows.filter((r) => r.status === "in_progress").length,
    done: rows.filter((r) => r.status === "completed").length,
  };
  return json({ rows: rows.map((r) => ({ ...r, checklist: JSON.parse(r.checklist || "{}") })), k, canManage: can(staff.role, "manage_ot") });
}

export async function action({ request }: ActionFunctionArgs) {
  const staff = await requireCap(request, "manage_ot");
  const f = await request.formData();
  const id = String(f.get("id"));
  const intent = String(f.get("intent"));
  const cur = db.prepare("SELECT status, checklist FROM surgeries WHERE id=?").get(id) as any;
  if (intent === "status") {
    db.prepare("UPDATE surgeries SET status=? WHERE id=?").run(String(f.get("status")), id);
  } else if (intent === "check") {
    const cl = JSON.parse(cur.checklist || "{}");
    const key = String(f.get("key"));
    cl[key] = !cl[key];
    db.prepare("UPDATE surgeries SET checklist=? WHERE id=?").run(JSON.stringify(cl), id);
  }
  writeAudit(staff, "ot.update", "surgery", id, intent);
  return json({ ok: true });
}

const STEPS = [{ k: "signIn", l: "Sign in" }, { k: "timeOut", l: "Time out" }, { k: "signOut", l: "Sign out" }];

export default function Theatres() {
  const { rows, k, canManage } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const post = (fd: FormData) => fetcher.submit(fd, { method: "post" });

  return (
    <div className="stack">
      <PageHeader title="Operating Theatres" sub="Theatre scheduling and the WHO surgical safety checklist." />
      <div className="grid-3">
        <Kpi label="Scheduled" value={k.scheduled} icon="calendar" tone="accent" />
        <Kpi label="In progress" value={k.active} icon="scalpel" tone="pulse" />
        <Kpi label="Completed" value={k.done} icon="check" tone="success" />
      </div>

      {rows.length === 0 ? <Card><EmptyState icon="scalpel" title="No scheduled cases" /></Card> : rows.map((s: any) => (
        <Card key={s.id}>
          <div className="card-head">
            <div><h3>{s.procedure}</h3><p>{s.patient} · {s.theatre} · {dateTime(s.scheduled_at)} · {s.duration_min} min</p></div>
            <Badge tone={STATUS_BADGE[s.status] ?? "b-muted"}>{s.status.replace("_", " ")}</Badge>
          </div>
          <div className="card-body grid-2">
            <dl className="def-list">
              <dt>Surgeon</dt><dd>{s.surgeon ?? "—"}</dd>
              <dt>Anesthetist</dt><dd>{s.anesthetist ?? "—"}</dd>
              <dt>Instrument count</dt><dd className="mono">{s.checklist?.counts?.instruments ?? "—"}</dd>
              <dt>Swab count</dt><dd className="mono">{s.checklist?.counts?.swabs ?? "—"}</dd>
            </dl>
            <div>
              <span className="kicker">Surgical safety checklist</span>
              <div className="cluster" style={{ marginTop: 10, gap: 8 }}>
                {STEPS.map((st) => {
                  const done = !!s.checklist?.[st.k];
                  return (
                    <button key={st.k} disabled={!canManage} className={`badge ${done ? "b-success" : "b-muted"}`} style={{ cursor: canManage ? "pointer" : "default", border: "none" }}
                      onClick={() => { const fd = new FormData(); fd.set("intent", "check"); fd.set("id", s.id); fd.set("key", st.k); post(fd); }}>
                      <Icon name={done ? "check" : "x"} size={12} />{st.l}
                    </button>
                  );
                })}
              </div>
              {canManage && (
                <div className="cluster" style={{ marginTop: 14 }}>
                  {s.status === "scheduled" && <Button size="sm" variant="primary" onClick={() => { const fd = new FormData(); fd.set("intent", "status"); fd.set("id", s.id); fd.set("status", "in_progress"); post(fd); }}>Start case</Button>}
                  {s.status === "in_progress" && <Button size="sm" variant="primary" onClick={() => { const fd = new FormData(); fd.set("intent", "status"); fd.set("id", s.id); fd.set("status", "completed"); post(fd); }}>Complete</Button>}
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
