import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required for auth crypto operations");
  }
  return createHash("sha256").update(secret).digest();
}

export function createRandomState(): string {
  return randomBytes(24).toString("base64url");
}

export function encryptJson<T>(value: T): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const json = JSON.stringify(value);
  const enc = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptJson<T>(token: string): T | null {
  try {
    const buf = Buffer.from(token, "base64url");
    if (buf.length < IV_LEN + TAG_LEN + 1) return null;
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const enc = buf.subarray(IV_LEN + TAG_LEN);
    const key = getKey();
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return JSON.parse(dec.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
