# Dwell Ember — Validation Record

Prepared 2 November 2026. This record distinguishes actual foundation checks from future application acceptance tests.

## Reproduce

Dependency-free document/contract consistency checks:

```powershell
python scripts/build_openapi.py
python scripts/validate_docs.py
```

Optional isolated technical validation dependencies (no application dependency manifest is created):

```powershell
npm.cmd install --prefix .tools/validation --no-save --no-package-lock @apidevtools/swagger-parser@13.1.0 pgsql-parser@18.3.2 @electric-sql/pglite@0.5.14 @electric-sql/pglite-postgis@0.2.14
node scripts/validate_technical.cjs
```

`.tools` is ignored. Tests use an ephemeral PostgreSQL WASM database, real PostGIS and minimal local Supabase identity stubs. They do not connect to a cloud account or send email/payment requests. The PostGIS WASM extension is a validation tool, not the chosen production deployment.

## Completed checks — 2 November 2026

| Check | Actual result |
|---|---|
| Required artifact existence, local Markdown links and code fences | Passed for 13 primary deliverables |
| API references, unique operation IDs, path parameters, requirement references and mutation idempotency headers | Passed: 53 paths, 60 operations, 50 named schemas |
| OpenAPI specification validation | Passed: OpenAPI 3.1.0, Swagger Parser 13.1.0 |
| PostgreSQL SQL parser | Passed: 80 statements, pgsql-parser 18.3.2 |
| Fresh database application | Passed in PGlite 0.5.14 with PostGIS extension 0.2.14 and identity stubs; 28 application tables |
| Database behavior assertions | Passed: 37 assertions covering actual geography query, hierarchy/tenant foreign keys, bed/student exclusivity, two-hour invitation and 48-hour hold bounds, queue uniqueness, booking identity, RLS owner/staff/free/paid/inactive access, immutable credit/audit rows, duplicate fulfillment and outbox lease/dedup rules |
| Python and Node script syntax | Passed |

OpenAPI reference checks and SQL parsing are not substitutes for database execution; database execution is not a hosted Supabase integration test. In particular, the three-queue cap, wallet nonnegative behavior, FIFO fairness and deadline command races depend on future command functions, not these DDL-only tests.

## Still required during implementation

- Supabase CLI clean migration/reset and hosted Auth/RLS/storage/realtime tests with actual Supabase roles/configuration.
- Transaction command functions, FIFO behavior, expiry jobs, worker retries and idempotent webhook fulfillment.
- Real parallel-client concurrency tests. A single ephemeral PGlite instance does not demonstrate multi-connection lock behavior.
- Browser journeys, accessibility, responsive rendering, production load targets and restore drills.
- Razorpay test/live integration, approved sender delivery, Maps restrictions and production operational checks.

The repository now also includes a running local Next.js application; its separate verification record appears below. No public deployment, domain purchase, trademark clearance, provider onboarding or production-provider test is claimed.

## Application verification — 2 November 2026

| Check | Actual result |
|---|---|
| `npm test` | Passed: 22 tests across domain, persistent repository and localhost security suites |
| Concurrent local invitations | 100 competing serialized requests produced one successful reservation |
| Concurrent credit unlock | 10 requests produced one entitlement and one debit |
| API boundary | Verified same-origin requests with Next-normalized URL, rejected remote/cross-origin requests and disabled-by-default production mode |
| `npm run typecheck` | Passed with strict TypeScript |
| `npm run build` | Passed optimized Next.js build; initial root/tracing warnings corrected |
| Desktop browser | Discovery, owner portfolio/inventory, selected-bed actions and release confirmation rendered and exercised |
| End-to-end sample journey | Aarav release → Riya FIFO offer → Riya acceptance/new 48h hold → owner booking → remaining queues closed |
| Mobile browser | 390×844 viewport; search for HSR Layout returned two matching listings; no horizontal overflow observed |
| Credit access browser journey | Locked detail → explicit one-credit confirmation → unlocked room/bed layout |
| Handoff data | Restored initial fictional students, holds, queues and credits after browser testing |

The localhost demo uses server-side JSON persistence and a serialized single-process engine. Those concurrency results do not establish distributed PostgreSQL lock behavior. Production Auth, Supabase command RPCs, provider billing/delivery, storage and realtime are still tracked in [implementation status](IMPLEMENTATION_STATUS.md).

Actual application screenshots, distinct from earlier AI mockups, are in [implementation previews](../assets/implementation-previews/README.md).

## Account prototype update — 2 November 2026

25 tests pass across four files, including isolated signup/session/owner-permission and cross-account listing/invitation tests. Type checking and optimized build pass. Login/signup role selection inspected in the browser; no test accounts or listings were added to the user workspace. Current local implementation details supersede the earlier seeded-demo description; see IMPLEMENTATION_STATUS.md.

## Public landing update — 2 November 2026

28 tests pass across five files. Added assertions for the public summary field allowlist and absence of owner contact data, preserved property return destinations, owner signup routing, and rejection of external or wrong-role redirects. Optimized build and type checking pass. Browser checks covered public home, owner signup CTA, direct My stays login redirection, and mobile/desktop overflow.

## Exact location update — 2 November 2026

31 tests across six files pass, covering location schema bounds, persistence, role/ownership protection and directions. Browser checks verified live Leaflet tiles, draft placement, manual coordinates, confirmation, clearing and student map/directions in an isolated temporary component harness (removed afterward). GPS permission and device accuracy remain manual checks. See IMPLEMENTATION_STATUS.md for provider and storage boundaries.

## Multi-floor and media update — 2 November 2026

37 tests across seven files pass. New coverage includes floor/room uniqueness, cross-floor repeated room labels, bed identity and reservation preservation, photo-only inventory protection, legacy metadata reconstruction, owner authorization and premium nested-media gating. Browser checks covered independent floor/room/bed controls and multiple overall uploads with main-photo selection. Shared upload controls are used at property, floor and room scope. Temporary browser preview route removed after verification.

## Hierarchical editor update — 3 November 2026

43 tests across seven files pass. New checks cover named slots, count consistency, empty/duplicate slot rejection, appending rooms and slots while preserving reserved bed identities, photo-editor metadata protection, ownership rules and competing slot additions. Browser verification exercised the sequential floor/room/slot editor, persistence of drafts when switching floors, custom labels and mobile overflow. Temporary preview route removed afterward.

## Owner status update — 3 November 2026

56 tests across nine files pass. Offline status transitions, date/deadline bounds, reasoned release, FIFO notifications, current-student identity preservation, role/ownership protection, private guest metadata, registered-email linking and concurrency were exercised. Atomic JSON tests simulate Windows file locks and unrecoverable replacement failure. Browser checks covered the three action controls in an isolated preview; the temporary route was removed. No user records were altered by checks.
