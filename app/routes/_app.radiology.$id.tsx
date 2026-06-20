import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import db from "~/lib/db.server";
import { requireCap, requireStaff } from "~/lib/session.server";
import { writeAudit } from "~/lib/audit.server";
import { can } from "~/lib/rbac.server";
import { Card, CardHead, Badge, Button, Field } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { dateTime, STATUS_BADGE } from "~/lib/format";

export const meta: MetaFunction = () => [{ title: "Study viewer · Lumora" }];
export const handle = { title: "Study Viewer", crumb: "PACS" };

export async function loader({ request, params }: LoaderFunctionArgs) {
  const staff = await requireCap(request, "view_radiology");
  const r = db.prepare(`SELECT rs.*, o.created_at, o.priority, p.full_name AS patient, p.mrn, p.id AS pid, st.full_name AS radiologist
    FROM rad_studies rs JOIN orders o ON o.id=rs.order_id JOIN encounters e ON e.id=o.encounter_id JOIN patients p ON p.id=e.patient_id
    LEFT JOIN staff st ON st.id=rs.radiologist_id WHERE rs.id=?`).get(params.id) as any;
  if (!r) throw new Response("Not found", { status: 404 });
  return json({ r, canReport: can(staff.role, "report_radiology") });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const staff = await requireCap(request, "report_radiology");
  const f = await request.formData();
  db.prepare("UPDATE rad_studies SET findings=?, impression=?, status='reported', radiologist_id=? WHERE id=?")
    .run(String(f.get("findings") ?? ""), String(f.get("impression") ?? ""), staff.id, params.id);
  const study = db.prepare("SELECT order_id FROM rad_studies WHERE id=?").get(params.id) as any;
  if (study) db.prepare("UPDATE orders SET status='validated', resulted_at=datetime('now') WHERE id=?").run(study.order_id);
  writeAudit(staff, "radiology.report", "rad_study", String(params.id));
  return redirect(`/radiology/${params.id}`);
}

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function Viewer({ seed, modality }: { seed: string; modality: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [win, setWin] = useState(50);   // contrast
  const [level, setLevel] = useState(50); // brightness
  const [zoom, setZoom] = useState(1);
  const [invert, setInvert] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const W = 480, H = 480;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const rnd = mulberry32(hash(seed));
    const img = ctx.createImageData(W, H);
    // a few soft "structures"
    const blobs = Array.from({ length: 5 }, () => ({ x: rnd() * W, y: rnd() * H, r: 50 + rnd() * 120, b: 30 + rnd() * 90 }));
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
        const vignette = 1 - Math.min(1, dx * dx + dy * dy) * 0.7;
        let v = 26 + 60 * vignette;
        v += 26 * Math.sin(x / 26 + rnd() * 0.02) * Math.cos(y / 34); // low-freq texture
        for (const b of blobs) { const d = Math.hypot(x - b.x, y - b.y); if (d < b.r) v += b.b * (1 - d / b.r); }
        v += (rnd() - 0.5) * 22; // grain
        const g = Math.max(0, Math.min(255, v));
        const i = (y * W + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = g; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [seed]);

  return (
    <div className="viewer">
      <div style={{ overflow: "hidden", display: "grid", placeItems: "center", background: "#07090f", padding: 12 }}
        onMouseDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; }}
        onMouseMove={(e) => { if (drag.current) setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) }); }}
        onMouseUp={() => (drag.current = null)} onMouseLeave={() => (drag.current = null)}>
        <canvas ref={ref} className="viewer-canvas" style={{
          maxWidth: "100%", filter: `brightness(${0.5 + level / 50}) contrast(${0.5 + win / 33}) ${invert ? "invert(1)" : ""}`,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: "filter .1s",
        }} />
      </div>
      <div className="viewer-bar">
        <span className="kbd">{modality}</span>
        <label className="dim" style={{ fontSize: 11 }}>W <input type="range" min={0} max={100} value={win} onChange={(e) => setWin(+e.target.value)} /></label>
        <label className="dim" style={{ fontSize: 11 }}>L <input type="range" min={0} max={100} value={level} onChange={(e) => setLevel(+e.target.value)} /></label>
        <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>Zoom +</Button>
        <Button size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>Zoom −</Button>
        <Button size="sm" variant="ghost" onClick={() => setInvert((v) => !v)}>Invert</Button>
        <Button size="sm" variant="ghost" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setWin(50); setLevel(50); setInvert(false); }}>Reset</Button>
        <span className="dim" style={{ marginLeft: "auto", fontSize: 11 }}>Drag to pan</span>
      </div>
    </div>
  );
}

export default function StudyViewer() {
  const { r, canReport } = useLoaderData<typeof loader>();
  return (
    <div className="stack">
      <div className="cluster"><Link to="/radiology" className="btn btn-ghost btn-sm"><Icon name="chevron-left" size={15} />Radiology</Link><span className="kicker">Study</span></div>
      <div className="bento">
        <Viewer seed={r.image_seed ?? r.id} modality={r.modality} />
        <div className="stack">
          <Card>
            <CardHead title={`${r.modality} · ${r.body_part}`} action={<Badge tone={STATUS_BADGE[r.status] ?? "b-muted"}>{r.status}</Badge>} />
            <div className="card-body">
              <dl className="def-list">
                <dt>Patient</dt><dd><Link to={`/patients/${r.pid}`} style={{ color: "rgb(var(--primary))" }}>{r.patient}</Link></dd>
                <dt>MRN</dt><dd className="mono">{r.mrn}</dd>
                <dt>Acquired</dt><dd>{dateTime(r.created_at)}</dd>
                <dt>Radiologist</dt><dd>{r.radiologist ?? "—"}</dd>
              </dl>
            </div>
          </Card>
          <Card>
            <CardHead title="Report" />
            <div className="card-body">
              {r.status === "reported" && !canReport ? (
                <dl className="def-list"><dt>Findings</dt><dd style={{ textAlign: "left" }}>{r.findings || "—"}</dd><dt>Impression</dt><dd style={{ textAlign: "left" }}>{r.impression || "—"}</dd></dl>
              ) : canReport ? (
                <Form method="post">
                  <Field label="Findings"><textarea name="findings" rows={4} defaultValue={r.findings ?? ""} placeholder="Describe the imaging findings…" /></Field>
                  <Field label="Impression" required><textarea name="impression" rows={2} defaultValue={r.impression ?? ""} required placeholder="Concise diagnostic impression…" /></Field>
                  <Button variant="primary" type="submit">{r.status === "reported" ? "Update report" : "Sign report"}</Button>
                </Form>
              ) : <p className="muted">Report pending.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
