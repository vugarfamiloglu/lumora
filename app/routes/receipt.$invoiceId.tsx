import { json, type LoaderFunctionArgs, type LinksFunction, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import db from "~/lib/db.server";
import { requireStaff } from "~/lib/session.server";
import { hospitalSettings } from "~/lib/settings.server";
import { money, dateTime } from "~/lib/format";
import printStyles from "~/styles/print.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: printStyles }];
export const meta: MetaFunction = () => [{ title: "Receipt · Lumora" }];

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireStaff(request);
  const inv = db.prepare(`SELECT i.*, p.full_name AS patient, p.mrn FROM invoices i JOIN patients p ON p.id=i.patient_id WHERE i.id=?`).get(params.invoiceId) as any;
  if (!inv) throw new Response("Not found", { status: 404 });
  const items = db.prepare("SELECT description, qty, unit_price, amount FROM invoice_items WHERE invoice_id=?").all(inv.id) as any[];
  const payment = db.prepare("SELECT amount, method, created_at FROM payments WHERE invoice_id=? ORDER BY created_at DESC LIMIT 1").get(inv.id) as any;
  return json({ inv, items, payment, hospital: hospitalSettings() });
}

export default function Receipt() {
  const { inv, items, payment, hospital } = useLoaderData<typeof loader>();
  const cur = hospital.currency;
  return (
    <div className="doc-screen">
      <div className="print-actions no-print">
        <a href="/cashier" className="btn">← Cashier</a>
        <button className="btn primary" onClick={() => window.print()}>Print receipt</button>
      </div>
      <div className="doc" style={{ maxWidth: 520 }}>
        <div className="doc-head">
          <div className="doc-brand"><img src="/logo.svg" alt="" /><div><b>{hospital.name}</b><span>{hospital.accreditation}</span></div></div>
          <div className="meta"><div>Receipt</div><div className="mono">{inv.number}</div></div>
        </div>
        <div className="doc-grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 14 }}>
          <div><span className="k">Patient</span><div className="v">{inv.patient}</div></div>
          <div><span className="k">MRN</span><div className="v">{inv.mrn}</div></div>
          <div><span className="k">Date</span><div className="v">{dateTime(payment?.created_at ?? inv.created_at)}</div></div>
          <div><span className="k">Payer</span><div className="v" style={{ textTransform: "capitalize" }}>{inv.payer_type}</div></div>
        </div>
        <table className="doc-tbl">
          <thead><tr><th>Service</th><th style={{ textAlign: "right" }}>Qty</th><th style={{ textAlign: "right" }}>Price</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead>
          <tbody>
            {items.map((it: any, i: number) => (
              <tr key={i}><td>{it.description}</td><td className="num">{it.qty}</td><td className="num">{money(it.unit_price, cur)}</td><td className="num">{money(it.amount, cur)}</td></tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 16 }}>
          <div className="receipt-tot"><span className="muted">Subtotal</span><span className="num">{money(inv.total, cur)}</span></div>
          <div className="receipt-tot"><span className="muted">Paid ({payment?.method ?? "—"})</span><span className="num">{money(inv.paid, cur)}</span></div>
          <div className="receipt-tot grand"><span>Total</span><span className="num">{money(inv.total, cur)}</span></div>
        </div>
        <div className="doc-foot">Thank you for choosing {hospital.name}. This receipt confirms payment received. Get well soon.</div>
      </div>
    </div>
  );
}
