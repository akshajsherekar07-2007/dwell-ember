# Dwell Ember — Implementation Plan

## Delivery model and definition of done

Solo founder, responsive web application, India-first long-stay student housing. Indicative effort **16–20 full-time weeks**, not a delivery guarantee. Keep the initial product narrow; use the implementation gates below rather than shipping against an untested date.

A feature is complete when its SRS/PRD behavior, authorization, failure path and accessibility are implemented, relevant tests pass, observability is added and documentation/contract match. Schema-only or happy-path UI work is not a complete allocation feature.

## Phase 0 — specification and setup (weeks 1–2)

- Review this foundation, record changes in DECISIONS, and conduct student/owner interviews. Set production plan prices/caps only after validation.
- Initialize Git, Next.js TypeScript, package manager lockfile, lint/typecheck, Tailwind/shadcn and environment validation. Use feature-oriented modules and thin route handlers.
- Suggested structure: `src/app` for routes/pages, `src/modules` for domain services, `src/components` for UI, `supabase/migrations` for executable migrations and functions, `tests` for verification. Keep the existing `docs`, `database` and `api` artifacts.
- Provision separate local/staging/production projects when credentials are available. Select Mumbai for the database and compatible nearby application compute. Configure auth redirect allowlists and email sender.
- Add CI: lint → types → unit/domain tests → fresh migration/reset + SQL tests → OpenAPI validation → browser tests → build. Use secrets from deployment settings only.

**Gate:** application shell builds; migration applies from empty database; roles are isolated; CI is green. User-selected name is Dwell Ember; domain purchase is independent and not presumed complete.

## Phase 1 — identity, catalog and inventory (weeks 3–5)

- Implement verified email/Google authentication, profile bootstrap, active-account enforcement, organization creation, memberships and property assignment. Require MFA for admin.
- Build owner wizard and catalog commands with publication approval, composite hierarchy validation, capacity/cap checks, audit, image quarantine/approval and map pinning.
- Implement public property search/aggregate DTOs using PostGIS; build discovery/detail UI and saved properties.
- Build schematic floor/room/bed editor plus accessible list/table mode. Keep layouts private from the beginning.
- Implement scoped bed access invitations/grants and safe account-linking after direct owner/student interaction; no unrestricted account lookup.

**Gate:** two test organizations cannot read/write each other's inventory; free discovery leaks no bed IDs/layouts; upload validation and Maps restrictions work; mobile hierarchy is usable.

## Phase 2 — allocation engine and queue (weeks 6–9)

- Implement transactional command RPCs described in DATABASE: invite, accept, release, join/leave queue, promote, book, exceptional cancel, block resolution and checkout.
- Implement request idempotency inside the business transaction; use explicit commands rather than generic bed color edits.
- Implement one-minute expiry reconciler, command-time reconciliation, queue eligibility and terminal membership handling. Guard the one-student commitment cap and three-membership cap under concurrency.
- Create durable inbox/outbox in every inventory command; add email templates and leased retry worker with stale-event checks. Add private realtime refresh signals and reconnection/polling behavior.
- Build owner queue/bed drawer and student My stays pages with exact deadlines, countdown, empty/error/expiry states and audited exception flow.

**Gate:** 100-way allocation race passes, FIFO cannot be bypassed, expiry boundary tests pass, crashed workers recover, and reminders never create duplicate business effects. Existing commitments remain operable when a plan lapses.

## Phase 3 — entitlements and paid launch capabilities (weeks 10–13)

- Implement configured owner/student plans, billing authorization, Razorpay test-mode checkout and durable signed webhook receiver.
- Implement immutable wallet ledger, captured-payment fulfillment, 30-day property unlock transaction and owner plan capability checks.
- Implement webhook/provider reconciliation, duplicate/order handling and failed-payment UI. Add support-driven refund/credit corrections with nonnegative balance checks.
- Connect entitlement-controlled layouts/realtime; add explicit upgrade/credit confirmations and billing dashboard.
- Ensure payment providers never determine inventory state and student premium never changes FIFO.

**Gate:** concurrent/retried unlock debits once; duplicate capture events fulfill once; browser checkout cannot spoof access; expired access closes protected layouts without affecting commitments.

## Phase 4 — operational hardening and pilot (weeks 14–16)

- Build admin listing review, allocation incident timeline, failed-delivery replay and provider reconciliation tooling with restricted permissions.
- Instrument p95 latency, lock waits, overdue allocations, outbox age, webhook lag, email failures and stale inventory.
- Run load tests with the defined pilot workload. Inspect query plans and indexes before adding infrastructure.
- Run backup restore drill including media recovery, deployment smoke tests, session/rate-limit checks, PII log review and accessibility review.
- Onboard 5–10 properties, seed realistic inventory and support a limited cohort. Collect observed hold conversion/queue acceptance and correct operational confusion.

**Gate:** no unresolved P0 integrity/privacy issue; incident runbooks exercised; live provider/sender/Maps setup and approved commercial terms completed before public paid launch.

## Phase 5 — launch buffer (weeks 17–20)

Address pilot issues; stage production migrations; verify recovery point and support ownership; enable owner payments and student upgrades with feature flags. Begin with a small cohort and observe actual expiry/delivery/billing behavior for seven days before expanding access. Roll back the app through compatible releases; never delete audit/ledger history to undo a deployment.

## Later work: AI and short stays

AI release: grounded natural-language filters and owner description drafts, provider adapter, permission checks, explicit review and evaluation examples. No allocation/payment authority.

Hourly release: shared interval allocation schema, existing long-stay migration, exclusion constraints, cleaning buffers, timezone/date-boundary UI, time-based pricing and conflict tests. Confirm commercial payment/cancellation policy before implementing online deposits. Keep this feature disabled until its migration and conflict engine pass tests.

## Test matrix and release evidence

| Suite | Required scenarios |
|---|---|
| Domain/SQL | State transitions; exact-deadline comparison; caps; FIFO tie/order; expired rows; blocked inventory; capacity; unique constraints |
| Concurrency | Same bed 100 requests; same student two beds; three-queue cap; accept vs expiry; release vs book; checkout vs block; duplicate unlock |
| Security | Tenant IDs guessed; staff revoked; inactive account; free/expired access; own-bed exception; signed link replay; service key absent from browser |
| Billing | Tampered raw webhook; repeated/out-of-order events; amount mismatch; delayed capture; failed storage; refund of spent/unspent credits |
| Delivery | Outage/retry/lease expiry; permanent bounce; stale offer reminder; revoked realtime entitlement; reconnection |
| Browser | Owner setup → invitation → student hold → booking; release → FIFO offer; unlock → expiry; mobile/keyboard paths |
| Operations | Fresh migrations, smoke tests, DB/media restore, feature-flag disable and compatible rollback |

Record command output and unresolved limitations in VALIDATION. Do not claim future acceptance tests have already passed.
