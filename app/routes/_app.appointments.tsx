import { json, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useFetcher } from "@remix-run/react";
import db from "~/lib/db.server";
import { requireCap } from "~/lib/session.server";
import { can } from "~/lib/rbac.server";
import { PageHeader, Card, CardHead, Badge, Button, Avatar, EmptyState } from "~/components/ui";
import { timeOnly, STATUS_BADGE } from "~/lib/format";

export const meta: MetaFunction = () => [{ title: "Appointments · Lumora" }];
export const handle = { title: "Appointments", crumb: "SCHEDULING" };

export async function loader({ request }: LoaderFunctionArgs) {
  const staff = await requireCap(request, "view_appointments");
  const rows = db.prepare(`SELECT a.*, p.full_name AS patient, p.id AS pid, p.photo_color, st.full_name AS doctor, d.name AS dept
    FROM appointments a JOIN patients p ON p.id=a.patient_id LEFT JOIN staff st ON st.id=a.staff_id LEFT JOIN departments d ON d.id=a.department_id
    WHERE a.starts_at >= datetime('now','-1 day') ORDER BY a.starts_at LIMIT 120`).all() as any[];
  const byDay: Record<string, any[]> = {};
  for (const r of rows) {
    const day = new Date(r.starts_at.replace(" ", "T") + "Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    (byDay[day] ??= []).push(r);
  }
  return json({ byDay, canManage: can(staff.role, "manage_appointments") });
}

export async function action({ request }: ActionFunctionArgs) {
  await requireCap(request, "manage_appointments");
  const f = await request.formData();
  db.prepare("UPDATE appointments SET status=? WHERE id=?").run(String(f.get("status")), String(f.get("id")));
  return json({ ok: true });
}

export default function Appointments() {
  const { byDay, canManage } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const days = Object.entries(byDay);
  return (
    <div className="stack">
      <PageHeader title="Appointments" sub="Outpatient clinic schedule across all departments." />
      {days.length === 0 ? <Card><EmptyState icon="calendar" title="No upcoming appointments" /></Card> : days.map(([day, list]) => (
        <Card key={day}>
          <CardHead title={day} action={<Badge tone="b-muted">{list.length}</Badge>} />
          <div className="list-rows">
            {list.map((a: any) => (
              <div key={a.id} className="list-row">
                <div className="cluster">
                  <span className="mono" style={{ fontWeight: 600, minWidth: 48 }}>{timeOnly(a.starts_at)}</span>
                  <Avatar name={a.patient} color={a.photo_color} size={30} />
                  <div className="spread"><Link to={`/patients/${a.pid}`} style={{ fontWeight: 600, fontSize: 13.5 }}>{a.patient}</Link><span className="mut-sm">{a.doctor ?? "—"} · {a.dept ?? "—"} · {a.reason}</span></div>
                </div>
                <div className="cluster">
                  <Badge tone={STATUS_BADGE[a.status] ?? "b-muted"}>{a.status.replace("_", " ")}</Badge>
                  {canManage && a.status === "booked" && <Button size="sm" onClick={() => { const fd = new FormData(); fd.set("id", a.id); fd.set("status", "arrived"); fetcher.submit(fd, { method: "post" }); }}>Check in</Button>}
                  {canManage && a.status === "arrived" && <Button size="sm" variant="primary" onClick={() => { const fd = new FormData(); fd.set("id", a.id); fd.set("status", "done"); fetcher.submit(fd, { method: "post" }); }}>Complete</Button>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
