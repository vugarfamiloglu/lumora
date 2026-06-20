import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import db from "~/lib/db.server";
import { requireCap } from "~/lib/session.server";
import { PageHeader, Card, CardHead, Badge } from "~/components/ui";
import { Icon } from "~/components/Icon";

export const meta: MetaFunction = () => [{ title: "Departments · Lumora" }];
export const handle = { title: "Departments", crumb: "ORGANIZATION" };

const CAT_LABEL: Record<string, string> = {
  emergency: "Emergency & Critical Care", critical: "Emergency & Critical Care", surgical: "Surgical Services",
  inpatient: "Inpatient Specialties", outpatient: "Ambulatory Specialties", diagnostic: "Diagnostics & Laboratories",
  support: "Supportive Care", backoffice: "Administration",
};
const CAT_ICON: Record<string, string> = { emergency: "emergency", critical: "activity", surgical: "scalpel", inpatient: "bed", outpatient: "stethoscope", diagnostic: "flask", support: "heart", backoffice: "receipt" };

export async function loader({ request }: LoaderFunctionArgs) {
  await requireCap(request, "view_departments");
  const rows = db.prepare(`SELECT d.*, s.full_name AS head,
      (SELECT COUNT(*) FROM encounters e WHERE e.department_id=d.id AND e.status IN ('open','in_progress','admitted')) AS census,
      (SELECT COUNT(*) FROM beds b WHERE b.department_id=d.id) AS beds,
      (SELECT COUNT(*) FROM staff st WHERE st.department_id=d.id) AS staff
    FROM departments d LEFT JOIN staff s ON s.id=d.head_staff_id WHERE d.active=1 ORDER BY d.category, d.name`).all() as any[];
  const groups: Record<string, any[]> = {};
  for (const r of rows) {
    const g = CAT_LABEL[r.category] ?? r.category;
    (groups[g] ??= []).push(r);
  }
  return json({ groups });
}

export default function Departments() {
  const { groups } = useLoaderData<typeof loader>();
  return (
    <div className="stack">
      <PageHeader title="Departments" sub="Clinical, diagnostic and support units across the hospital." />
      {Object.entries(groups).map(([g, list]) => (
        <Card key={g}>
          <CardHead title={g} action={<Badge tone="b-muted">{list.length}</Badge>} />
          <div className="card-body grid-3">
            {list.map((d: any) => (
              <div key={d.id} className="pstat" style={{ borderLeft: `3px solid ${d.color}` }}>
                <div className="cluster" style={{ gap: 8 }}>
                  <span className="kpi-ico" style={{ width: 32, height: 32, background: `${d.color}22`, color: d.color }}><Icon name={CAT_ICON[d.category] ?? "departments"} size={16} /></span>
                  <div className="spread"><b style={{ fontSize: 14 }}>{d.name}</b><span className="dim">{d.location}</span></div>
                </div>
                <div className="meta cluster" style={{ marginTop: 12, gap: 14, fontSize: 12 }}>
                  <span><b className="num">{d.census}</b> <span className="dim">census</span></span>
                  {d.beds > 0 && <span><b className="num">{d.beds}</b> <span className="dim">beds</span></span>}
                  <span><b className="num">{d.staff}</b> <span className="dim">staff</span></span>
                </div>
                {d.head && <div className="mut-sm" style={{ marginTop: 8 }}><Icon name="user-md" size={12} /> {d.head}</div>}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
