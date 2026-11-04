# MOVEO Yoga booking

Simple booking for yoga classes at MOVEO Belair: clients book a **drop-in** or a **10-session card**,
pay with **Apple Pay, Google Pay or card** (Stripe Checkout), and get a ticket with a QR code.
Apple Wallet passes are built in but switched off until an Apple Developer account is set up (planned for a later version).
Instructors get a phone-friendly **check-in** view.

- Client site: `/en`, `/fr`, `/de` (language picked from the browser)
- Instructor area: `/staff` (one shared studio password)

## How it works

| Client wants to… | Flow |
|---|---|
| Book a drop-in | Pick class → name + email → Stripe (Apple Pay / Google Pay / card) → ticket page with QR, Apple Wallet, calendar |
| Buy a 10-card while booking | Same, choosing “Buy 10-session card”: the card is created and this class uses the first session |
| Use their card | Email + card code (remembered on their phone after first use) → booked instantly, no payment |
| Try a free class | New clients pick “Free trial class”: name + email, booked instantly, no payment. One per person (anyone with a past booking or a card isn't eligible); cancelling gives it back. Switch off with `TRIAL_ENABLED=false` |
| Buy a card only / check balance | `/en/card` |
| Cancel | Link in the confirmation email. ≥ 12 h before class: card session returned, or drop-in refunded via Stripe. Later: spot freed, no refund |

A spot is held for 30 minutes while the client pays, so classes never overbook. If they abandon
payment, the spot is released.

**Instructors** (`/staff`): see this week's classes with booked / checked-in counts, open a class and tap
**Check in** next to each name, add walk-ins (with a card code, a session is deducted; without, collect the
drop-in fee at the desk), remove people (with or without refund), add weekly recurring classes and cancel a
class (everyone gets their session or money back). The QR code on each ticket and Wallet pass opens the
check-in page when scanned with the instructor's phone camera; a 10-card QR lets them check a client into
today's class directly.

Emails (booking and card confirmations) are sent through Resend in English and French.

## Stack

Next.js 15 (App Router, server actions) · Postgres (`postgres` driver, plain SQL in `db/schema.sql`) ·
Stripe Checkout · `passkit-generator` for Apple Wallet · Resend for email.

## Run locally

```bash
npm install
cp .env.example .env.local            # set DATABASE_URL to a local Postgres
npm run migrate && npm run seed       # schema + a sample 4-week schedule
npm run dev                           # http://localhost:3000
```

Without `STRIPE_SECRET_KEY`, payments use a **simulated payment page** so you can click through every
flow. It is off in production unless `ALLOW_MOCK_PAYMENTS=true` (useful for a demo deployment only).

Tests (unit + integration against a throwaway database + Wallet signing):

```bash
DATABASE_URL=postgres://localhost/moveo_test npm test
```

## Going live

1. **Database**: create a free Postgres at [neon.tech](https://neon.tech) and copy the connection string.
2. **Hosting**: import the repo into [Vercel](https://vercel.com), set the env vars from `.env.example`,
   and point `book.moveo.lu` to it (CNAME). Run `npm run migrate` once against the production database
   (`vercel.json` already runs the migration on every deploy).
3. **Stripe**:
   - Settings → Payment methods: make sure **Apple Pay**, **Google Pay** and **Cards** are on.
   - Developers → API keys: set `STRIPE_SECRET_KEY`.
   - Developers → Webhooks → add endpoint `https://book.moveo.lu/api/stripe/webhook` with events
     `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`; set `STRIPE_WEBHOOK_SECRET`.
4. **Apple Wallet** (later version; optional, needs the Apple Developer Program, 99 USD/year):
   - Certificates, IDs & Profiles → Identifiers → **Pass Type IDs** → register e.g. `pass.lu.moveo.yoga`.
   - Create a **Pass Type ID certificate** for it (upload a CSR from Keychain Access), download, export
     as `.p12`, then convert:
     ```bash
     openssl pkcs12 -in pass.p12 -clcerts -nokeys -out signerCert.pem -legacy
     openssl pkcs12 -in pass.p12 -nocerts -out signerKey.pem -legacy
     ```
   - Download Apple's **WWDR G4** certificate and convert: `openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem`
   - Set `PASS_TYPE_ID`, `APPLE_TEAM_ID`, `PASS_SIGNER_CERT`, `PASS_SIGNER_KEY`,
     `PASS_SIGNER_KEY_PASSPHRASE`, `PASS_WWDR_CERT` (PEM text or base64 of it).
   - Until these are set, the “Add to Apple Wallet” button is simply hidden.
5. **Email**: create a [Resend](https://resend.com) account, verify `moveo.lu`, set `RESEND_API_KEY` and `EMAIL_FROM`.
6. **Instructors**: set `STAFF_PASSWORD` and a long random `SESSION_SECRET`.
7. Add a “Yoga” link on moveo.lu pointing to `https://book.moveo.lu`.

Prices, card size/validity and the cancellation window are env vars (`PRICE_DROPIN_CENTS`,
`PRICE_CARD10_CENTS`, `CARD_CREDITS`, `CARD_VALIDITY_DAYS`, `CANCEL_HOURS`).

## Not included yet

- Wallet passes don't update themselves after being added (the 10-card pass shows the balance at the time it
  was downloaded; the web page is always current). Live updates need Apple's pass web service + push.
- Waiting list, client accounts/passwords, per-instructor logins, reporting/export.
