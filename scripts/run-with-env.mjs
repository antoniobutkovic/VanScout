#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const [, , envFile, command, ...args] = process.argv;

if (!envFile || !command) {
  console.error("Usage: node scripts/run-with-env.mjs <env-file> <command> [...args]");
  process.exit(1);
}

const values = {};
for (const rawLine of readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const separator = line.indexOf("=");
  if (separator < 1) continue;
  const key = line.slice(0, separator).trim();
  let value = line.slice(separator + 1).trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  values[key] = value;
}

const child = spawn(command, args, {
  stdio: "inherit",
  env: { ...process.env, ...values },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
