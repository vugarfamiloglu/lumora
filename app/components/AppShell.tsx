import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Form, NavLink, useFetcher, useMatches } from "@remix-run/react";
import { Icon } from "./Icon";
import { Avatar, Modal, Button, Field } from "./ui";
import { useConnected, useLive } from "./Live";
import { relTime } from "~/lib/format";
import type { Staff } from "~/lib/session.server";

export interface NavItem { to: string; label: string; icon: string; cap: string; countKey?: string; }
export interface NavGroup { group: string; items: NavItem[]; }

const NAV: NavGroup[] = [
  { group: "Clinical", items: [
    { to: "/dashboard", label: "Command Center", icon: "dashboard", cap: "view_command_dashboard" },
    { to: "/workspace", label: "My Workspace", icon: "stethoscope", cap: "order_clinical", countKey: "myResults" },
    { to: "/emergency", label: "Emergency", icon: "emergency", cap: "view_ed", countKey: "edRed" },
    { to: "/icu", label: "Critical Care", icon: "activity", cap: "view_icu", countKey: "icu" },
    { to: "/patients", label: "Patients", icon: "patients", cap: "view_patients" },
    { to: "/appointments", label: "Appointments", icon: "calendar", cap: "view_appointments" },
  ]},
  { group: "Care delivery", items: [
    { to: "/theatres", label: "Theatres", icon: "scalpel", cap: "view_ot" },
    { to: "/pharmacy", label: "Pharmacy", icon: "pill", cap: "view_pharmacy" },
    { to: "/lab", label: "Laboratory", icon: "flask", cap: "view_lab", countKey: "lab" },
    { to: "/radiology", label: "Radiology", icon: "scan", cap: "view_radiology" },
  ]},
  { group: "Coordination", items: [
    { to: "/referrals", label: "Referrals", icon: "share", cap: "view_referrals", countKey: "referrals" },
    { to: "/messages", label: "Messages", icon: "messages", cap: "message", countKey: "messages" },
  ]},
  { group: "Organization", items: [
    { to: "/staff", label: "Medical Staff", icon: "user-md", cap: "view_dashboard" },
    { to: "/departments", label: "Departments", icon: "departments", cap: "view_departments" },
  ]},
  { group: "Administration", items: [
    { to: "/cashier", label: "Cashier", icon: "receipt", cap: "manage_billing" },
    { to: "/billing", label: "Billing", icon: "file", cap: "view_billing" },
    { to: "/settings", label: "Settings", icon: "settings", cap: "manage_settings" },
    { to: "/audit", label: "Activity Log", icon: "audit", cap: "view_audit" },
  ]},
];

export interface ShellNotif { id: string; severity: string; title: string; body: string; createdAt: string; link?: string | null; }

interface Props {
  staff: Staff; hospital: string; caps: string[];
  counts: Record<string, number>; notifications: ShellNotif[]; children: ReactNode;
}

export function AppShell({ staff, hospital, caps, counts, notifications, children }: Props) {
  const matches = useMatches();
  const handle = [...matches].reverse().find((m) => (m.handle as any)?.title)?.handle as { title?: string; crumb?: string } | undefined;
  const can = (c: string) => caps.includes(c);

  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    setCollapsed(localStorage.getItem("lumora.collapsed") === "1");
    setTheme((document.documentElement.getAttribute("data-theme") as "light" | "dark") || "light");
  }, []);
  function toggleCollapse() { setCollapsed((c) => { localStorage.setItem("lumora.collapsed", c ? "0" : "1"); return !c; }); }
  function toggleTheme() {
    setTheme((t) => { const n = t === "light" ? "dark" : "light"; document.documentElement.setAttribute("data-theme", n); localStorage.setItem("lumora.theme", n); return n; });
  }

  // notifications (live)
  const [notifs, setNotifs] = useState<ShellNotif[]>(notifications);
  const [unread, setUnread] = useState(notifications.length);
  const [notifOpen, setNotifOpen] = useState(false);
  useLive("notification", (n: ShellNotif) => {
    if (n.title) { setNotifs((p) => [n, ...p].slice(0, 40)); setUnread((u) => u + 1); }
  });
  const notifRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // clock
  const [now, setNow] = useState("--:--");
  useEffect(() => {
    const t = () => setNow(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
    t(); const i = setInterval(t, 10000); return () => clearInterval(i);
  }, []);
  const connected = useConnected();

  // global search
  const search = useFetcher<{ results: Array<{ kind: string; id: string; label: string; sub: string; to: string }> }>();
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current);
    if (!q.trim()) return;
    tRef.current = setTimeout(() => search.load(`/api/search?q=${encodeURIComponent(q.trim())}`), 220);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const pwFetcher = useFetcher<{ ok?: boolean; error?: string }>();
  useEffect(() => { if (pwFetcher.data?.ok) setPwOpen(false); }, [pwFetcher.data]);

  const groups = useMemo(() => NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(i.cap)) })).filter((g) => g.items.length), [caps]);

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <aside className="side">
        <div className="brand">
          <img className="brand-logo" src="/logo.svg" alt="Lumora" />
          <span className="brand-word"><b>Lumora</b><span>{hospital}</span></span>
        </div>
        <nav className="nav">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="nav-group">{g.group}</div>
              {g.items.map((i) => {
                const count = i.countKey ? counts[i.countKey] : 0;
                return (
                  <NavLink key={i.to} to={i.to} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} title={i.label}>
                    <Icon name={i.icon} size={18} /><span>{i.label}</span>
                    {count > 0 && <span className="nav-count">{count}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <button className="collapse-bar" onClick={toggleCollapse} aria-label="Toggle sidebar">
            <Icon name="chevron-left" size={16} /><span>Collapse</span>
          </button>
        </div>
      </aside>

      <header className="top">
        <div className="top-title">
          <span className="crumb">{handle?.crumb ?? "Lumora"}</span>
          <h1>{handle?.title ?? "Dashboard"}</h1>
        </div>
        <div className="search">
          <Icon name="search" size={16} />
          <input value={q} placeholder="Search patients, staff…" onChange={(e) => { setQ(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)} onBlur={() => setTimeout(() => setSearchOpen(false), 160)} />
          {searchOpen && q.trim() && search.data?.results && search.data.results.length > 0 && (
            <div className="search-pop">
              {search.data.results.map((r) => (
                <NavLink key={r.kind + r.id} to={r.to} onMouseDown={() => { setQ(""); setSearchOpen(false); }}>
                  <Icon name={r.kind === "patient" ? "patients" : "user-md"} size={15} />
                  <b>{r.label}</b><span className="dim">{r.sub}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>
        <div className="top-right">
          <div className="clock"><span className="dot" style={{ background: connected ? undefined : "rgb(var(--faint))" }} />{now}</div>
          <div className="notif-wrap" ref={notifRef}>
            <button className="icon-btn" onClick={() => { setNotifOpen((o) => !o); setUnread(0); }} aria-label="Notifications">
              <Icon name="bell" size={17} />
              {unread > 0 && <span className="badge-dot">{unread > 9 ? "9+" : unread}</span>}
            </button>
            {notifOpen && (
              <div className="notif-pop">
                <div className="head"><b>Notifications</b></div>
                <div className="list">
                  {notifs.length === 0 && <div className="notif-row"><span className="muted">No notifications</span></div>}
                  {notifs.slice(0, 20).map((n, i) => (
                    <div key={n.id ?? i} className="notif-row">
                      <span className={`notif-sev ${n.severity}`} />
                      <div className="notif-body"><b>{n.title}</b>{n.body && <span>{n.body}</span>}<time>{relTime(n.createdAt)}</time></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={toggleTheme} aria-label="Theme"><Icon name={theme === "dark" ? "sun" : "moon"} size={17} /></button>
          <div className="user">
            <Avatar name={staff.fullName} color={staff.photoColor} src={staff.photoUrl} size={34} />
            <div className="user-text"><b>{staff.fullName}</b><span>{staff.title ?? staff.role}</span></div>
            <button className="icon-btn plain" onClick={() => setPwOpen(true)} aria-label="Change password" title="Change password"><Icon name="key" size={17} /></button>
            <button className="icon-btn plain" onClick={() => setLogoutOpen(true)} aria-label="Sign out" title="Sign out"><Icon name="logout" size={17} /></button>
          </div>
        </div>
      </header>

      <main className="work"><div className="work-inner">{children}</div></main>

      {logoutOpen && (
        <Modal title="Sign out?" onClose={() => setLogoutOpen(false)}
          footer={<>
            <Button variant="ghost" onClick={() => setLogoutOpen(false)}>Cancel</Button>
            <Form method="post" action="/logout"><Button variant="danger" type="submit">Sign out</Button></Form>
          </>}>
          <p className="muted">You'll need to sign in again to access the clinical workspace.</p>
        </Modal>
      )}

      {pwOpen && (
        <Modal title="Change my password" onClose={() => setPwOpen(false)}
          footer={<>
            <Button variant="ghost" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button variant="primary" form="pwform" type="submit" disabled={pwFetcher.state !== "idle"}>
              {pwFetcher.state !== "idle" ? "Updating…" : "Update password"}
            </Button>
          </>}>
          <pwFetcher.Form id="pwform" method="post" action="/account/password">
            <p className="muted" style={{ marginTop: 0 }}>Update the password the administrator gave you. This only changes your own account.</p>
            {pwFetcher.data?.error && <p className="form-error">{pwFetcher.data.error}</p>}
            <Field label="Current password" required>
              <input type="password" name="current" autoComplete="current-password" required />
            </Field>
            <Field label="New password" required hint="At least 6 characters.">
              <input type="password" name="password" autoComplete="new-password" minLength={6} required />
            </Field>
            <Field label="Confirm new password" required>
              <input type="password" name="confirm" autoComplete="new-password" minLength={6} required />
            </Field>
          </pwFetcher.Form>
        </Modal>
      )}
    </div>
  );
}
