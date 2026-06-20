import { json, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useFetcher } from "@remix-run/react";
import db from "~/lib/db.server";
import { requireCap } from "~/lib/session.server";
import { writeAudit } from "~/lib/audit.server";
import { can } from "~/lib/rbac.server";
import { PageHeader, Card, CardHead, Badge, Button, Kpi } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { jsonArr, STATUS_BADGE } from "~/lib/format";

export const meta: MetaFunction = () => [{ title: "Pharmacy · Lumora" }];
export const handle = { title: "Pharmacy", crumb: "MEDICATION" };

export async function loader({ request }: LoaderFunctionArgs) {
  const staff = await requireCap(request, "view_pharmacy");
  const queue = db.prepare(`SELECT rx.*, p.full_name AS patient, p.id AS pid, mc.interactions, mc.stock
    FROM prescriptions rx JOIN encounters e ON e.id=rx.encounter_id JOIN patients p ON p.id=e.patient_id
    LEFT JOIN med_catalog mc ON mc.id=rx.med_id WHERE rx.status IN ('prescribed','verified') ORDER BY rx.created_at DESC`).all() as any[];
  // interaction check: other active meds on the same encounter that appear in this drug's interaction list
  for (const r of queue) {
    const inter = jsonArr<string>(r.interactions);
    const co = db.prepare("SELECT name FROM prescriptions WHERE encounter_id=? AND id!=? AND status!='cancelled'").all(r.encounter_id, r.id) as any[];
    r.warning = co.map((c) => c.name).filter((nm) => inter.includes(nm));
  }
  const stock = db.prepare("SELECT * FROM med_catalog ORDER BY (stock <= reorder_level) DESC, name").all() as any[];
  const k = {
    toVerify: (db.prepare("SELECT COUNT(*) c FROM prescriptions WHERE status='prescribed'").get() as any).c,
    toDispense: (db.prepare("SELECT COUNT(*) c FROM prescriptions WHERE status='verified'").get() as any).c,
    lowStock: (db.prepare("SELECT COUNT(*) c FROM med_catalog WHERE stock <= reorder_level").get() as any).c,
  };
  return json({ queue, stock, k, canDispense: can(staff.role, "dispense_pharmacy") });
}

export async function action({ request }: ActionFunctionArgs) {
  const staff = await requireCap(request, "dispense_pharmacy");
  const f = await request.formData();
  const id = String(f.get("id")); const next = String(f.get("status"));
  db.prepare("UPDATE prescriptions SET status=?, dispensed_by=CASE WHEN ?='dispensed' THEN ? ELSE dispensed_by END WHERE id=?").run(next, next, staff.id, id);
  if (next === "dispensed") {
    const rx = db.prepare("SELECT med_id, qty FROM prescriptions WHERE id=?").get(id) as any;
    if (rx?.med_id) db.prepare("UPDATE med_catalog SET stock = MAX(0, stock - ?) WHERE id=?").run(rx.qty || 1, rx.med_id);
  }
  writeAudit(staff, "pharmacy.update", "prescription", id, next);
  return json({ ok: true });
}

export default function Pharmacy() {
  const { queue, stock, k, canDispense } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const act = (id: string, s: string) => { const fd = new FormData(); fd.set("id", id); fd.set("status", s); fetcher.submit(fd, { method: "post" }); };

  return (
    <div className="stack">
      <PageHeader title="Pharmacy" sub="Prescription verification, dispensing and stock control." />
      <div className="grid-3">
        <Kpi label="Awaiting verification" value={k.toVerify} icon="pill" tone="accent" />
        <Kpi label="Ready to dispense" value={k.toDispense} icon="check" tone="warn" />
        <Kpi label="Low stock items" value={k.lowStock} icon="alert" tone={k.lowStock ? "warn" : "success"} />
      </div>

      <div className="bento">
        <Card>
          <CardHead title="Dispensing queue" />
          <div className="list-rows">
            {queue.length === 0 && <div className="card-body"><span className="muted">Queue clear</span></div>}
            {queue.map((r: any) => (
              <div key={r.id} className="list-row">
                <div className="spread">
                  <div className="cluster" style={{ gap: 8 }}>
                    <b style={{ fontSize: 13.5 }}>{r.name} {r.dose}</b>
                    {r.warning?.length > 0 && <span className="badge b-danger" title={`Interacts with ${r.warning.join(", ")}`}><Icon name="alert" size={12} /> Interaction</span>}
                  </div>
                  <span className="mut-sm"><Link to={`/patients/${r.pid}`} style={{ color: "rgb(var(--primary))" }}>{r.patient}</Link> · {r.route} · {r.frequency}</span>
                </div>
                <div className="cluster">
                  <Badge tone={STATUS_BADGE[r.status] ?? "b-muted"}>{r.status}</Badge>
                  {canDispense && r.status === "prescribed" && <Button size="sm" onClick={() => act(r.id, "verified")}>Verify</Button>}
                  {canDispense && r.status === "verified" && <Button size="sm" variant="primary" onClick={() => act(r.id, "dispensed")}>Dispense</Button>}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHead title="Stock" />
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Medication</th><th className="num">Stock</th><th>Status</th></tr></thead>
            <tbody>{stock.map((m: any) => (
              <tr key={m.id}><td><b>{m.name}</b><br /><span className="dim">{m.form} · {m.strength}</span></td><td className="num">{m.stock}</td>
                <td>{m.stock <= m.reorder_level ? <Badge tone="b-danger">reorder</Badge> : <Badge tone="b-success">ok</Badge>}</td></tr>
            ))}</tbody></table></div>
        </Card>
      </div>
    </div>
  );
}
