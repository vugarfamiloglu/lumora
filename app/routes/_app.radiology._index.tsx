import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import db from "~/lib/db.server";
import { requireCap } from "~/lib/session.server";
import { PageHeader, Card, Badge, Kpi, EmptyState } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { dateTime, STATUS_BADGE } from "~/lib/format";

export const meta: MetaFunction = () => [{ title: "Radiology · Lumora" }];
export const handle = { title: "Radiology", crumb: "RIS · PACS" };

export async function loader({ request }: LoaderFunctionArgs) {
  await requireCap(request, "view_radiology");
  const status = new URL(request.url).searchParams.get("s") ?? "all";
  const cond = status === "all" ? "1=1" : "rs.status=?";
  const params = status === "all" ? [] : [status];
  const rows = db.prepare(`SELECT rs.id, rs.modality, rs.body_part, rs.status, rs.impression, o.priority, o.created_at,
      p.full_name AS patient, p.id AS pid FROM rad_studies rs JOIN orders o ON o.id=rs.order_id
      JOIN encounters e ON e.id=o.encounter_id JOIN patients p ON p.id=e.patient_id WHERE ${cond} ORDER BY o.created_at DESC`).all(...params) as any[];
  const k = {
    scheduled: (db.prepare("SELECT COUNT(*) c FROM rad_studies WHERE status='scheduled'").get() as any).c,
    acquired: (db.prepare("SELECT COUNT(*) c FROM rad_studies WHERE status='acquired'").get() as any).c,
    reported: (db.prepare("SELECT COUNT(*) c FROM rad_studies WHERE status='reported'").get() as any).c,
  };
  return json({ rows, status, k });
}

const FILTERS = [{ id: "all", label: "All" }, { id: "scheduled", label: "Scheduled" }, { id: "acquired", label: "To report" }, { id: "reported", label: "Reported" }];

export default function Radiology() {
  const { rows, status, k } = useLoaderData<typeof loader>();
  const [, setParams] = useSearchParams();
  return (
    <div className="stack">
      <PageHeader title="Radiology" sub="Imaging worklist and PACS — DICOM-style study viewer." />
      <div className="grid-3">
        <Kpi label="Scheduled" value={k.scheduled} icon="calendar" tone="accent" />
        <Kpi label="Awaiting report" value={k.acquired} icon="scan" tone="warn" />
        <Kpi label="Reported" value={k.reported} icon="check" tone="success" />
      </div>
      <div className="pill-tabs">{FILTERS.map((x) => <button key={x.id} className={status === x.id ? "on" : ""} onClick={() => setParams({ s: x.id })}>{x.label}</button>)}</div>
      <Card>
        <div className="list-rows">
          {rows.length === 0 && <div className="card-body"><EmptyState icon="scan" title="No studies" /></div>}
          {rows.map((r: any) => (
            <Link key={r.id} to={`/radiology/${r.id}`} className="list-row click">
              <div className="cluster">
                <span className="kpi-ico accent" style={{ width: 38, height: 38 }}><Icon name="scan" size={18} /></span>
                <div className="spread"><b style={{ fontSize: 13.5 }}>{r.modality} · {r.body_part}</b><span className="mut-sm">{r.patient} · {r.impression || "Report pending"} · {dateTime(r.created_at)}</span></div>
              </div>
              <div className="cluster">
                {r.priority !== "routine" && <Badge tone={r.priority === "stat" ? "b-danger" : "b-warn"}>{r.priority}</Badge>}
                <Badge tone={STATUS_BADGE[r.status] ?? "b-muted"}>{r.status}</Badge>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
