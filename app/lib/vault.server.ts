import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";

// AES-256-GCM at-rest encryption for provider secrets. Key from env or generated to disk.
function loadKey(): Buffer {
  const env = process.env.VAULT_KEY;
  if (env && env.length >= 64) return Buffer.from(env.slice(0, 64), "hex");
  const path = join(process.cwd(), "data", ".vault-key");
  if (existsSync(path)) return Buffer.from(readFileSync(path, "utf8").trim(), "hex");
  const key = randomBytes(32);
  writeFileSync(path, key.toString("hex"), "utf8");
  try { chmodSync(path, 0o600); } catch { /* windows */ }
  return key;
}
const KEY = loadKey();

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(blob: string): string {
  try {
    const [ivH, tagH, dataH] = blob.split(":");
    const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivH, "hex"));
    decipher.setAuthTag(Buffer.from(tagH, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(dataH, "hex")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}
