import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

// Time-sortable, collision-resistant id (timestamp prefix + random suffix).
export function newId(): string {
  const t = Date.now().toString(36);
  const r = randomBytes(8).toString("hex").slice(0, 12);
  return `${t}${r}`;
}

function code(prefix: string, len = 6): string {
  let s = "";
  const buf = randomBytes(len);
  for (let i = 0; i < len; i++) s += ALPHABET[buf[i] % 36].toUpperCase();
  return `${prefix}-${s}`;
}

export const mrn = () => code("MRN", 7);
export const visitNo = () => code("V", 8);
export const staffNo = () => code("S", 5);
export const invoiceNo = (n: number) => `INV-${String(n).padStart(6, "0")}`;
