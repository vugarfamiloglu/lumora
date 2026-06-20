import { json, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams, useFetcher } from "@remix-run/react";
import db from "~/lib/db.server";
import { requireCap } from "~/lib/session.server";
import { writeAudit } from "~/lib/audit.server";
import { notify } from "~/lib/events.server";
import { newId } from "~/lib/ids.server";
import { can } from "~/lib/rbac.server";
import { PageHeader, Card, Badge, Button, Kpi, EmptyState } from "~/components/ui";
import { dateTime, FLAG_CLASS, STATUS_BADGE } from "~/lib/format";

export const meta: MetaFunction = () => [{ title: "Laboratory · Lumora" }];
export const handle = { title: "Central Laboratory", crumb: "LIS" };

export async function loader({ request }: LoaderFunctionArgs) {
  const staff = await requireCap(request, "view_lab");
  const status = new URL(request.url).searchParams.get("s") ?? "active";
  const cond = status === "active" ? "o.status IN ('ordered','collected','in_progress','resulted')" : status === "all" ? "1=1" : "o.status=?";
  const params = status === "active" || status === "all" ? [] : [status];
  const orders = db.prepare(`SELECT o.id, o.name, o.priority, o.status, o.created_at, p.full_name AS patient, p.id AS pid, st.full_name AS ordered_by
    FROM orders o JOIN encounters e ON e.id=o.encounter_id JOIN patients p ON p.id=e.patient_id LEFT JOIN staff st ON st.id=o.ordered_by
    WHERE o.kind='lab' AND ${cond} ORDER BY CASE o.priority WHEN 'stat' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END, o.created_at DESC`).all(...params) as any[];
  const resultsBy: Record<string, any[]> = {};
  for (const o of orders) resultsBy[o.id] = db.prepare("SELECT analyte, value, unit, ref_range, flag FROM lab_results WHERE order_id=?").all(o.id) as any[];
  const k = {
    pending: (db.prepare("SELECT COUNT(*) c FROM orders WHERE kind='lab' AND status IN ('ordered','collected','in_progress')").get() as any).c,
    review: (db.prepare("SELECT COUNT(*) c FROM orders WHERE kind='lab' AND status='resulted'").get() as any).c,
    critical: (db.prepare("SELECT COUNT(*) c FROM lab_results WHERE flag='critical'").get() as any).c,
  };
  return json({ orders, resultsBy, status, k, canResult: can(staff.role, "result_lab") });
}

function generateResults(orderId: string) {
  const existing = (db.prepare("SELECT COUNT(*) c FROM lab_results WHERE order_id=?").get(orderId) as any).c;
  if (existing > 0) return;
  const order = db.prepare("SELECT notes FROM orders WHERE id=?").get(orderId) as any;
  let codes: string[] = [];
  try { codes = JSON.parse(order?.notes ?? "[]"); } catch { codes = []; }
  for (const code of codes) {
    const cat = db.prepare("SELECT * FROM lab_catalog WHERE code=?").get(code) as any;
    if (!cat) continue;
    const n = parseInt(orderId.slice(-3), 36) + code.length;
    let value: number, flag = "normal";
    if (n % 9 === 0) { value = +(cat.ref_high * 1.4).toFixed(2); flag = "high"; }
    else if (n % 13 === 0) { value = +(cat.ref_low * 0.6).toFixed(2); flag = "low"; }
    else value = +(cat.ref_low + ((n % 100) / 100) * (cat.ref_high - cat.ref_low)).toFixed(2);
    db.prepare("INSERT INTO lab_results (id, order_id, analyte, value, unit, ref_range, flag, stage) VALUES (?,?,?,?,?,?,?,'tech_validated')")
      .run(newId(), orderId, cat.name, String(value), cat.unit, `${cat.ref_low}–${cat.ref_high}`, flag);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const staff = await requireCap(request, "result_lab");
  const f = await request.formData();
  const id = String(f.get("id"));
  const next = String(f.get("status"));
  if (next === "resulted") generateResults(id);
  db.prepare("UPDATE orders SET status=?, resulted_at=CASE WHEN ?='resulted' THEN datetime('now') ELSE resulted_at END WHERE id=?").run(next, next, id);

  const order = db.prepare("SELECT ordered_by FROM orders WHERE id=?").get(id) as any;
  if (next === "validated") {
    db.prepare("UPDATE lab_results SET stage='validated', validated_by=? WHERE order_id=?").run(staff.id, id);
    if (order?.ordered_by) notify({ scope: "global", targetStaffId: order.ordered_by, severity: "info", title: "Lab results ready", body: "Validated results are on your workspace.", link: "/workspace", entity: "order", entityId: id });
  }
  if (next === "resulted") {
    const crit = db.prepare("SELECT COUNT(*) c FROM lab_results WHERE order_id=? AND flag='critical'").get(id) as any;
    if (crit.c > 0) notify({ scope: "lab", targetStaffId: order?.ordered_by, severity: "critical", title: "Critical result available", body: "A critical lab value requires review.", link: "/lab", entity: "order", entityId: id });
  }
  writeAudit(staff, "lab.update", "order", id, next);
  return json({ ok: true });
}

const FILTERS = [{ id: "active", label: "Worklist" }, { id: "resulted", label: "Awaiting validation" }, { id: "validated", label: "Validated" }, { id: "all", label: "All" }];

export default function Lab() {
  const { orders, resultsBy, status, k, canResult } = useLoaderData<typeof loader>();
  const [, setParams] = useSearchParams();
  const fetcher = useFetcher();
  const act = (id: string, s: string) => { const fd = new FormData(); fd.set("id", id); fd.set("status", s); fetcher.submit(fd, { method: "post" }); };

  return (
    <div className="stack">
      <PageHeader title="Central Laboratory" sub="Specimen worklist with two-step technical and clinical validation." />
      <div className="grid-3">
        <Kpi label="Pending specimens" value={k.pending} icon="vial" tone="accent" />
        <Kpi label="Awaiting validation" value={k.review} icon="flask" tone="warn" />
        <Kpi label="Critical results" value={k.critical} icon="alert" tone={k.critical ? "warn" : "success"} />
      </div>
      <div className="pill-tabs">{FILTERS.map((x) => <button key={x.id} className={status === x.id ? "on" : ""} onClick={() => setParams({ s: x.id })}>{x.label}</button>)}</div>

      {orders.length === 0 ? <Card><EmptyState icon="flask" title="Worklist clear" /></Card> : (
        <div className="stack">
          {orders.map((o: any) => (
            <Card key={o.id}>
              <div className="card-head">
                <div><h3>{o.name}</h3><p><Link to={`/patients/${o.pid}`} style={{ color: "rgb(var(--primary))", fontWeight: 600 }}>{o.patient}</Link> · ordered by {o.ordered_by ?? "—"} · {dateTime(o.created_at)}</p></div>
                <div className="cluster">
                  {o.priority !== "routine" && <Badge tone={o.priority === "stat" ? "b-danger" : "b-warn"}>{o.priority}</Badge>}
                  <Badge tone={STATUS_BADGE[o.status] ?? "b-muted"}>{o.status}</Badge>
                  {canResult && o.status === "in_progress" && <Button size="sm" onClick={() => act(o.id, "resulted")}>Enter results</Button>}
                  {canResult && (o.status === "ordered" || o.status === "collected") && <Button size="sm" onClick={() => act(o.id, "in_progress")}>Start</Button>}
                  {canResult && o.status === "resulted" && <Button size="sm" variant="primary" onClick={() => act(o.id, "validated")}>Validate</Button>}
                </div>
              </div>
              {resultsBy[o.id].length > 0 && (
                <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Analyte</th><th className="num">Result</th><th>Reference</th><th>Flag</th></tr></thead>
                  <tbody>{resultsBy[o.id].map((r: any, i: number) => (
                    <tr key={i}><td>{r.analyte}</td><td className={`num ${FLAG_CLASS[r.flag] ?? ""}`}>{r.value} {r.unit}</td><td className="mono dim">{r.ref_range}</td><td>{r.flag ? <span className={FLAG_CLASS[r.flag]}>{r.flag}</span> : "—"}</td></tr>
                  ))}</tbody></table></div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
