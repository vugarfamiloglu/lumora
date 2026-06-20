import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import db from "~/lib/db.server";
import { requireCap } from "~/lib/session.server";
import { Card, CardHead, Kpi, Badge, Button, EmptyState } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { dateTime, timeOnly, relTime, STATUS_BADGE } from "~/lib/format";

export const meta: MetaFunction = () => [{ title: "My Workspace · Lumora" }];
export const handle = { title: "My Workspace", crumb: "CLINICIAN DESK" };

export async function loader({ request }: LoaderFunctionArgs) {
  const staff = await requireCap(request, "order_clinical");
  const me = staff.id;
  const results = db.prepare(`SELECT o.id, o.name, o.kind, o.status, o.resulted_at, o.created_at, p.full_name AS patient, p.id AS pid,
      (SELECT COUNT(*) FROM lab_results WHERE order_id=o.id) AS n,
      (SELECT COUNT(*) FROM lab_results WHERE order_id=o.id AND flag IN ('high','low','critical')) AS abn
    FROM orders o JOIN encounters e ON e.id=o.encounter_id JOIN patients p ON p.id=e.patient_id
    WHERE o.ordered_by=? AND o.kind='lab' AND o.status IN ('resulted','validated') ORDER BY o.resulted_at DESC LIMIT 30`).all(me) as any[];
  const pending = db.prepare(`SELECT o.id, o.name, o.kind, o.status, o.created_at, p.full_name AS patient, p.id AS pid
    FROM orders o JOIN encounters e ON e.id=o.encounter_id JOIN patients p ON p.id=e.patient_id
    WHERE o.ordered_by=? AND o.status IN ('ordered','collected','in_progress','scheduled','acquired') ORDER BY o.created_at DESC LIMIT 20`).all(me) as any[];
  const patients = db.prepare(`SELECT e.id, e.chief_complaint, e.type, e.status, p.full_name, p.id AS pid
    FROM encounters e JOIN patients p ON p.id=e.patient_id WHERE e.attending_id=? AND e.status IN ('open','in_progress','admitted') ORDER BY e.created_at DESC LIMIT 12`).all(me) as any[];
  const appts = db.prepare(`SELECT a.id, a.starts_at, a.reason, a.status, p.full_name, p.id AS pid
    FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE a.staff_id=? AND a.status IN ('booked','arrived') AND a.starts_at >= datetime('now','-1 day') ORDER BY a.starts_at LIMIT 10`).all(me) as any[];
  return json({ staff, results, pending, patients, appts });
}

export default function Workspace() {
  const { staff, results, pending, patients, appts } = useLoaderData<typeof loader>();
  const reviewable = results.length;
  const abnormal = results.filter((r: any) => r.abn > 0).length;

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">My Workspace</h1>
        <p className="page-sub">{staff.fullName} · {staff.departmentName ?? staff.specialty} — results you ordered, your patients and today's schedule.</p>
      </div>

      <div className="grid-4">
        <Kpi label="Results to review" value={reviewable} icon="flask" tone={reviewable ? "accent" : "success"} delta={`${abnormal} with abnormal values`} />
        <Kpi label="Pending orders" value={pending.length} icon="clock" tone="warn" />
        <Kpi label="My patients" value={patients.length} icon="patients" />
        <Kpi label="Upcoming appointments" value={appts.length} icon="calendar" tone="accent" />
      </div>

      <Card>
        <CardHead title="Results to review" sub="Lab results from tests you ordered have arrived" />
        <div className="list-rows">
          {results.length === 0 && <div className="card-body"><EmptyState icon="flask" title="No results waiting" body="Validated results for tests you order will appear here." /></div>}
          {results.map((rrow: any) => (
            <div key={rrow.id} className="list-row">
              <div className="cluster">
                <span className={`kpi-ico ${rrow.abn > 0 ? "warn" : "success"}`} style={{ width: 36, height: 36 }}><Icon name="flask" size={17} /></span>
                <div className="spread">
                  <b style={{ fontSize: 13.5 }}>{rrow.name}</b>
                  <span className="mut-sm"><Link to={`/patients/${rrow.pid}`} style={{ color: "rgb(var(--primary))" }}>{rrow.patient}</Link> · {rrow.n} analytes · {relTime(rrow.resulted_at ?? rrow.created_at)}</span>
                </div>
              </div>
              <div className="cluster">
                {rrow.abn > 0 ? <Badge tone="b-danger">{rrow.abn} abnormal</Badge> : <Badge tone="b-success">all normal</Badge>}
                <Badge tone={STATUS_BADGE[rrow.status] ?? "b-muted"}>{rrow.status}</Badge>
                <a href={`/report/${rrow.id}`} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm"><Icon name="file" size={14} />Present to patient</a>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="bento">
        <Card>
          <CardHead title="My patients" action={<Link to="/patients" className="btn btn-ghost btn-sm">Registry</Link>} />
          <div className="list-rows">
            {patients.length === 0 && <div className="card-body"><span className="muted">No active patients</span></div>}
            {patients.map((e: any) => (
              <Link key={e.id} to={`/patients/${e.pid}`} className="list-row click">
                <div className="spread"><b style={{ fontSize: 13.5 }}>{e.full_name}</b><span className="mut-sm">{e.chief_complaint} · {e.type}</span></div>
                <Badge tone={STATUS_BADGE[e.status] ?? "b-muted"}>{e.status.replace("_", " ")}</Badge>
              </Link>
            ))}
          </div>
        </Card>
        <div className="stack">
          <Card>
            <CardHead title="Today's schedule" action={<Link to="/appointments" className="btn btn-ghost btn-sm">All</Link>} />
            <div className="list-rows">
              {appts.length === 0 && <div className="card-body"><span className="muted">No appointments</span></div>}
              {appts.map((a: any) => (
                <Link key={a.id} to={`/patients/${a.pid}`} className="list-row click">
                  <div className="cluster"><span className="mono" style={{ fontWeight: 600 }}>{timeOnly(a.starts_at)}</span><div className="spread"><b style={{ fontSize: 13 }}>{a.full_name}</b><span className="dim">{a.reason}</span></div></div>
                  <Badge tone={STATUS_BADGE[a.status] ?? "b-muted"}>{a.status}</Badge>
                </Link>
              ))}
            </div>
          </Card>
          <Card>
            <CardHead title="Pending orders" />
            <div className="list-rows">
              {pending.length === 0 && <div className="card-body"><span className="muted">No pending orders</span></div>}
              {pending.map((o: any) => (
                <div key={o.id} className="list-row">
                  <div className="spread"><b style={{ fontSize: 13 }}>{o.name}</b><span className="dim">{o.patient} · {relTime(o.created_at)}</span></div>
                  <Badge tone={STATUS_BADGE[o.status] ?? "b-muted"}>{o.status.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
