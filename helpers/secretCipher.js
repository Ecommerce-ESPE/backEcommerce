const crypto = require("crypto");

const buildKey = () => {
  const source =
    process.env.SECRET_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    "local-dev-insecure-key-change-me";
  return crypto.createHash("sha256").update(String(source)).digest();
};

const encryptSecret = (plainText) => {
  const key = buildKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plainText), "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64")
  };
};

const decryptSecret = ({ encrypted, iv, tag }) => {
  const key = buildKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
};

module.exports = {
  encryptSecret,
  decryptSecret
};
