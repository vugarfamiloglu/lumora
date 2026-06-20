// Client-safe formatting helpers (no server imports).
export function money(n: number | null | undefined, currency = "USD"): string {
  const v = Number(n ?? 0);
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v); }
  catch { return `$${v.toFixed(2)}`; }
}

export function dateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function timeOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  if (isNaN(d)) return "—";
  const diff = Math.round((d - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

export function age(birth: string | null | undefined): string {
  if (!birth) return "—";
  const b = new Date(birth);
  if (isNaN(b.getTime())) return "—";
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return `${a}y`;
}

export function initials(name: string): string {
  return name.replace(/^(Dr\.?|Prof\.?|RN)\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function jsonArr<T = string>(s: string | null | undefined): T[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Administrator", department_head: "Department Head", doctor: "Physician", nurse: "Nurse",
  lab: "Laboratory", radiology: "Radiology", pharmacy: "Pharmacy", reception: "Reception", billing: "Billing",
};

export const TRIAGE_CLASS: Record<string, string> = { red: "triage triage-red", yellow: "triage triage-amber", green: "triage triage-green" };
export const FLAG_CLASS: Record<string, string> = { critical: "flag-critical", high: "flag-high", low: "flag-low", normal: "flag-normal" };
export const STATUS_BADGE: Record<string, string> = {
  open: "b-muted", in_progress: "b-primary", admitted: "b-accent", discharged: "b-success", closed: "b-muted", cancelled: "b-danger",
  ordered: "b-muted", collected: "b-warn", resulted: "b-primary", validated: "b-success",
  scheduled: "b-primary", acquired: "b-warn", reported: "b-success", in_progress2: "b-primary",
  prescribed: "b-muted", verified: "b-primary", dispensed: "b-success",
  pending: "b-warn", accepted: "b-primary", completed: "b-success", declined: "b-danger",
  booked: "b-primary", arrived: "b-accent", done: "b-success", no_show: "b-danger",
  paid: "b-success", partial: "b-warn", void: "b-danger",
};
