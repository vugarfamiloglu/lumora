import { json, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useFetcher } from "@remix-run/react";
import { useState } from "react";
import db from "~/lib/db.server";
import { requireCap } from "~/lib/session.server";
import { newId } from "~/lib/ids.server";
import { writeAudit } from "~/lib/audit.server";
import { can } from "~/lib/rbac.server";
import { PageHeader, Card, Badge, Button, Kpi, Modal, Field } from "~/components/ui";
import { DataTable, type Column } from "~/components/DataTable";
import { money, dateShort, STATUS_BADGE } from "~/lib/format";

export const meta: MetaFunction = () => [{ title: "Billing · Lumora" }];
export const handle = { title: "Billing", crumb: "FINANCE" };

export async function loader({ request }: LoaderFunctionArgs) {
  const staff = await requireCap(request, "view_billing");
  const invoices = db.prepare(`SELECT i.*, p.full_name AS patient, p.id AS pid FROM invoices i JOIN patients p ON p.id=i.patient_id ORDER BY i.created_at DESC`).all() as any[];
  const k = {
    revenue: (db.prepare("SELECT COALESCE(SUM(paid),0) s FROM invoices").get() as any).s,
    outstanding: (db.prepare("SELECT COALESCE(SUM(total-paid),0) s FROM invoices WHERE status IN ('open','partial')").get() as any).s,
    open: (db.prepare("SELECT COUNT(*) c FROM invoices WHERE status IN ('open','partial')").get() as any).c,
  };
  return json({ invoices, k, canManage: can(staff.role, "manage_billing") });
}

export async function action({ request }: ActionFunctionArgs) {
  const staff = await requireCap(request, "manage_billing");
  const f = await request.formData();
  const id = String(f.get("id"));
  const amount = Number(f.get("amount")) || 0;
  const inv = db.prepare("SELECT total, paid FROM invoices WHERE id=?").get(id) as any;
  if (inv && amount > 0) {
    const paid = Math.min(inv.total, inv.paid + amount);
    db.prepare("INSERT INTO payments (id, invoice_id, amount, method) VALUES (?,?,?,?)").run(newId(), id, amount, String(f.get("method") || "card"));
    db.prepare("UPDATE invoices SET paid=?, status=? WHERE id=?").run(paid, paid >= inv.total ? "paid" : "partial", id);
    writeAudit(staff, "billing.payment", "invoice", id, String(amount));
  }
  return json({ ok: true });
}

export default function Billing() {
  const { invoices, k, canManage } = useLoaderData<typeof loader>();
  const [pay, setPay] = useState<any>(null);
  const fetcher = useFetcher();

  const cols: Column<any>[] = [
    { key: "number", header: "Invoice", width: 130, render: (i) => <span className="mono" style={{ fontWeight: 600 }}>{i.number}</span> },
    { key: "patient", header: "Patient", width: 190, render: (i) => <span>{i.patient}</span> },
    { key: "total", header: "Total", width: 110, align: "right", mono: true, render: (i) => money(i.total) },
    { key: "paid", header: "Paid", width: 110, align: "right", mono: true, render: (i) => money(i.paid) },
    { key: "payer", header: "Payer", width: 110, render: (i) => <span className="tag">{i.payer_type}</span> },
    { key: "status", header: "Status", width: 100, render: (i) => <Badge tone={STATUS_BADGE[i.status] ?? "b-muted"}>{i.status}</Badge> },
    { key: "date", header: "Date", width: 120, render: (i) => <span className="dim">{dateShort(i.created_at)}</span> },
    { key: "act", header: "", width: 120, align: "right", render: (i) => canManage && i.status !== "paid" ? <Button size="sm" onClick={() => setPay(i)}>Record payment</Button> : null },
  ];

  return (
    <div className="stack">
      <PageHeader title="Billing & Finance" sub="Patient invoices across self-pay, insurance and corporate payers." />
      <div className="grid-3">
        <Kpi label="Collected" value={money(k.revenue)} icon="receipt" tone="success" />
        <Kpi label="Outstanding" value={money(k.outstanding)} icon="alert" tone="warn" />
        <Kpi label="Open invoices" value={k.open} icon="file" tone="accent" />
      </div>
      <Card><DataTable columns={cols} rows={invoices} rowKey={(i) => i.id} empty={{ icon: "receipt", title: "No invoices" }} /></Card>

      {pay && (
        <Modal title={`Record payment · ${pay.number}`} onClose={() => setPay(null)}
          footer={<><Button variant="ghost" onClick={() => setPay(null)}>Cancel</Button><Button variant="primary" form="pay" type="submit">Record</Button></>}>
          <fetcher.Form id="pay" method="post" onSubmit={() => setTimeout(() => setPay(null), 50)}>
            <input type="hidden" name="id" value={pay.id} />
            <p className="mut-sm">Balance due: <b>{money(pay.total - pay.paid)}</b></p>
            <div className="form-grid">
              <Field label="Amount" required><input type="number" name="amount" step="0.01" defaultValue={(pay.total - pay.paid).toFixed(2)} required /></Field>
              <Field label="Method"><select name="method"><option value="card">Card</option><option value="cash">Cash</option><option value="insurance">Insurance</option><option value="transfer">Transfer</option></select></Field>
            </div>
          </fetcher.Form>
        </Modal>
      )}
    </div>
  );
}
