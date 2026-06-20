import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import db from "~/lib/db.server";
import { requireCap } from "~/lib/session.server";
import { useLive } from "~/components/Live";
import { Kpi, EmptyState } from "~/components/ui";
import { Icon } from "~/components/Icon";

export const meta: MetaFunction = () => [{ title: "Critical Care · Lumora" }];
export const handle = { title: "Critical Care", crumb: "ICU · CCU · NICU" };

export async function loader({ request }: LoaderFunctionArgs) {
  await requireCap(request, "view_icu");
  const rows = db.prepare(`SELECT e.id, p.full_name AS patient, b.label AS bed, d.name AS dept, e.chief_complaint
    FROM encounters e JOIN departments d ON d.id=e.department_id JOIN patients p ON p.id=e.patient_id
    LEFT JOIN beds b ON b.id=e.bed_id WHERE e.status='admitted' AND d.kind IN ('icu','ccu','nicu') ORDER BY d.name, b.label`).all() as any[];
  const latest = db.prepare(`SELECT hr, bp_sys, bp_dia, spo2, resp, temp, news2 FROM vitals WHERE encounter_id=? ORDER BY captured_at DESC LIMIT 1`);
  const beds = rows.map((r) => {
    const v = (latest.get(r.id) as any) ?? { hr: 80, bp_sys: 120, bp_dia: 75, spo2: 97, resp: 16, temp: 36.8, news2: 1 };
    return { encounterId: r.id, patient: r.patient, bed: r.bed, dept: r.dept, complaint: r.chief_complaint,
      hr: v.hr, bpSys: v.bp_sys, bpDia: v.bp_dia, spo2: v.spo2, resp: v.resp, temp: v.temp, news2: v.news2 };
  });
  const free = (db.prepare(`SELECT COUNT(*) c FROM beds b JOIN departments d ON d.id=b.department_id WHERE d.kind IN ('icu','ccu','nicu') AND b.status='available'`).get() as any).c;
  return json({ beds, free });
}

const ECG = "M0 28 H30 l3 -2 l2 4 l3 -3 H40 l2 0 l2 7 l2 -22 l2 30 l2 -16 l2 3 H62 q6 0 9 -8 q3 12 6 0 H100 H130 l3 -2 l2 4 l3 -3 H140 l2 0 l2 7 l2 -22 l2 30 l2 -16 l2 3 H162 q6 0 9 -8 q3 12 6 0 H200";

interface V { encounterId: string; patient: string; bed: string; dept: string; complaint: string; hr: number; bpSys: number; bpDia: number; spo2: number; resp: number; temp: number; news2: number; }
const crit = { hr: (v: number) => v > 140 || v < 40, spo2: (v: number) => v < 90, bp: (v: number) => v < 90 || v > 200, resp: (v: number) => v > 30 || v < 8, temp: (v: number) => v > 39.5 };
const newsClass = (n: number) => (n >= 5 ? "news-2" : n >= 3 ? "news-1" : "news-0");

function Tile({ v }: { v: V }) {
  const alarm = crit.hr(v.hr) || crit.spo2(v.spo2) || crit.bp(v.bpSys) || crit.resp(v.resp) || crit.temp(v.temp);
  const waveColor = alarm ? "rgb(var(--danger))" : "rgb(var(--success))";
  const dur = `${Math.max(0.45, 60 / Math.max(35, v.hr)).toFixed(2)}s`;
  return (
    <div className={`vtile ${alarm ? "alarm" : ""}`}>
      <div className="vtile-head">
        <div className="who"><b>{v.patient}</b><br /><span>{v.bed ?? "—"} · {v.dept}</span></div>
        <span className={`news-badge ${newsClass(v.news2)}`}>NEWS {v.news2}</span>
      </div>
      <div className="wave">
        <svg viewBox="0 0 200 46" preserveAspectRatio="none" className="ecg" style={{ animationDuration: dur }}>
          <path d={ECG} fill="none" stroke={waveColor} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
      <div className="vnums">
        <div className={`vnum hr ${crit.hr(v.hr) ? "crit" : ""}`}><div className="n">{v.hr}</div><div className="u">HR bpm</div></div>
        <div className={`vnum ${crit.bp(v.bpSys) ? "crit" : ""}`}><div className="n">{v.bpSys}/{v.bpDia}</div><div className="u">NIBP</div></div>
        <div className={`vnum spo2 ${crit.spo2(v.spo2) ? "crit" : ""}`}><div className="n">{v.spo2}</div><div className="u">SpO₂ %</div></div>
        <div className={`vnum ${crit.resp(v.resp) ? "crit" : ""}`}><div className="n">{v.resp}</div><div className="u">RR /min</div></div>
        <div className={`vnum ${crit.temp(v.temp) ? "crit" : ""}`}><div className="n">{v.temp.toFixed(1)}</div><div className="u">Temp °C</div></div>
      </div>
    </div>
  );
}

export default function ICU() {
  const { beds, free } = useLoaderData<typeof loader>();
  const [map, setMap] = useState<Record<string, V>>(() => Object.fromEntries(beds.map((b) => [b.encounterId, b as V])));

  useLive("vitals", (arr: any[]) => {
    setMap((prev) => {
      const next = { ...prev };
      for (const u of arr) {
        const cur = next[u.encounterId];
        if (cur) next[u.encounterId] = { ...cur, hr: u.hr, bpSys: u.bpSys, bpDia: u.bpDia, spo2: u.spo2, resp: u.resp, temp: u.temp, news2: u.news2 };
      }
      return next;
    });
  });

  const tiles = beds.map((b) => map[b.encounterId] ?? (b as V));
  const alarms = tiles.filter((v) => crit.hr(v.hr) || crit.spo2(v.spo2) || crit.bp(v.bpSys) || crit.resp(v.resp) || crit.temp(v.temp)).length;

  return (
    <div className="stack">
      <div className="between" style={{ alignItems: "flex-start" }}>
        <div><h1 className="page-title">Critical Care</h1><p className="page-sub">Live bedside monitoring across ICU, CCU and NICU. Readings stream in real time.</p></div>
      </div>
      <div className="grid-4">
        <Kpi label="Monitored beds" value={tiles.length} icon="activity" tone="pulse" />
        <Kpi label="Active alarms" value={alarms} icon="alert" tone={alarms ? "warn" : "success"} delta={alarms ? "Review now" : "All stable"} />
        <Kpi label="Free critical beds" value={free} icon="bed" />
        <Kpi label="Mean NEWS2" value={(tiles.reduce((a, v) => a + v.news2, 0) / Math.max(1, tiles.length)).toFixed(1)} icon="heart" tone="accent" />
      </div>

      {tiles.length === 0 ? <EmptyState icon="activity" title="No patients under critical care" /> : (
        <div className="vitals-grid">{tiles.map((v) => <Tile key={v.encounterId} v={v} />)}</div>
      )}

      <p className="dim center"><Icon name="activity" size={13} /> Readings update every 2 seconds via a bedside-monitor feed. Out-of-range values trigger ward alarms.</p>
    </div>
  );
}
