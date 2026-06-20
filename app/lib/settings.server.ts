import db from "./db.server";
import { encryptSecret, decryptSecret } from "./vault.server";

export const SECRET_KEYS = ["sms_api_key", "smtp_password", "lab_device_key"];

const getRow = db.prepare("SELECT value, encrypted FROM settings WHERE key = ?");
const upsert = db.prepare(`INSERT INTO settings (key, value, encrypted, updated_at) VALUES (?,?,?,datetime('now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, encrypted = excluded.encrypted, updated_at = datetime('now')`);

export function getSetting(key: string, fallback = ""): string {
  const row = getRow.get(key) as { value: string; encrypted: number } | undefined;
  if (!row || !row.value) return fallback;
  return row.encrypted ? decryptSecret(row.value) : row.value;
}

export function setSetting(key: string, value: string): void {
  const secret = SECRET_KEYS.includes(key);
  upsert.run(key, secret && value ? encryptSecret(value) : value, secret ? 1 : 0);
}

export interface HospitalSettings {
  name: string; tagline: string; currency: string; accreditation: string; timezone: string;
  hasSecret: Record<string, boolean>;
}

export function hospitalSettings(): HospitalSettings {
  return {
    name: getSetting("hospital_name", "Lumora Medical Center"),
    tagline: getSetting("hospital_tagline", "Hospital Operating System"),
    currency: getSetting("currency", "USD"),
    accreditation: getSetting("accreditation", "JCI Accredited"),
    timezone: getSetting("timezone", "UTC"),
    hasSecret: Object.fromEntries(SECRET_KEYS.map((k) => [k, Boolean(getSetting(k))])),
  };
}
