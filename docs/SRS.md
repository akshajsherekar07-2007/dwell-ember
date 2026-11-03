# Dwell Ember — Software Requirements Specification

Version 1.0 · Normative implementation baseline · 2 November 2026

**MUST** denotes a release requirement. PostgreSQL stores authoritative state. The PRD defines intent; this document defines observable behavior. Later-phase capabilities are explicitly identified.

## 1. Actors and permissions

| Action | Visitor | Student | Assigned staff | Organization owner | Admin |
|---|---|---|---|---|---|
| Public property/aggregate discovery | Yes | Yes | Yes | Yes | Yes |
| Full layout/specific vacancies | No | Entitlement | Assigned property | Own organization | Audited support access |
| Own invitations/holds/queues | No | Own only | No unrelated student access | No unrelated student access | Audited support access |
| Property inventory writes | No | No | Assigned + plan | Organization + plan | Reasoned intervention |
| Invite/confirm booking | No | No | Assigned + allowed capability | Own organization | Reasoned intervention |
| Accept/release own hold | No | Yes | No impersonation | No impersonation | Exceptional intervention |
| Exceptionally cancel/block | No | No | Only if delegated | Own organization | Yes, with reason |
| Payment/credit fulfillment | No | No | No | No | Worker role only; admin can request correction |

FR-01: accounts MUST have verified email before a commitment or queue membership. Admin access MUST use MFA. Browser clients MUST NOT hold privileged database keys. Staff access MUST check active organization membership and explicit property assignment. Organization owners implicitly access all properties in their organization.

## 2. Inventory and time model

FR-02: hierarchy is organization → property → floor → room → bed. Foreign keys MUST prevent children from referencing resources in another hierarchy. Archived inventory is retained when referenced by history. Public listings require owner approval and platform publication approval at pilot launch.

FR-03: **operational availability** (`enabled`/blocked) is separate from **allocation state**. Blocked/unpublished beds do not count as vacant. The UI derives colors from active allocation: INVITED/OFFERED/HELD = yellow, BOOKED = red, no active allocation = green if operationally eligible. A blocked bed displays a neutral unavailable marker regardless of previous color.

FR-04: store UTC `timestamptz`; return RFC3339 timestamps and `serverTime`. Display IST by default with exact date/time/timezone. Eligibility uses database `clock_timestamp()` after obtaining locks. A deadline is valid only while `now < expires_at`; equality means expired. Client countdowns are informational.

### Allocation state machine

| Current | Trigger | Next | Required consequence |
|---|---|---|---|
| None | Owner invites verified student, no eligible queue | INVITED | Two-hour acceptance reservation; duration terms recorded |
| INVITED | Student accepts in time | HELD | Start agreed 1–48-hour hold; immutable deadline |
| None | FIFO promotion | OFFERED | Two-hour exclusive offer; linked queue entry marked OFFERED |
| OFFERED | Student accepts in time | HELD | Start fresh 48-hour hold; entry becomes CONVERTED |
| INVITED/OFFERED/HELD | Deadline reached | EXPIRED | Audit, notice and promotion in same inventory transaction |
| INVITED/OFFERED | Student declines | RELEASED | Invitation/offer closed; promotion |
| HELD | Student releases | RELEASED | Promotion; no credit refund because access credits do not buy holds |
| HELD | Owner confirms offline agreement before expiry | BOOKED | Booking row; clear allocation deadline; close remaining queue |
| INVITED/OFFERED/HELD | Exceptional cancellation | CANCELLED | Reason, audit, block bed; do not promote onto blocked inventory |
| BOOKED | Owner records checkout/cancellation | ENDED | End booking, then promote if an eligible queue exists |

BOOKED means committed inventory; v1 does not represent simultaneous future stays. Normal booking requires a HELD allocation. For a walk-in, use invitation → student acceptance → booking rather than bypassing fairness. No automated extensions, commercial overrides or reactivation of expired allocations.

FR-05: booking confirmation MUST include move-in date, agreed monthly price (paise), and optional offline reference. It is an owner's record, not a payment-provider confirmation. Once BOOKED, other active queues are CLOSED with `bed_booked` reason. Cancelled bookings do not erase history.

## 3. Invitation and queue rules

FR-06: initial holds are owner-assigned after a visit/direct interaction. The API resolves a verified student by an existing inquiry or owner-student invitation acceptance workflow; it MUST NOT expose an unrestricted account email directory. Unknown addresses receive an invitation to register, but no bed allocation starts until a verified account is linked and the two-hour invitation is issued.

FR-07: free students may join a bed queue through an owner-issued, student-scoped access grant. Owner UI sends a signed, short-lived link to redeem that grant; token is single-use, stored hashed, account-bound and valid 24 hours. The resulting bed grant lasts 14 days. A valid property-detail entitlement also authorizes queue entry. Tracking an existing entry remains free after grant expiry.

FR-08: one live queue membership per student/bed, up to three across the platform. WAITING and OFFERED count toward the cap. One pending INVITED/OFFERED/HELD allocation per student; BOOKED does not consume that cap. Queue membership is separate from a bed reservation.

FR-09: assign a monotonically increasing queue sequence while holding the bed lock; order by sequence, never payment tier or client timestamps. Eligibility requires verified, active account, WAITING entry, no active INVITED/OFFERED/HELD allocation and an enabled, published property/bed. Existing eligible queue members take precedence over new owner invitations.

FR-10: promotion reserves only for the earliest eligible entry. A student's other active commitment temporarily makes them ineligible; keep their WAITING sequence. Successful offer issuance does not revoke earlier offers when someone else becomes eligible. Accepting an offer consumes its membership; expired/declined offers are terminal. Rejoining creates a new sequence.

FR-11: leaving an OFFERED queue is equivalent to declining the offer and MUST close both entry and allocation atomically. Joining a green bed returns `BED_AVAILABLE` and directs the student to arrange an owner invitation. Joining a BOOKED/blocked bed returns `QUEUE_CLOSED`.

## 4. Transaction contracts

FR-12: all state-changing commands MUST run as one database transaction, through a narrow command function. Basic table writes by application clients are prohibited. Each command validates caller, resource scope, current state and version, then locks the bed row, rechecks database time, reconciles due state, and applies the transition. Reconciliation and promotion cannot be split across independent HTTP requests.

FR-13: unique partial indexes prevent multiple active allocations per bed and multiple pending/held allocations per student. In promotion, a concurrent allocation of the selected student may trigger the student uniqueness constraint; handle that expected constraint in a savepoint, reread eligibility and continue. Never suppress other database errors. `SKIP LOCKED` can partition bed batches, not reorder people inside a bed's queue.

FR-14: queue joins also serialize the student's queue-cap check with a transaction advisory lock, then lock the bed. Other code MUST NOT acquire those student-cap locks after bed locks. Credit unlocks serialize on the student profile row. Multi-bed administrative work uses increasing bed UUID order or separate transactions.

FR-15: each mutation MUST accept `Idempotency-Key` scoped to actor + operation. Store request hash/result atomically with its business effect. Same key and same payload replays the original status/body for 24 hours; different payload returns `IDEMPOTENCY_CONFLICT`. Permanent business uniqueness continues after request-record expiry. Conflicting allocation writes return HTTP 409 with machine-readable reason.

FR-16: update allocation version, audit event, queue state and outbox events in the same commit. Notifications are not sent inside the transaction. Failure rolls back the whole inventory mutation. Use bounded lock timeout and retry only deadlocks/serialization failures up to three attempts with jitter; idempotency protects retries.

## 5. Entitlements, credits and billing

FR-17: free discovery returns public descriptions/photos/location and aggregate counts, never full bed IDs, layout assets or other applicants. Own bed/queue DTOs are an explicit narrow exception. Layout URLs are private and short-lived; expiration of a signed URL cannot retract copies already downloaded.

FR-18: a valid student subscription OR unexpired property entitlement unlocks details. A credit unlock grants 30 elapsed days from database commit. If already unlocked or subscribed, return access without debit. Otherwise lock the wallet/profile, verify positive ledger balance, create entitlement and debit one credit in the same transaction. Negative wallet balances are invalid. Explicit unlock action only; opening a page never silently spends credits.

FR-19: subscriptions are organization-scoped for owner plans and user-scoped for student plans. Access requires an active paid-through interval; `cancel_at_period_end` retains access until that interval ends. Failed payment does not extend it. Provider state labels alone cannot grant access. No v1 trial is assumed.

FR-20: signed webhook events MUST be durably persisted before acknowledgment. Invalid signatures return 400, durable storage failure returns 503. Duplicate events return 200 without duplicate fulfillment. Deduplicate both provider event IDs and payment/business fulfillment IDs. Reconcile provider state for out-of-order events; do not blindly overwrite newer paid-through state.

FR-21: credit top-ups use nontransferable access credits, not a withdrawable wallet. Grant once per captured payment. Refunds reverse unspent credits; if purchased credits have been spent, require support review and an explicit ledger correction without making the balance negative. The platform never automatically refunds offline rent. Subscription refund/access changes follow recorded policy and verified provider events.

## 6. Notifications, realtime and failure behavior

FR-22: in-app inbox is durable and authoritative; email is the required launch delivery channel. Notify on invitation, acceptance, hold release/expiry, offer issuance/decline/expiry, booking, exceptional cancellation, queue closure and billing/access changes. Hold reminders occur 24 hours and 2 hours before deadline when those points fall after creation; offer reminder at 30 minutes remaining. Deduplicate each reminder by allocation + deadline + reminder type.

FR-23: notification delivery cannot guarantee a read. Offer windows start when the offer and inbox record commit, not when an email is delivered. Retries do not extend the deadline. Expose delivery failure to owner/support; avoid telling users an email was received merely because provider API accepted it.

FR-24: outbox delivery uses leases, attempts, `next_attempt_at`, exponential backoff, and terminal failure after 10 attempts or 24 hours, whichever comes first. Notification workers recheck current allocation/version before sending actionable reminders so delayed notices do not invite acceptance of a closed offer. Permanent recipient failures are terminal immediately; inbox remains available.

FR-25: authorize realtime channels per subject/property entitlement. Broadcast only resource ID, version and event kind; fetch data through authorized API. Refetch on reconnect and every 30 seconds on active commitment pages. No applicant names/emails in property-wide events. Entitlement changes invalidate protected subscriptions; layouts remain fetched through the API.

FR-26: a one-minute expiry job scans due INVITED/OFFERED/HELD allocations in bounded bed-locked batches. Reads represent expired commitments as expired even if materialized promotion lags. Writes always reconcile before deciding. Report `reconciling` rather than showing overdue yellow inventory as immediately vacant when a queue may exist. A second reconciliation path runs on relevant commands.

## 7. Nonfunctional requirements

| ID | Target | Measurement |
|---|---|---|
| NFR-01 | Zero successful conflicting bed allocations | Concurrency and invariant tests; database constraints |
| NFR-02 | 99.5% monthly application availability target | External authenticated health journey; not a provider guarantee |
| NFR-03 | p95 search <1s; mutations <1.5s | Same-region pilot workload: 100 concurrent sessions, 100k beds, 50 searches/s, 10 mutations/s; exclude external checkout and uploads |
| NFR-04 | Normal expiry processing within 90s | Database deadline to transition commit; alert over 120s |
| NFR-05 | In-app notice committed with transition; email attempt within 60s normally | Outbox age; provider latency separately measured |
| NFR-06 | WCAG 2.2 AA target, 360px+ responsive | Automated and manual keyboard/screen-reader checks |
| NFR-07 | RPO ≤24h, RTO ≤4h initial launch targets | Chosen backup plan plus staging restore drill; enable PITR before advertising tighter guarantees |
| NFR-08 | Cross-tenant isolation and no paid-data leaks | RLS, API, object storage and realtime negative tests |

Security: validate on server, parameterize queries, check origin/CSRF on cookie-auth mutations, rate-limit auth/search/queue operations, rotate secrets, scrub PII from logs, validate media signatures/dimensions, restrict upload sizes and Maps keys, and audit administrator access. Data export/deletion is a support-admin flow in v1 with identity verification and retention-aware anonymization; no hard deletion of financial/audit records through normal UI. Publish retention durations before launch instead of asserting unreviewed legal compliance.

## 8. Deferred modules

AI receives only authorized published listing data and produces validated filters/drafts; it does not allocate inventory or consume credits. Hourly stays require requested intervals, checkout boundaries, buffers and a shared exclusion-constrained reservation model before activation. Current global bed allocation is intentionally not reused as if it already supports future time slices.
