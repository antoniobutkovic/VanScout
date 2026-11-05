const required = [
  "MESSAGE_ENCRYPTION_KEY",
  "MESSAGE_RETENTION_DAYS",
  "CRON_SECRET",
  "JWT_SECRET",
  "APP_URL",
];

const errors = required.filter(name => !process.env[name]?.trim()).map(name => `${name} is missing`);
const warnings = [];

const keys = process.env.MESSAGE_ENCRYPTION_KEY?.split(",").map(value => value.trim()).filter(Boolean) || [];
for (const [index, encoded] of keys.entries()) {
  if (Buffer.from(encoded, "base64").length !== 32) errors.push(`MESSAGE_ENCRYPTION_KEY entry ${index + 1} is not a base64-encoded 32-byte key`);
}
if ((process.env.JWT_SECRET || "").length < 32) errors.push("JWT_SECRET must contain at least 32 characters");
if (process.env.MESSAGE_RETENTION_DAYS && process.env.MESSAGE_RETENTION_DAYS !== "730") errors.push("MESSAGE_RETENTION_DAYS must remain 730 unless the published privacy notice is updated at the same time");
if (process.env.APP_URL && !process.env.APP_URL.startsWith("https://")) errors.push("APP_URL must use HTTPS in production");
if (process.env.FIREBASE_PHONE_TEST_MODE === "true") errors.push("FIREBASE_PHONE_TEST_MODE must be false in production");

try {
  const database = new URL(process.env.DATABASE_URL || "");
  if (/us-(east|west)-\d/.test(database.hostname)) {
    warnings.push("The database is hosted in the US. Confirm the DPA, Chapter V transfer mechanism, transfer assessment, and privacy notice before launch.");
  }
} catch {
  errors.push("DATABASE_URL is missing or invalid");
}

if (warnings.length) process.stderr.write(`${warnings.map(message => `WARNING: ${message}`).join("\n")}\n`);
if (errors.length) {
  process.stderr.write(`${errors.map(message => `ERROR: ${message}`).join("\n")}\n`);
  process.exit(1);
}
process.stdout.write("Automated production privacy/security configuration checks passed. Organisational and legal checklist items still require human verification.\n");
