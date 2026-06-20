import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs, type LinksFunction, type MetaFunction } from "@remix-run/node";
import { Form, useActionData, useNavigation, useSearchParams } from "@remix-run/react";
import { useState } from "react";
import { getStaff, login, createUserSession } from "~/lib/session.server";
import { homePath } from "~/lib/rbac.server";
import { hospitalSettings } from "~/lib/settings.server";
import { Icon } from "~/components/Icon";
import authStyles from "~/styles/auth.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: authStyles }];
export const meta: MetaFunction = () => [{ title: "Sign in · Lumora" }];

export async function loader({ request }: LoaderFunctionArgs) {
  if (await getStaff(request)) throw redirect("/dashboard");
  return json({ hospital: hospitalSettings().name });
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");
  const staff = await login(email, password);
  if (!staff) return json({ error: "Invalid email or password." }, { status: 401 });
  const dest = next.startsWith("/") && next !== "/dashboard" && next !== "/" ? next : homePath(staff.role);
  return createUserSession(staff.id, dest);
}

const FEATURES = [
  { icon: "activity", label: "Live ICU monitoring" },
  { icon: "stethoscope", label: "EMR & order entry" },
  { icon: "share", label: "Inter-department referrals" },
  { icon: "shield", label: "Role-based access" },
];

export default function Login() {
  const data = useActionData<typeof action>();
  const nav = useNavigation();
  const [params] = useSearchParams();
  const [show, setShow] = useState(false);
  const busy = nav.state !== "idle";

  return (
    <div className="auth">
      <aside className="auth-hero">
        <div className="auth-hero-in">
          <div className="auth-brand"><img src="/logo.svg" alt="" /><b>Lumora</b></div>
          <span className="auth-tag">Hospital Operating System</span>
          <h1>Care, in concert.</h1>
          <p>One clinical command center — emergency, critical care, wards, theatres, diagnostics, pharmacy and billing, connected end to end.</p>
          <ul className="auth-feats">
            {FEATURES.map((f) => (
              <li key={f.label}><span className="af"><Icon name={f.icon} size={16} /></span>{f.label}</li>
            ))}
          </ul>
        </div>
        <div className="auth-grid" aria-hidden />
      </aside>

      <main className="auth-main">
        <Form method="post" className="auth-card">
          <h2>Sign in</h2>
          <p className="auth-sub">Access the clinical workspace.</p>
          {data?.error && <div className="auth-err"><Icon name="alert" size={15} />{data.error}</div>}
          <input type="hidden" name="next" value={params.get("next") ?? ""} />
          <div className="field">
            <label>Work email</label>
            <input type="email" name="email" defaultValue="admin@lumora.health" autoComplete="username" required />
          </div>
          <div className="field">
            <label>Password</label>
            <div className="pw-wrap">
              <input type={show ? "text" : "password"} name="password" defaultValue="Lumora2026!" autoComplete="current-password" required />
              <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} tabIndex={-1} aria-label="Toggle">
                <Icon name={show ? "eyeOff" : "eye"} size={16} />
              </button>
            </div>
          </div>
          <button className="btn btn-primary auth-submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}<Icon name="arrow-right" size={16} />
          </button>
          <div className="auth-demo">
            <span>Demo</span>
            <code>admin@lumora.health · Lumora2026!</code>
          </div>
        </Form>
      </main>
    </div>
  );
}
