import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import db from "~/lib/db.server";
import { requireCap } from "~/lib/session.server";
import { PageHeader, Card, Badge } from "~/components/ui";
import { DataTable, type Column } from "~/components/DataTable";
import { dateTime, ROLE_LABEL } from "~/lib/format";

export const meta: MetaFunction = () => [{ title: "Activity Log · Lumora" }];
export const handle = { title: "Activity Log", crumb: "AUDIT" };

export async function loader({ request }: LoaderFunctionArgs) {
  await requireCap(request, "view_audit");
  const rows = db.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 300").all() as any[];
  return json({ rows });
}

export default function Audit() {
  const { rows } = useLoaderData<typeof loader>();
  const cols: Column<any>[] = [
    { key: "at", header: "When", width: 160, render: (a) => <span className="dim">{dateTime(a.created_at)}</span> },
    { key: "actor", header: "Actor", width: 180, render: (a) => <span><b style={{ fontSize: 13 }}>{a.actor_name}</b> <span className="tag">{(ROLE_LABEL as any)[a.actor_role] ?? a.actor_role}</span></span> },
    { key: "action", header: "Action", width: 160, render: (a) => <span className="mono">{a.action}</span> },
    { key: "entity", header: "Entity", width: 120, render: (a) => <Badge tone="b-muted">{a.entity}</Badge> },
    { key: "detail", header: "Detail", render: (a) => a.detail || "—" },
  ];
  return (
    <div className="stack">
      <PageHeader title="Activity Log" sub="Immutable audit trail of clinical and administrative actions." />
      <Card><DataTable columns={cols} rows={rows} rowKey={(a) => a.id} empty={{ icon: "audit", title: "No activity recorded" }} /></Card>
    </div>
  );
}
