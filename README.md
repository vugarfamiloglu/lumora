# Lumora — Hospital Operating System

**Lumora** is a JCI-aligned Hospital Management System (HMS): one clinical command
center connecting the emergency department, critical care, wards, operating theatres,
diagnostics, pharmacy and billing — end to end.

The signature surface is a **live critical-care monitor**: a bedside-monitor simulator
streams vitals over Server-Sent Events, so ICU/CCU/NICU tiles update in real time with
animated ECG traces, NEWS2 scores and automatic alarms.

---

## Highlights

- **Live critical care** — real-time ICU/CCU/NICU board (SSE) with animated ECG waveforms,
  HR / NIBP / SpO₂ / RR / Temp, NEWS2 scoring and out-of-range alarms that raise ward alerts.
- **Emergency department** — triage board with Red / Yellow / Green zones, arrival
  registration (including unidentified / anonymous patients with a provisional MRN), and
  re-triage.
- **30 clinical departments**, each led by a head and staffed by a specialist team —
  157 physicians in total with detailed, photo-illustrated profiles (qualifications,
  experience, languages, clinic schedule, patient panel and ratings).
- **End-to-end clinical workflow** — a physician examines a patient, orders lab tests and
  imaging from the chart, the laboratory processes and validates them, and the results land
  on the ordering doctor's **personal workspace**; the doctor can present a professional,
  printable results report to the patient, order more tests, and book the next appointment.
- **Cashier (front office)** — charge consultations, lab panels, procedures and packages
  from a service catalog, take payment by cash / card / insurance, and issue a printable
  patient **receipt**. 48-analyte lab catalog and 37-line service catalog.
- **Electronic Medical Record** — per-patient record with encounters, lab & imaging results
  (flagged), medications, clinical notes, referrals and billing in one tabbed chart, with
  in-chart order entry and appointment booking.
- **Inter-department referrals** — consultation requests routed between departments and
  specialists, with accept / decline / complete workflows and live notifications.
- **Secure messaging** — direct clinical conversations between staff and care teams.
- **Rich physician profiles** — qualifications, experience, languages, clinic schedule,
  patient panel and activity, with specialty and department context.
- **Laboratory (LIS)** — specimen worklist with two-step technical and clinical validation
  and critical-result alerts.
- **Radiology (RIS / PACS-lite)** — imaging worklist and an in-browser study viewer with
  window/level, zoom, pan and invert, plus structured reporting.
- **Pharmacy** — prescription verification and dispensing, drug-interaction warnings and
  stock control with reorder alerts.
- **Operating theatres** — scheduling and the WHO surgical safety checklist (sign-in,
  time-out, sign-out, instrument & swab counts).
- **Billing** — patient invoices across self-pay, insurance and corporate payers with
  payment capture.
- **Departments, appointments, settings & audit** — department directory with live census,
  clinic scheduling, hospital profile + AES-256-GCM vaulted provider secrets, and an
  immutable audit trail.
- **9-role RBAC**, dark / night-shift theme, resizable tables, global search, and a live
  notification center.

---

## Tech stack

| Layer      | Choice |
|------------|--------|
| Framework  | Remix (Vite) + React 18 + TypeScript |
| Database   | better-sqlite3 (WAL), single file under `data/` |
| Realtime   | Server-Sent Events (resource route) + in-process event bus |
| Auth       | Remix cookie sessions + bcrypt |
| Secrets    | AES-256-GCM vault (`data/.vault-key`, auto-generated) |
| Charts     | Recharts |
| Design     | Custom CSS "Meridian Clinical" design system |

No external keys are required to run the demo.

---

## Getting started

```bash
npm install        # install deps (compiles better-sqlite3)
npm run seed       # seed a realistic hospital (Lumora Medical Center)
npm run build      # production build
PORT=5800 npm start
# → http://localhost:5800
```

Development with hot reload:

```bash
npm run dev        # Vite dev server on :5800
```

### Demo logins

All accounts use the password **`Lumora2026!`**.

| Role            | Email                        |
|-----------------|------------------------------|
| Administrator   | `admin@lumora.health`        |
| Cardiologist    | `card1@lumora.health`        |
| Intensivist     | `icu1@lumora.health`         |
| ED physician    | `ed1@lumora.health`          |
| Lab scientist   | `lab1@lumora.health`         |
| Radiologist     | `rad1@lumora.health`         |
| Pharmacist      | `pharm1@lumora.health`       |
| Reception       | `recep1@lumora.health`       |

Each role sees a capability-scoped workspace (RBAC).

---

## Configuration

Copy `.env.example` to `.env` (defaults are baked in, so the demo runs with an empty file).

| Variable                | Purpose | Default |
|-------------------------|---------|---------|
| `PORT`                  | HTTP port | `5800` |
| `SESSION_SECRET`        | Cookie session secret | generated to `data/.session-key` |
| `VAULT_KEY`             | AES-256-GCM master key (hex) | generated to `data/.vault-key` |
| `VITALS_TICK_SECONDS`   | Live monitor tick | `2` |
| `SEED_ADMIN_EMAIL`      | Seed admin email | `admin@lumora.health` |
| `SEED_ADMIN_PASSWORD`   | Seed admin password | `Lumora2026!` |

---

## Architecture

```
app/
├── lib/
│   ├── db.server.ts        Schema + better-sqlite3 (WAL)
│   ├── rbac.server.ts      9-role capability matrix
│   ├── session.server.ts   Cookie sessions + bcrypt + requireCap()
│   ├── vault.server.ts     AES-256-GCM secret encryption
│   ├── events.server.ts    SSE event bus + notifications
│   ├── vitals.server.ts     Live bedside-monitor simulator
│   ├── settings.server.ts  Hospital profile + vaulted secrets
│   ├── audit.server.ts     Audit trail
│   └── format.ts           Client-safe formatting + status maps
├── components/             AppShell, Live (SSE), Icon, DataTable, Charts, ui
├── routes/
│   ├── _app.tsx            Authenticated layout (shell + live + nav counts)
│   ├── _app.dashboard.tsx  Command dashboard
│   ├── _app.emergency.tsx  ED triage board
│   ├── _app.icu.tsx        Live critical-care monitor
│   ├── _app.patients.*     Registry + EMR
│   ├── _app.staff.*        Directory + physician profile
│   ├── _app.lab / radiology / pharmacy / theatres
│   ├── _app.referrals / messages / billing / appointments
│   ├── _app.departments / settings / audit
│   ├── api.events.tsx      SSE stream
│   ├── api.search.tsx      Global search
│   └── login / logout
db/seed.ts                  Realistic hospital seed
```

### Security

- Capability checks (`requireCap`) on every protected route; the client mirror only hides
  controls a role can't use.
- Cookie sessions are `httpOnly`, `sameSite=lax`.
- Provider secrets are AES-256-GCM encrypted at rest and never returned to the browser.
- All inputs validated at the route boundary; parameterized SQL throughout.

> Lumora is a demonstration system and is **not** a certified medical device. It is not
> intended for real clinical use or to store real protected health information.

---

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE).
