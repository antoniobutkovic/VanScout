# VanScout

VanScout includes the existing Kotlin Multiplatform mobile client in `mobile/`
and a Next.js full-stack web application at the repository root. The browser UI
and API run on the same origin, matching the CraftLog/Avero deployment model.

## Web client

Install dependencies from the repository root, then start the Next.js app:

```bash
npm install
npm run dev
```

The API is served by the same process under `/api`. There is no separate local
backend process and no `VITE_API_BASE_URL` or `ALLOWED_ORIGINS` requirement.

The default `npm run dev` uses `.env.staging` so Google sign-in works locally.
Staging/Preview uses `.env.staging`, while production uses `.env.production`. Each environment
must have its own Neon database, Google Web client ID, and 32+ character JWT
secret. Templates are available in `.env.staging.example` and
`.env.production.example`.

In Google Cloud, add `http://localhost:3100` and
`https://van-scout-git-staging-antonios-projects-d03311f7.vercel.app` to the
Authorized JavaScript origins for the staging Web client. Use the stable
staging alias rather than a per-deployment URL, since those URLs change after
each deployment.

```bash
npm run dev:staging
npm run build:staging
npm run build:production
```

Google sign-in uses Google Identity Services in the browser; the server
verifies the returned ID token with `google-auth-library` and issues the
VanScout JWT.

## Firebase phone verification

VanScout sends and confirms phone verification codes with Firebase
Authentication. Register a Web app in the Firebase project, enable the Phone
provider under Authentication, and copy the Web app configuration into the
`FIREBASE_*` values shown in the environment templates.

For local Spark-plan testing, add fictional phone numbers and fixed six-digit
codes under **Authentication → Sign-in method → Phone numbers for testing**, and
set `FIREBASE_PHONE_TEST_MODE=true`. In this mode Firebase sends no SMS and real
phone numbers intentionally fail. Set it to `false` in production.

Add every deployed hostname to Firebase Authentication's authorized domains.
The browser sends the code through Firebase and receives a signed ID token; the
VanScout API validates that token against Firebase's public keys before marking
the database phone number as verified. No Firebase service-account private key
is required by this implementation.

Email delivery uses Zoho SMTP. `SMTP_USER` must be the exact mailbox that is
allowed to send, and `SMTP_HOST` must match the server shown in that mailbox's
Zoho Mail server configuration. The app sends using `SMTP_USER` directly, so a
separate `MAIL_FROM` value is not required.

The web experience includes the public landing pages, transport request wizard,
customer offers and messaging workspace, carrier job flow, wallet, delivery
tracking, and responsive mobile layouts.
