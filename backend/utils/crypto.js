const crypto = require("crypto");
const bcrypt = require("bcrypt");

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const KEY = Buffer.from(process.env.PAT_SECRET_KEY);

/* -------- Password -------- */
async function hashPassword(password) {
  const rounds = Number(process.env.PASSWORD_SALT_ROUNDS || 10);
  return bcrypt.hash(password, rounds);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/* -------- PAT Encryption -------- */
function encryptPAT(text) {
  if (!text) return "";

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

function decryptPAT(encryptedText) {
  if (!encryptedText) return "";

  const [ivHex, encrypted] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

module.exports = {
  hashPassword,
  verifyPassword,
  encryptPAT,
  decryptPAT,
};
