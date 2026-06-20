import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import db from "~/lib/db.server";
import { requireStaff } from "~/lib/session.server";
import { PageHeader, Avatar, Badge } from "~/components/ui";
import { Icon } from "~/components/Icon";

export const meta: MetaFunction = () => [{ title: "Medical Staff · Lumora" }];
export const handle = { title: "Medical Staff", crumb: "DIRECTORY" };

export async function loader({ request }: LoaderFunctionArgs) {
  await requireStaff(request);
  const role = new URL(request.url).searchParams.get("role") ?? "";
  const rows = db.prepare(`SELECT s.id, s.full_name, s.title, s.role, s.specialty, s.phone, s.photo_color, s.consult_fee, d.name AS dept
    FROM staff s LEFT JOIN departments d ON d.id=s.department_id ${role ? "WHERE s.role=?" : ""} ORDER BY s.role, s.full_name`)
    .all(...(role ? [role] : [])) as any[];
  return json({ rows, role });
}

const ROLES = [
  { id: "", label: "All" }, { id: "doctor", label: "Physicians" }, { id: "nurse", label: "Nurses" },
  { id: "lab", label: "Laboratory" }, { id: "radiology", label: "Radiology" }, { id: "pharmacy", label: "Pharmacy" },
];

export default function Staff() {
  const { rows, role } = useLoaderData<typeof loader>();
  const [, setParams] = useSearchParams();
  return (
    <div className="stack">
      <PageHeader title="Medical Staff" sub="Physicians, nurses and clinical teams across the hospital." />
      <div className="pill-tabs">
        {ROLES.map((r) => <button key={r.id} className={role === r.id ? "on" : ""} onClick={() => setParams(r.id ? { role: r.id } : {})}>{r.label}</button>)}
      </div>
      <div className="grid-3">
        {rows.map((s: any) => (
          <Link key={s.id} to={`/staff/${s.id}`} className="card" style={{ display: "block", padding: 20, textDecoration: "none" }}>
            <div className="cluster">
              <Avatar name={s.full_name} color={s.photo_color} size={52} />
              <div className="spread">
                <b style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>{s.full_name}</b>
                <span className="mut-sm">{s.title}</span>
              </div>
            </div>
            <div className="cluster" style={{ marginTop: 14, gap: 6 }}>
              {s.specialty && <Badge tone="b-primary">{s.specialty}</Badge>}
              {s.dept && <span className="tag">{s.dept}</span>}
            </div>
            <div className="between" style={{ marginTop: 12 }}>
              <span className="dim"><Icon name="phone" size={12} /> {s.phone ?? "—"}</span>
              {s.consult_fee > 0 && <span className="dim">${s.consult_fee} consult</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
