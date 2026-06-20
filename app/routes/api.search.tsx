import { json, type LoaderFunctionArgs } from "@remix-run/node";
import db from "~/lib/db.server";
import { requireStaff } from "~/lib/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const staff = await requireStaff(request);
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return json({ results: [] });
  const like = `%${q}%`;
  const scope = staff.role === "doctor"
    ? `AND id IN (SELECT patient_id FROM encounters WHERE attending_id='${staff.id}' UNION SELECT patient_id FROM referrals WHERE to_staff_id='${staff.id}' UNION SELECT e.patient_id FROM orders o JOIN encounters e ON e.id=o.encounter_id WHERE o.ordered_by='${staff.id}')`
    : "";
  const patients = db.prepare(`SELECT id, full_name, mrn FROM patients WHERE (full_name LIKE ? OR mrn LIKE ?) ${scope} LIMIT 5`).all(like, like) as any[];
  const staffRows = db.prepare("SELECT id, full_name, specialty, role FROM staff WHERE full_name LIKE ? OR specialty LIKE ? LIMIT 4").all(like, like) as any[];
  const results = [
    ...patients.map((p) => ({ kind: "patient", id: p.id, label: p.full_name, sub: p.mrn, to: `/patients/${p.id}` })),
    ...staffRows.map((s) => ({ kind: "staff", id: s.id, label: s.full_name, sub: s.specialty ?? s.role, to: `/staff/${s.id}` })),
  ];
  return json({ results });
}
