import db from "./db.server";
import { newId } from "./ids.server";
import { emit, notify } from "./events.server";

// Bedside-monitor simulator. Emits a live reading for every critical-care patient each
// tick (ephemeral, for the board), persists a charted row periodically, and raises
// alarms when a value crosses into a critical range.
const TICK = Math.max(1, Number(process.env.VITALS_TICK_SECONDS) || 2);

interface Live { hr: number; bpSys: number; bpDia: number; spo2: number; resp: number; temp: number; alarming: boolean; }
const state = new Map<string, Live>();
let ticks = 0;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const walk = (v: number, step: number, lo: number, hi: number) => clamp(Math.round((v + (Math.random() - 0.5) * step) * 10) / 10, lo, hi);

function baseline(id: string): Live {
  const n = parseInt(id.slice(-4), 36);
  return {
    hr: 70 + (n % 25), bpSys: 110 + (n % 30), bpDia: 65 + (n % 20),
    spo2: 95 + (n % 4), resp: 14 + (n % 6), temp: 36.6 + ((n % 12) / 10), alarming: false,
  };
}

function news2(v: Live): number {
  let s = 0;
  if (v.resp <= 8 || v.resp >= 25) s += 3; else if (v.resp >= 21) s += 2; else if (v.resp <= 11) s += 1;
  if (v.spo2 <= 91) s += 3; else if (v.spo2 <= 93) s += 2; else if (v.spo2 <= 95) s += 1;
  if (v.bpSys <= 90 || v.bpSys >= 220) s += 3; else if (v.bpSys <= 100) s += 2; else if (v.bpSys <= 110) s += 1;
  if (v.hr <= 40 || v.hr >= 131) s += 3; else if (v.hr >= 111) s += 2; else if (v.hr >= 91 || v.hr <= 50) s += 1;
  if (v.temp <= 35 || v.temp >= 39.1) s += 2; else if (v.temp >= 38.1 || v.temp <= 36) s += 1;
  return s;
}

function isCritical(v: Live): boolean {
  return v.spo2 < 90 || v.hr > 140 || v.hr < 40 || v.bpSys < 90 || v.bpSys > 200 || v.resp > 30 || v.resp < 8 || v.temp > 39.5;
}

function tick() {
  ticks++;
  const rows = db.prepare(`SELECT e.id, e.patient_id, p.full_name, b.label AS bed, d.name AS dept
    FROM encounters e
    JOIN departments d ON d.id = e.department_id
    JOIN patients p ON p.id = e.patient_id
    LEFT JOIN beds b ON b.id = e.bed_id
    WHERE e.status IN ('admitted','in_progress') AND d.kind IN ('icu','ccu','nicu')`).all() as any[];

  const live: any[] = [];
  for (const r of rows) {
    let v = state.get(r.id);
    if (!v) { v = baseline(r.id); state.set(r.id, v); }
    v = {
      hr: Math.round(walk(v.hr, 4, 35, 180)),
      bpSys: Math.round(walk(v.bpSys, 5, 70, 210)),
      bpDia: Math.round(walk(v.bpDia, 4, 40, 130)),
      spo2: Math.round(walk(v.spo2, 1.4, 80, 100)),
      resp: Math.round(walk(v.resp, 2, 6, 38)),
      temp: walk(v.temp, 0.2, 34.5, 41),
      alarming: false,
    };
    const crit = isCritical(v);
    if (crit && !state.get(r.id)?.alarming) {
      notify({ scope: "icu", targetRole: "nurse", severity: "critical",
        title: `Critical vitals · ${r.full_name}`, body: `${r.dept} ${r.bed ?? ""} — review immediately`,
        entity: "encounter", entityId: r.id, link: `/icu` });
    }
    v.alarming = crit;
    state.set(r.id, v);
    const score = news2(v);
    live.push({ encounterId: r.id, patient: r.full_name, bed: r.bed, dept: r.dept,
      ...v, news2: score, ts: new Date().toISOString() });

    // Chart a persisted reading roughly every 20s.
    if (ticks % Math.max(1, Math.round(20 / TICK)) === 0) {
      db.prepare(`INSERT INTO vitals (id, encounter_id, hr, bp_sys, bp_dia, spo2, resp, temp, news2, source)
        VALUES (?,?,?,?,?,?,?,?,?,'monitor')`).run(newId(), r.id, v.hr, v.bpSys, v.bpDia, v.spo2, v.resp, v.temp, score);
    }
  }
  if (live.length) emit("vitals", live);
}

// Guard against double-start under Remix Vite HMR.
declare global { var __lumoraVitals: ReturnType<typeof setInterval> | undefined; }
export function startVitals(): void {
  if (global.__lumoraVitals) return;
  global.__lumoraVitals = setInterval(tick, TICK * 1000);
}
