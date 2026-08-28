#!/usr/bin/env node
console.error("Root build is intentionally disabled for the self-host website template.");
console.error("The root build is now the web build: use `npm run build`.");
console.error("Use `npm run build:api` for the backend build.");
process.exitCode = 1;
