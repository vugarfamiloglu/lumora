import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import db from "~/lib/db.server";
import { requireStaff } from "~/lib/session.server";
import { MATRIX, type Role } from "~/lib/rbac.server";
import { hospitalSettings } from "~/lib/settings.server";
import { startVitals } from "~/lib/vitals.server";
import { AppShell } from "~/components/AppShell";
import { LiveProvider } from "~/components/Live";
import { ToastProvider } from "~/components/ui";

const n = (sql: string, ...p: unknown[]) => (db.prepare(sql).get(...p) as { c: number }).c;

export async function loader({ request }: LoaderFunctionArgs) {
  const staff = await requireStaff(request);
  startVitals();
  const caps = MATRIX[staff.role as Role] ?? [];

  const counts = {
    edRed: n(`SELECT COUNT(*) c FROM encounters e JOIN departments d ON d.id=e.department_id WHERE d.kind='ed' AND e.acuity='red' AND e.status IN ('open','in_progress')`),
    icu: n(`SELECT COUNT(*) c FROM encounters e JOIN departments d ON d.id=e.department_id WHERE d.kind IN ('icu','ccu','nicu') AND e.status='admitted'`),
    lab: n(`SELECT COUNT(*) c FROM orders WHERE kind='lab' AND status IN ('ordered','collected','in_progress')`),
    referrals: n(`SELECT COUNT(*) c FROM referrals WHERE status='pending'`),
    messages: n(`SELECT COUNT(*) c FROM thread_members WHERE staff_id=? AND read_at IS NULL`, staff.id),
    myResults: n(`SELECT COUNT(*) c FROM orders WHERE ordered_by=? AND kind='lab' AND status IN ('resulted','validated')`, staff.id),
  };

  const notifications = db.prepare(`SELECT id, severity, title, body, link, created_at FROM notifications
    WHERE (target_role IS NULL OR target_role=? OR scope='global') AND read=0 ORDER BY created_at DESC LIMIT 20`).all(staff.role) as any[];

  return json({
    staff, caps, counts,
    hospital: hospitalSettings().name,
    notifications: notifications.map((x) => ({ id: x.id, severity: x.severity, title: x.title, body: x.body, link: x.link, createdAt: x.created_at })),
  });
}

export default function AppLayout() {
  const { staff, caps, counts, hospital, notifications } = useLoaderData<typeof loader>();
  return (
    <LiveProvider>
      <ToastProvider>
        <AppShell staff={staff} caps={caps} counts={counts} hospital={hospital} notifications={notifications}>
          <Outlet />
        </AppShell>
      </ToastProvider>
    </LiveProvider>
  );
}
