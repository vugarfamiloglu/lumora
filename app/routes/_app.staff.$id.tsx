import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import db from "~/lib/db.server";
import { requireStaff } from "~/lib/session.server";
import { Card, CardHead, Badge, Avatar, EmptyState } from "~/components/ui";
import { Icon } from "~/components/Icon";
import { jsonArr, dateShort, dateTime, money, STATUS_BADGE } from "~/lib/format";

export const meta: MetaFunction = () => [{ title: "Staff profile · Lumora" }];
export const handle = { title: "Staff Profile", crumb: "DIRECTORY" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireStaff(request);
  const s = db.prepare(`SELECT st.*, d.name AS dept, d.kind AS dept_kind FROM staff st LEFT JOIN departments d ON d.id=st.department_id WHERE st.id=?`).get(params.id) as any;
  if (!s) throw new Response("Not found", { status: 404 });
  const schedules = db.prepare("SELECT * FROM schedules WHERE staff_id=? ORDER BY weekday, start_min").all(s.id) as any[];
  const patients = db.prepare(`SELECT e.id, e.chief_complaint, e.type, e.status, e.created_at, p.full_name, p.id AS pid
    FROM encounters e JOIN patients p ON p.id=e.patient_id WHERE e.attending_id=? ORDER BY e.created_at DESC LIMIT 12`).all(s.id) as any[];
  const stats = {
    encounters: (db.prepare("SELECT COUNT(*) c FROM encounters WHERE attending_id=?").get(s.id) as any).c,
    patients: (db.prepare("SELECT COUNT(DISTINCT patient_id) c FROM encounters WHERE attending_id=?").get(s.id) as any).c,
    appointments: (db.prepare("SELECT COUNT(*) c FROM appointments WHERE staff_id=? AND status IN ('booked','arrived')").get(s.id) as any).c,
    referrals: (db.prepare("SELECT COUNT(*) c FROM referrals WHERE to_staff_id=?").get(s.id) as any).c,
  };
  return json({ s, schedules, patients, stats });
}

const TABS = [
  { id: "overview", label: "Overview", icon: "user-md" },
  { id: "quals", label: "Qualifications", icon: "audit" },
  { id: "experience", label: "Experience", icon: "departments" },
  { id: "schedule", label: "Schedule", icon: "calendar" },
  { id: "patients", label: "Patients", icon: "patients" },
];

export default function StaffProfile() {
  const { s, schedules, patients, stats } = useLoaderData<typeof loader>();
  const [params] = useSearchParams();
  const tab = params.get("tab") ?? "overview";
  const quals = jsonArr<{ degree: string; institution: string; year: number }>(s.qualifications);
  const exp = jsonArr<{ role: string; place: string; from: string; to: string }>(s.experience);
  const langs = jsonArr<string>(s.languages);

  return (
    <div className="stack">
      <div className="cluster"><Link to="/staff" className="btn btn-ghost btn-sm"><Icon name="chevron-left" size={15} />Directory</Link><span className="kicker">Medical staff</span></div>

      <Card>
        <div className="profile-head">
          <Avatar name={s.full_name} color={s.photo_color} size={76} />
          <div className="profile-id" style={{ flex: 1 }}>
            <div className="cluster"><h1>{s.full_name}</h1>{s.specialty && <Badge tone="b-primary">{s.specialty}</Badge>}{s.status === "active" && <Badge tone="b-success">active</Badge>}</div>
            <div className="meta">
              <span>{s.title}</span><span className="tag">{s.dept ?? "—"}</span>
              {s.subspecialty && <span className="tag">{s.subspecialty}</span>}
              {langs.length > 0 && <span><Icon name="messages" size={12} /> {langs.join(", ")}</span>}
            </div>
          </div>
          <div className="right">
            {s.consult_fee > 0 && <><div className="kpi-value">{money(s.consult_fee)}</div><span className="dim">consultation</span></>}
          </div>
        </div>
        <div className="profile-stats">
          <div className="pstat"><div className="v num">{stats.patients}</div><div className="l">Patients</div></div>
          <div className="pstat"><div className="v num">{stats.encounters}</div><div className="l">Encounters</div></div>
          <div className="pstat"><div className="v num">{stats.appointments}</div><div className="l">Upcoming appts</div></div>
          <div className="pstat"><div className="v num">{stats.referrals}</div><div className="l">Referrals</div></div>
        </div>
      </Card>

      <Card>
        <div className="tabbar">
          {TABS.map((t) => <Link key={t.id} to={`?tab=${t.id}`} className={tab === t.id ? "on" : ""}><Icon name={t.icon} size={15} />{t.label}</Link>)}
        </div>

        {tab === "overview" && (
          <div className="card-body grid-2">
            <div>
              <h4 style={{ fontFamily: "var(--font-display)", margin: "0 0 8px" }}>About</h4>
              <p className="mut-sm" style={{ lineHeight: 1.65 }}>{s.bio || "No biography on file."}</p>
            </div>
            <dl className="def-list">
              <dt>Staff no.</dt><dd className="mono">{s.staff_no}</dd>
              <dt>Email</dt><dd>{s.email}</dd>
              <dt>Phone</dt><dd className="mono">{s.phone ?? "—"}</dd>
              <dt>Room</dt><dd>{s.room ?? "—"}</dd>
              <dt>License</dt><dd className="mono">{s.license_no ?? "—"}</dd>
              <dt>License expiry</dt><dd>{dateShort(s.license_expiry)}</dd>
              <dt>Languages</dt><dd>{langs.join(", ") || "—"}</dd>
            </dl>
          </div>
        )}

        {tab === "quals" && (
          <div className="list-rows">
            {quals.length === 0 ? <div className="card-body"><EmptyState icon="audit" title="No qualifications on file" /></div> : quals.map((q, i) => (
              <div key={i} className="list-row">
                <div className="spread"><b style={{ fontSize: 13.5 }}>{q.degree}</b><span className="mut-sm">{q.institution}</span></div>
                <span className="tag">{q.year}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "experience" && (
          <div className="card-body"><div className="timeline">
            {exp.length === 0 ? <span className="muted">No experience recorded</span> : exp.map((e, i) => (
              <div key={i} className="tl-item"><span className="tl-dot" />
                <div className="between"><b style={{ fontSize: 13.5 }}>{e.role}</b><span className="dim">{e.from} – {e.to}</span></div>
                <span className="mut-sm">{e.place}</span>
              </div>
            ))}
          </div></div>
        )}

        {tab === "schedule" && (
          <div className="card-body">
            {schedules.length === 0 ? <EmptyState icon="calendar" title="No clinic schedule" /> : (
              <div className="grid-3">
                {schedules.map((sc: any) => (
                  <div key={sc.id} className="pstat">
                    <div className="v" style={{ fontSize: 15 }}>{DAYS[sc.weekday]}</div>
                    <div className="l">{hm(sc.start_min)} – {hm(sc.end_min)} · {sc.room ?? "—"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "patients" && (
          <div className="list-rows">
            {patients.length === 0 ? <div className="card-body"><EmptyState icon="patients" title="No patients" /></div> : patients.map((e: any) => (
              <Link key={e.id} to={`/patients/${e.pid}`} className="list-row click">
                <div className="spread"><b style={{ fontSize: 13.5 }}>{e.full_name}</b><span className="mut-sm">{e.chief_complaint} · {e.type}</span></div>
                <div className="cluster"><span className="dim">{dateTime(e.created_at)}</span><Badge tone={STATUS_BADGE[e.status] ?? "b-muted"}>{e.status.replace("_", " ")}</Badge></div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
