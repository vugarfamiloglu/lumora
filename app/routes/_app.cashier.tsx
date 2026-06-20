import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { useMemo, useState } from "react";
import db from "~/lib/db.server";
import { requireCap } from "~/lib/session.server";
import { newId, invoiceNo } from "~/lib/ids.server";
import { writeAudit } from "~/lib/audit.server";
import { PageHeader, Card, CardHead, Button, Badge, Kpi } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { money, dateTime } from "~/lib/format";

export const meta: MetaFunction = () => [{ title: "Cashier · Lumora" }];
export const handle = { title: "Cashier", crumb: "FRONT OFFICE" };

export async function loader({ request }: LoaderFunctionArgs) {
  await requireCap(request, "manage_billing");
  const patients = db.prepare("SELECT id, full_name, mrn FROM patients WHERE is_anonymous=0 ORDER BY full_name").all() as any[];
  const services = db.prepare("SELECT id, name, category, price FROM service_catalog ORDER BY category, name").all() as any[];
  const recent = db.prepare(`SELECT i.id, i.number, i.total, i.paid, i.status, i.created_at, p.full_name AS patient FROM invoices i JOIN patients p ON p.id=i.patient_id ORDER BY i.created_at DESC LIMIT 8`).all() as any[];
  const today = (db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE date(created_at)=date('now')").get() as any).s;
  return json({ patients, services, recent, today });
}

export async function action({ request }: ActionFunctionArgs) {
  const staff = await requireCap(request, "manage_billing");
  const f = await request.formData();
  const patientId = String(f.get("patient_id"));
  let items: Array<{ name: string; price: number; qty: number; category: string }> = [];
  try { items = JSON.parse(String(f.get("items") ?? "[]")); } catch { items = []; }
  if (!patientId || items.length === 0) return json({ error: "Select a patient and at least one service." }, { status: 400 });
  const method = String(f.get("method") || "cash");
  const total = +items.reduce((a, b) => a + b.price * b.qty, 0).toFixed(2);
  const n = (db.prepare("SELECT COUNT(*) c FROM invoices").get() as any).c + 1;
  const id = newId();
  const patient = db.prepare("SELECT payer_type FROM patients WHERE id=?").get(patientId) as any;
  db.prepare("INSERT INTO invoices (id, number, patient_id, total, paid, payer_type, status) VALUES (?,?,?,?,?,?,'paid')")
    .run(id, invoiceNo(n), patientId, total, total, patient?.payer_type ?? "self");
  for (const it of items) db.prepare("INSERT INTO invoice_items (id, invoice_id, description, qty, unit_price, amount, source) VALUES (?,?,?,?,?,?,?)")
    .run(newId(), id, it.name, it.qty, it.price, +(it.price * it.qty).toFixed(2), it.category);
  db.prepare("INSERT INTO payments (id, invoice_id, amount, method) VALUES (?,?,?,?)").run(newId(), id, total, method);
  writeAudit(staff, "cashier.charge", "invoice", id, money(total));
  return redirect(`/receipt/${id}`);
}

interface CartItem { id: string; name: string; price: number; qty: number; category: string; }

export default function Cashier() {
  const { patients, services, recent, today } = useLoaderData<typeof loader>();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sel, setSel] = useState("");
  const total = useMemo(() => cart.reduce((a, b) => a + b.price * b.qty, 0), [cart]);

  function add() {
    const s = services.find((x: any) => x.id === sel);
    if (!s) return;
    setCart((c) => { const ex = c.find((x) => x.id === s.id); return ex ? c.map((x) => x.id === s.id ? { ...x, qty: x.qty + 1 } : x) : [...c, { id: s.id, name: s.name, price: s.price, qty: 1, category: s.category }]; });
  }
  const setQty = (id: string, q: number) => setCart((c) => c.map((x) => x.id === id ? { ...x, qty: Math.max(1, q) } : x));
  const remove = (id: string) => setCart((c) => c.filter((x) => x.id !== id));

  return (
    <div className="stack">
      <PageHeader title="Cashier" sub="Charge services, take payment and issue the patient receipt." />
      <div className="grid-3">
        <Kpi label="Collected today" value={money(today)} icon="receipt" tone="success" />
        <Kpi label="Services in catalog" value={services.length} icon="file" tone="accent" />
        <Kpi label="Items in cart" value={cart.length} icon="pill" />
      </div>

      <div className="bento">
        <Card>
          <CardHead title="New transaction" />
          <Form method="post" className="card-body">
            <div className="field"><label>Patient<span className="req">*</span></label>
              <select name="patient_id" required defaultValue="">
                <option value="" disabled>Select patient…</option>
                {patients.map((p: any) => <option key={p.id} value={p.id}>{p.full_name} · {p.mrn}</option>)}
              </select>
            </div>
            <div className="field"><label>Add service</label>
              <div className="cluster">
                <div className="select-wrap" style={{ flex: 1 }}>
                  <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--r-md)", border: "1px solid rgb(var(--line-strong))", background: "rgb(var(--paper))", color: "rgb(var(--ink))" }}>
                    <option value="">Choose a service…</option>
                    {services.map((s: any) => <option key={s.id} value={s.id}>{s.name} — {money(s.price)} ({s.category})</option>)}
                  </select>
                </div>
                <Button type="button" icon="plus" onClick={add}>Add</Button>
              </div>
            </div>

            <div className="list-rows" style={{ border: "1px solid rgb(var(--line))", borderRadius: "var(--r-md)", marginBottom: 16 }}>
              {cart.length === 0 && <div style={{ padding: 16 }}><span className="muted">No services added yet</span></div>}
              {cart.map((it) => (
                <div key={it.id} className="list-row">
                  <div className="spread"><b style={{ fontSize: 13.5 }}>{it.name}</b><span className="dim">{money(it.price)} each</span></div>
                  <div className="cluster">
                    <input type="number" value={it.qty} min={1} onChange={(e) => setQty(it.id, +e.target.value)} style={{ width: 56, padding: "5px 8px", borderRadius: 8, border: "1px solid rgb(var(--line-strong))", background: "rgb(var(--paper))", color: "rgb(var(--ink))" }} />
                    <span className="num" style={{ minWidth: 70, textAlign: "right" }}>{money(it.price * it.qty)}</span>
                    <button type="button" className="icon-btn plain" onClick={() => remove(it.id)} aria-label="Remove"><Icon name="x" size={15} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="between" style={{ marginBottom: 16 }}>
              <div className="field" style={{ margin: 0, flex: 1 }}><label>Payment method</label>
                <select name="method"><option value="cash">Cash</option><option value="card">Card</option><option value="insurance">Insurance</option><option value="transfer">Bank transfer</option></select>
              </div>
              <div style={{ textAlign: "right" }}><div className="kicker">Total due</div><div className="kpi-value">{money(total)}</div></div>
            </div>
            <input type="hidden" name="items" value={JSON.stringify(cart)} />
            <Button variant="primary" type="submit" icon="receipt" disabled={cart.length === 0}>Charge & print receipt</Button>
          </Form>
        </Card>

        <Card>
          <CardHead title="Recent receipts" />
          <div className="list-rows">
            {recent.length === 0 && <div className="card-body"><span className="muted">No transactions yet</span></div>}
            {recent.map((i: any) => (
              <a key={i.id} href={`/receipt/${i.id}`} target="_blank" rel="noreferrer" className="list-row click">
                <div className="spread"><b className="mono" style={{ fontSize: 13 }}>{i.number}</b><span className="mut-sm">{i.patient} · {dateTime(i.created_at)}</span></div>
                <div className="cluster"><span className="num">{money(i.total)}</span><Badge tone={i.status === "paid" ? "b-success" : "b-warn"}>{i.status}</Badge></div>
              </a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
