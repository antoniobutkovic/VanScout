# VanScout security and privacy operations

This document describes required operational steps. Passing automated checks is not a legal certification.

## Message encryption

Chat bodies and initial offer messages are encrypted before database storage with AES-256-GCM. `MESSAGE_ENCRYPTION_KEY` is a comma-separated key ring. The first key encrypts new data; all listed keys may decrypt existing data.

1. Generate a production key with `openssl rand -base64 32` in a secure administrative environment.
2. Store it only in the deployment secret manager as `MESSAGE_ENCRYPTION_KEY`. Never commit or paste it into logs, support tickets, or source control.
3. Back up the key in an access-controlled secrets vault. Losing every listed key permanently destroys access to messages.
4. Run `npm run privacy:migrate-encryption` once with the production `DATABASE_URL` and key ring to encrypt legacy plaintext rows.
5. Verify that no legacy rows remain:
   `SELECT COUNT(*) FROM vanscout_messages WHERE body NOT LIKE 'vanscout:v1:%';`
   `SELECT COUNT(*) FROM vanscout_transport_offers WHERE message <> '' AND message NOT LIKE 'vanscout:v1:%';`
6. Plaintext messages are rejected unconditionally. This fresh production database must contain only encrypted message content.
7. To rotate, prepend a new 32-byte key, deploy, run the migration again to encrypt any legacy/plain rows, and retain old keys until all ciphertext has been re-encrypted by a dedicated rotation migration and backups using the old key have expired.

This is application-layer encryption, not end-to-end encryption. The application can decrypt messages to deliver them. Restrict production database, deployment, log, backup, and encryption-key access using least privilege and MFA.

## Retention and rights

- `MESSAGE_RETENTION_DAYS` defaults to 730 and must match the published privacy notice and actual business need.
- The Vercel cron calls `/api/internal/retention` daily using `CRON_SECRET`. Monitor failures.
- Users can export data from `/api/privacy/export` and erase the operational account through `/api/privacy/account` from their profile.
- Before relying on automated erasure, document which accounting, tax, fraud, dispute, insurance, and legal-claim records must be restricted and retained. Confirm Stripe, email, hosting, database, logs, and backup deletion behaviour.
- Maintain a request register and identity-verification procedure. GDPR requests normally require a response within one month.

## Required pre-launch legal work

- Replace the generic legal details and the displayed “last updated” date in `src/components/LegalDocumentContent.tsx` with accurate information before public launch. This remains a manual launch requirement.
- Have qualified Croatian/EU counsel approve the privacy notice, cookies notice, terms, impressum, consumer cancellation/refund flow, carrier relationship, and applicable Croatian transport rules.
- Execute and retain Article 28 data-processing agreements for Vercel, Neon/AWS, Ably, Google/Firebase, Stripe, Zoho, Geoapify, and any other processor.
- The production database is in an EEA region. Still document any non-EEA processing by vendors or their subprocessors and the applicable transfer mechanism, such as an adequacy decision or Standard Contractual Clauses.
- Maintain a Record of Processing Activities, lawful-basis and legitimate-interest assessments, security risk assessment, incident-response procedure, processor register, retention schedule, access-review evidence, and breach-notification procedure.
- Assess whether a DPIA is required before launch and repeat the assessment when scale, monitoring, sensitive data, or features change.
- Determine Digital Services Act applicability and any micro/small-enterprise exemption. If applicable, implement trader traceability, verification, complaint handling, statements of reasons, illegal-content reporting, and marketplace compliance-by-design requirements before carriers can trade.
- Confirm age eligibility, accessibility, tax/invoicing, professional-carrier licensing and insurance, consumer protection, platform-to-business, and local law in every launch country. Do not claim worldwide compliance.

## Security operations

- Use MFA and least privilege for Vercel, Neon, AWS, Ably, Firebase/Google, Stripe, Zoho, source control, and domain accounts.
- Put a distributed rate limiter or WAF in front of authentication and messaging. The in-process limiter is defense in depth only and is not globally consistent across serverless instances.
- Enable dependency monitoring, secret scanning, audit logs, database point-in-time recovery, encrypted backups, alerting, and regular restore tests.
- Run `npm test`, `npm run typecheck`, `npm run build:production`, vulnerability scanning, and an independent penetration test before launch.
- Review the Content Security Policy against the production browser console. Remove `'unsafe-inline'` by adopting per-request CSP nonces when feasible.
- Establish an on-call breach procedure. Evaluate notification to the supervisory authority within 72 hours where GDPR Article 33 applies, and notify affected individuals where Article 34 applies.
