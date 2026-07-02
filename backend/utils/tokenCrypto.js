import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey() {
  const configured = process.env.TOKEN_ENCRYPTION_KEY;

  if (configured) {
    const key = Buffer.from(configured, "base64");
    if (key.length !== 32) {
      throw new Error("TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
    }
    return key;
  }

  const fallbackSecret = process.env.JWT_SECRET || "dev-secret-change-me";
  return crypto.createHash("sha256").update(fallbackSecret).digest();
}

export function encryptToken(value) {
  if (!value) return "";

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64")).join(".");
}

export function decryptToken(value) {
  if (!value) return "";

  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) {
    throw new Error("Stored token is malformed");
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivText, "base64")
  );

  decipher.setAuthTag(Buffer.from(tagText, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
