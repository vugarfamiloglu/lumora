import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import db from "~/lib/db.server";
import { requireStaff } from "~/lib/session.server";
import { PageHeader, Card, CardHead, Avatar, Badge, Stars } from "~/components/ui";
import { Icon } from "~/components/Icon";

export const meta: MetaFunction = () => [{ title: "Medical Staff · Lumora" }];
export const handle = { title: "Medical Staff", crumb: "DIRECTORY" };

export async function loader({ request }: LoaderFunctionArgs) {
  await requireStaff(request);
  const deptFilter = new URL(request.url).searchParams.get("dept") ?? "";
  const rows = db.prepare(`SELECT s.id, s.full_name, s.title, s.role, s.specialty, s.subspecialty, s.phone, s.photo_color, s.photo_url, s.rating, s.consult_fee, d.id AS dept_id, d.name AS dept, d.category
    FROM staff s JOIN departments d ON d.id=s.department_id
    WHERE s.role IN ('doctor','department_head','radiology') ${deptFilter ? "AND d.id=?" : ""}
    ORDER BY d.name, (s.title LIKE 'Head%') DESC, s.full_name`).all(...(deptFilter ? [deptFilter] : [])) as any[];
  const groups: Array<{ dept: string; deptId: string; docs: any[] }> = [];
  for (const r of rows) {
    let g = groups.find((x) => x.deptId === r.dept_id);
    if (!g) { g = { dept: r.dept, deptId: r.dept_id, docs: [] }; groups.push(g); }
    g.docs.push(r);
  }
  const depts = db.prepare(`SELECT d.id, d.name, COUNT(s.id) AS n FROM departments d JOIN staff s ON s.department_id=d.id AND s.role IN ('doctor','department_head','radiology') GROUP BY d.id ORDER BY d.name`).all() as any[];
  return json({ groups, depts, deptFilter, total: rows.length });
}

export default function Staff() {
  const { groups, depts, deptFilter, total } = useLoaderData<typeof loader>();
  const [, setParams] = useSearchParams();
  return (
    <div className="stack">
      <PageHeader title="Medical Staff" sub={`${total} physicians across ${depts.length} departments — every department is led by a head and staffed by a specialist team.`} />
      <Card><div className="card-body cluster">
        <button className={`btn btn-sm ${!deptFilter ? "btn-primary" : "btn-ghost"}`} onClick={() => setParams({})}>All departments</button>
        <div className="select-wrap" style={{ position: "relative" }}>
          <select value={deptFilter} onChange={(e) => setParams(e.target.value ? { dept: e.target.value } : {})}
            style={{ padding: "8px 12px", borderRadius: "var(--r-md)", border: "1px solid rgb(var(--line-strong))", background: "rgb(var(--paper))", color: "rgb(var(--ink))" }}>
            <option value="">Filter by department…</option>
            {depts.map((d: any) => <option key={d.id} value={d.id}>{d.name} ({d.n})</option>)}
          </select>
        </div>
      </div></Card>

      {groups.map((g) => (
        <Card key={g.deptId}>
          <CardHead title={g.dept} sub={`${g.docs.length} physicians`} action={<Link to={`/departments`} className="btn btn-ghost btn-sm">Department</Link>} />
          <div className="card-body grid-3">
            {g.docs.map((s: any) => (
              <Link key={s.id} to={`/staff/${s.id}`} className="card" style={{ display: "block", padding: 18, textDecoration: "none" }}>
                <div className="cluster">
                  <Avatar name={s.full_name} color={s.photo_color} src={s.photo_url} size={54} />
                  <div className="spread" style={{ minWidth: 0 }}>
                    <b style={{ fontFamily: "var(--font-display)", fontSize: 14.5 }}>{s.full_name}</b>
                    <span className="mut-sm">{s.title}</span>
                    <Stars rating={s.rating ?? 4.7} />
                  </div>
                </div>
                {s.subspecialty && <div style={{ marginTop: 12 }}><Badge tone="b-primary">{s.subspecialty}</Badge></div>}
                <div className="between" style={{ marginTop: 12 }}>
                  <span className="dim"><Icon name="phone" size={12} /> {s.phone ?? "—"}</span>
                  {s.consult_fee > 0 && <span className="dim">${s.consult_fee}</span>}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
