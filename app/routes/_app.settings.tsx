import { json, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { requireCap } from "~/lib/session.server";
import { hospitalSettings, setSetting, SECRET_KEYS } from "~/lib/settings.server";
import { writeAudit } from "~/lib/audit.server";
import { PageHeader, Card, CardHead, Button, Field } from "~/components/ui";
import { Icon } from "~/components/Icon";

export const meta: MetaFunction = () => [{ title: "Settings · Lumora" }];
export const handle = { title: "Settings", crumb: "ADMINISTRATION" };

export async function loader({ request }: LoaderFunctionArgs) {
  await requireCap(request, "manage_settings");
  return json({ s: hospitalSettings() });
}

export async function action({ request }: ActionFunctionArgs) {
  const staff = await requireCap(request, "manage_settings");
  const f = await request.formData();
  for (const k of ["hospital_name", "hospital_tagline", "currency", "accreditation", "timezone"]) {
    const v = f.get(k); if (v != null) setSetting(k, String(v));
  }
  for (const k of SECRET_KEYS) {
    const v = String(f.get(k) ?? "");
    if (v && v !== "********") setSetting(k, v);
  }
  writeAudit(staff, "settings.update", "settings", "hospital");
  return json({ ok: true });
}

export default function Settings() {
  const { s } = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const [show, setShow] = useState<Record<string, boolean>>({});
  return (
    <div className="stack">
      <PageHeader title="Settings" sub="Hospital profile and secure provider credentials."
        action={<Button variant="primary" type="submit" form="settings" icon="check">Save changes</Button>} />
      {data?.ok && <Card><div className="card-body cluster" style={{ color: "rgb(var(--success))" }}><Icon name="check" size={16} />Settings saved.</div></Card>}
      <Form id="settings" method="post">
        <div className="bento">
          <Card>
            <CardHead title="Hospital profile" />
            <div className="card-body">
              <Field label="Hospital name"><input name="hospital_name" defaultValue={s.name} /></Field>
              <Field label="Tagline"><input name="hospital_tagline" defaultValue={s.tagline} /></Field>
              <div className="form-grid">
                <Field label="Currency"><select name="currency" defaultValue={s.currency}>{["USD", "EUR", "GBP", "AED", "TRY"].map((c) => <option key={c}>{c}</option>)}</select></Field>
                <Field label="Accreditation"><input name="accreditation" defaultValue={s.accreditation} /></Field>
              </div>
              <Field label="Timezone"><input name="timezone" defaultValue={s.timezone} /></Field>
            </div>
          </Card>
          <Card>
            <CardHead title="Integrations & secrets" />
            <div className="card-body">
              <p className="mut-sm" style={{ marginTop: 0 }}>Provider keys are encrypted at rest with AES-256-GCM and never returned to the browser.</p>
              {[["sms_api_key", "SMS gateway API key"], ["smtp_password", "SMTP password"], ["lab_device_key", "Lab analyzer (HL7) key"]].map(([k, label]) => (
                <Field key={k} label={label} hint={s.hasSecret[k] ? "🔒 Stored — leave blank to keep" : "🔒 Encrypted on save"}>
                  <div className="pw-wrap">
                    <input type={show[k] ? "text" : "password"} name={k} placeholder={s.hasSecret[k] ? "••••••••" : ""} />
                    <button type="button" className="pw-eye" tabIndex={-1} onClick={() => setShow((p) => ({ ...p, [k]: !p[k] }))}><Icon name={show[k] ? "eyeOff" : "eye"} size={16} /></button>
                  </div>
                </Field>
              ))}
            </div>
          </Card>
        </div>
      </Form>
    </div>
  );
}
