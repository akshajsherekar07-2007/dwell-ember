# Dwell Ember

**Find your place. Take your time.**

An India-first student accommodation platform with a working local Next.js demo and foundational product/engineering specifications. Prepared **2 November 2026** for a solo-founder delivery model.

## Run the application

Requires Node.js 24+ and npm. From this folder:

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:3000** to browse the public landing page and property summaries without an account. Choose **Sign up** or **Log in** when ready. Property details, booking/hold actions and listing a property require authentication; links preserve the intended destination. Create an owner account, publish a property from Properties, then sign out and create a student account with a different email. Students can discover published listings. Owners send invitations using the student’s registered email. In the property form, owners can confirm a map pin using current location, map selection or coordinates. Existing listings have **Add map pin** in owner inventory; students see the saved location and directions in property details. Browser location requires permission and localhost/HTTPS; map tiles require an internet connection. Accounts require name, email, phone, role and a password of at least 10 characters. Owners can add their first floor, optionally name it, create rooms inside it, and add individually named bed slots within each room, then repeat for another floor. Saved inventory shows status counts by floor and room, and supports adding rooms and bed slots without replacing existing reservations. Overall, floor and room photo uploads remain available. The first overall photo is the student-facing listing image; use **Make main** to change it. Existing inventory supports adding floors and managing photos. In bed management, owners can mark beds **Available**, **On hold** or **Booked** after offline interactions. Guest details are optional; registered students can be linked by email. Clearing an active reservation requires a reason and respects the waitlist. There are no preloaded accounts or properties.

```powershell
npm test
npm run typecheck
npm run build
# Run an optimized LOCAL demo after building:
npm run preview
```

The authenticated local prototype persists listings to ignored `.data/prototype.json` and password hashes/session records to `.data/accounts.json`. Previous `.data/demo.json` sample records are no longer loaded. It is single-process and localhost-only. `npm start` leaves its local API disabled in production by default; `npm run preview` explicitly enables it on loopback for local inspection. Email/phone verification, password recovery, payments and production infrastructure are pending. Do not use this local file store as an internet deployment. See [implementation status](docs/IMPLEMENTATION_STATUS.md) for what works and which production integrations remain.

## Start here

| Artifact | Purpose |
|---|---|
| [PRD](docs/PRD.md) | Product goals, scope, personas, business model, acceptance criteria |
| [SRS](docs/SRS.md) | Normative behavior, permissions, state machine, consistency and reliability |
| [Database schema](database/schema.sql) | Executable PostgreSQL/Supabase DDL, constraints and row-level security |
| [Database design](docs/DATABASE.md) | Entity relationships, invariants, transaction contracts and migration guidance |
| [API documentation](docs/API.md) | API conventions, endpoint catalog, authorization and worked examples |
| [OpenAPI contract](api/openapi.json) | Machine-readable OpenAPI 3.1 specification |
| [UI/UX specification](docs/UI_UX.md) | Design system, screen inventory, responsive behavior and task flows |
| [UI image concepts](assets/ui-concepts/README.md) | Student dashboard, owner inventory and mobile hold/offer mockups |
| [Architecture](docs/ARCHITECTURE.md) | Stack, components, data flow, security, scaling and rationale |
| [Implementation plan](docs/IMPLEMENTATION_PLAN.md) | Ordered work packages, dependencies, estimates and release gates |
| [Implementation status](docs/IMPLEMENTATION_STATUS.md) | Working application features, verification and production integration boundaries |
| [Operations runbook](docs/OPERATIONS.md) | Deployment, monitoring, reconciliation, recovery and incident handling |
| [Decisions and traceability](docs/DECISIONS.md) | Confirmed choices, defaults and requirement-to-test mapping |
| [Validation report](docs/VALIDATION.md) | Checks actually performed and outstanding runtime checks |

## What this repository contains

This repository now includes a responsive application and a functional local demo engine alongside the specifications and PostgreSQL foundation. Discovery, filters, saved places, detail access, invitations, holds, FIFO promotion, booking confirmation, exceptional cancellations, checkout, property creation and demo inbox updates work with persistent fictional data.

The demo route (`/api/demo`) is deliberately separate from the planned authenticated `/api/v1` production contract. Supabase identity/RPCs, real payments, external notifications, cloud storage and a real interactive Maps integration still need implementation/configuration before production launch. The property images are AI-generated illustrations; the neighborhood map is explicitly illustrative. No live infrastructure, account credentials or purchased domain is included.

The selected brand is **Dwell Ember**. The domain candidate is `dwellember.com`; prior availability checks do not reserve it. Brand/trademark/company-name clearance is separate.

## Launch behavior

- Owners invite verified students to specific beds following a visit or direct interaction.
- An invitation reserves the bed for two hours; acceptance starts a protected hold of up to 48 hours.
- Expiry/release advances a per-bed FIFO queue. The next eligible student gets a two-hour acceptance offer, followed by a fresh 48-hour hold.
- Free discovery shows property information and aggregate vacancy counts. Paid access unlocks specific vacancies and layouts; students can always track their own commitments free.
- Owners pay for management capabilities. Students can subscribe or buy credits for detail access. Rent and accommodation deposits stay offline in v1.

## Development targets

Next.js + TypeScript, Supabase PostgreSQL/Auth/Storage/Realtime/Cron, Vercel, Razorpay, Google Maps. SQL is the inventory authority. Hosted database region: Mumbai. All exact package versions must be pinned at scaffold time after compatibility checks.

## Using the schema and contract

`database/schema.sql` targets a **fresh Supabase PostgreSQL database** with the `auth` schema, `auth.uid()` and standard Supabase roles already present. Run migrations through the Supabase CLI as a migration role; never paste credentials into source files. This file is the initial migration source; subsequent changes must be additive migration files.

The schema intentionally denies browser access to operational and billing tables. Next.js and worker code must use narrow database command functions/roles, defined during implementation. Do not loosen policies to make a prototype work.

Regenerate the API contract after editing its source:

```powershell
python scripts/build_openapi.py
python scripts/validate_docs.py
```

See the validation report for dependency-aware checks and the distinction between parsing and runtime validation.

Create the shareable foundation archive (excluding dependencies and credentials):

```powershell
python scripts/package_foundation.py
```
