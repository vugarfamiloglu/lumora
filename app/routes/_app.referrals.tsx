import { json, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams, useFetcher } from "@remix-run/react";
import { useState } from "react";
import db from "~/lib/db.server";
import { requireCap, requireStaff } from "~/lib/session.server";
import { notify } from "~/lib/events.server";
import { writeAudit } from "~/lib/audit.server";
import { can } from "~/lib/rbac.server";
import { PageHeader, Card, Badge, Button, Modal, Field, EmptyState } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { relTime, STATUS_BADGE } from "~/lib/format";

export const meta: MetaFunction = () => [{ title: "Referrals · Lumora" }];
export const handle = { title: "Referrals", crumb: "COORDINATION" };

export async function loader({ request }: LoaderFunctionArgs) {
  const staff = await requireCap(request, "view_referrals");
  const filter = new URL(request.url).searchParams.get("f") ?? "incoming";
  let where = "1=1";
  const p: unknown[] = [];
  if (filter === "incoming") { where = "r.to_department_id=?"; p.push(staff.departmentId); }
  else if (filter === "outgoing") { where = "r.from_staff_id=?"; p.push(staff.id); }
  const rows = db.prepare(`SELECT r.*, pat.full_name AS patient, pat.id AS pid, fd.name AS from_d, td.name AS to_d,
      fs.full_name AS from_s, ts.full_name AS to_s
    FROM referrals r JOIN patients pat ON pat.id=r.patient_id
    LEFT JOIN departments fd ON fd.id=r.from_department_id LEFT JOIN departments td ON td.id=r.to_department_id
    LEFT JOIN staff fs ON fs.id=r.from_staff_id LEFT JOIN staff ts ON ts.id=r.to_staff_id
    WHERE ${where} ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC`).all(...p) as any[];
  return json({ rows, filter, canManage: can(staff.role, "manage_referrals") });
}

export async function action({ request }: ActionFunctionArgs) {
  const staff = await requireCap(request, "manage_referrals");
  const f = await request.formData();
  const id = String(f.get("id"));
  const status = String(f.get("status"));
  const response = String(f.get("response") ?? "");
  db.prepare("UPDATE referrals SET status=?, response=COALESCE(NULLIF(?,''), response), responded_at=datetime('now'), to_staff_id=COALESCE(to_staff_id, ?) WHERE id=?")
    .run(status, response, staff.id, id);
  const ref = db.prepare("SELECT from_staff_id, patient_id FROM referrals WHERE id=?").get(id) as any;
  notify({ scope: "global", targetRole: "doctor", severity: "info", title: `Referral ${status}`, body: response || `Your referral was ${status}.`, link: "/referrals", entity: "referral", entityId: id });
  writeAudit(staff, "referral.respond", "referral", id, status);
  return json({ ok: true });
}

const FILTERS = [{ id: "incoming", label: "Incoming" }, { id: "outgoing", label: "Sent by me" }, { id: "all", label: "All" }];

export default function Referrals() {
  const { rows, filter, canManage } = useLoaderData<typeof loader>();
  const [, setParams] = useSearchParams();
  const [respond, setRespond] = useState<any>(null);
  const fetcher = useFetcher();

  function quick(id: string, status: string) {
    const fd = new FormData(); fd.set("id", id); fd.set("status", status);
    fetcher.submit(fd, { method: "post" });
  }

  return (
    <div className="stack">
      <PageHeader title="Inter-department Referrals" sub="Consultation requests routed between departments and specialists." />
      <div className="pill-tabs">
        {FILTERS.map((x) => <button key={x.id} className={filter === x.id ? "on" : ""} onClick={() => setParams({ f: x.id })}>{x.label}</button>)}
      </div>

      {rows.length === 0 ? <Card><EmptyState icon="share" title="No referrals" body="Referrals sent to or from your department appear here." /></Card> : (
        <div className="stack">
          {rows.map((r: any) => (
            <Card key={r.id}>
              <div className="card-body between" style={{ alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div className="cluster">
                    <Badge tone="b-primary">{r.from_d ?? "—"}</Badge><Icon name="arrow-right" size={14} /><Badge tone="b-accent">{r.to_d}</Badge>
                    {r.priority === "urgent" && <Badge tone="b-danger">urgent</Badge>}
                    <Badge tone={STATUS_BADGE[r.status] ?? "b-muted"}>{r.status}</Badge>
                  </div>
                  <p style={{ margin: "10px 0 4px", fontWeight: 500 }}>{r.reason}</p>
                  <div className="meta cluster">
                    <Link to={`/patients/${r.pid}`} className="crumblink" style={{ color: "rgb(var(--primary))", fontWeight: 600 }}>{r.patient}</Link>
                    <span className="dim">from {r.from_s ?? "—"} · {relTime(r.created_at)}</span>
                  </div>
                  {r.response && <p className="mut-sm" style={{ marginTop: 8, paddingLeft: 12, borderLeft: "2px solid rgb(var(--line-strong))" }}><b>Response:</b> {r.response}</p>}
                </div>
                {canManage && r.status === "pending" && (
                  <div className="cluster">
                    <Button size="sm" onClick={() => quick(r.id, "accepted")}>Accept</Button>
                    <Button size="sm" variant="primary" onClick={() => setRespond(r)}>Complete</Button>
                    <Button size="sm" variant="danger" onClick={() => quick(r.id, "declined")}>Decline</Button>
                  </div>
                )}
                {canManage && r.status === "accepted" && <Button size="sm" variant="primary" onClick={() => setRespond(r)}>Complete</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {respond && (
        <Modal title="Complete referral" onClose={() => setRespond(null)}
          footer={<><Button variant="ghost" onClick={() => setRespond(null)}>Cancel</Button><Button variant="primary" form="resp" type="submit">Submit response</Button></>}>
          <fetcher.Form id="resp" method="post" onSubmit={() => setTimeout(() => setRespond(null), 50)}>
            <input type="hidden" name="id" value={respond.id} />
            <input type="hidden" name="status" value="completed" />
            <p className="mut-sm">{respond.reason}</p>
            <Field label="Consultation response" required><textarea name="response" rows={5} required placeholder="Findings, recommendations and plan for the referring team…" /></Field>
          </fetcher.Form>
        </Modal>
      )}
    </div>
  );
}
