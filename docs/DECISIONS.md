# Dwell Ember — Decisions and Requirement Traceability

## Confirmed by the user

| Topic | Decision |
|---|---|
| Brand | Dwell Ember |
| Market | India first, INR |
| First release | Long-stay student PGs/hostels; hourly stays later |
| Hold promise | Protected until deadline; exceptional owner intervention is audited |
| Initial hold | Owner assigns after visit/direct interaction |
| Monetization | Owner SaaS + optional student subscriptions/detail credits; offline rent |
| FIFO promotion | Two-hour acceptance offer, then fresh 48-hour hold |
| Team | Solo founder |
| AI | After core launch |
| Documents | Markdown + SQL + OpenAPI |

## Implementation defaults selected

| Topic | Default and reason |
|---|---|
| Hold acceptance | Two-hour invitation before initial protected hold; stops unaccepted invitations locking inventory for 48h |
| Duration | Initial agreed hold 1–48h, default 48h; no unilateral shortening/extension |
| Limits | One pending/held allocation per student, three live queues, one membership per bed |
| Queue access | Owner-issued student-bound invitation or property-detail entitlement; existing tracking stays free |
| Credits | One credit unlocks one property for 30 elapsed days; no debit while access/subscription already valid |
| Identity | Verified email/Google launch; SMS/WhatsApp optional later; admin MFA |
| Safety exceptions | Required reason and bed block; no displacement for another paying student |
| UI | Responsive web, English first, IST display, semantic status labels/icons |
| Plan lapse | Restrict creation while preserving existing commitments and normal closure actions |
| Public listing | Platform-reviewed publication during pilot |
| Invite grants | Account-bound token 24h; redeemed queue access 14 days |
| Messaging | Durable in-app inbox + email; windows measured from inbox commit |
| Infrastructure | Next.js + managed Supabase in Mumbai; no separate API fleet |
| Final prices/caps | Catalog configuration; approve before paid launch after interviews |

## Cross-artifact traceability

| Requirements | PRD acceptance | Primary implementation | Verification |
|---|---|---|---|
| FR-01, FR-02, FR-17 | AC-05 | Identity, hierarchy, scoped reads and storage | Tenant isolation; free vs paid; own-bed exception |
| FR-03–FR-05 | AC-01–AC-03, AC-09 | Allocation and booking commands | State matrix; expiry boundary; booking races |
| FR-06–FR-11 | AC-04 | Invitations, FIFO queue and eligibility | Account-link replay; cap races; queue ordering |
| FR-12–FR-16 | AC-01, AC-03, AC-06 | Transaction RPCs, locks, constraints, idempotency | 100-way contention; duplicate requests; rollback |
| FR-18–FR-21 | AC-06, AC-07 | Entitlements, immutable ledger, verified billing inbox | Concurrent debit; duplicate/out-of-order webhooks; refunds |
| FR-22–FR-26 | AC-07, AC-08, AC-10 | Inbox/outbox, minute reconciliation and realtime | Worker outage; stale reminders; reconnect; delivery failures |
| NFR-01–NFR-08 | All relevant ACs | CI, monitoring, backup and accessibility | Load, restore, privacy and browser evidence |

API operations include `x-requirements` so tests can connect operation behavior to this matrix. SQL constraints enforce only the invariants identified in DATABASE; command-level behavior is not claimed to exist until implemented and tested.

## Change control

If a product rule changes, update the SRS first, then PRD acceptance, schema/migrations, API contract, UX copy and tests in the same work package. For a running release, use a migration and compatibility rollout; do not silently reinterpret previously accepted hold terms.

## Owner offline-status decision — 3 November 2026

The owner may record Available, On hold (1–48 hours) and Booked after an offline interaction. Offline guests do not need accounts, and their optional contact information stays owner-only. Linked students and waitlisted students receive in-app updates. Ending an active reservation or correcting a booking back to a hold requires a reason; current registered reservations cannot be silently reassigned. Releasing inventory promotes the next eligible waitlisted student and does not bypass FIFO. This explicit owner workflow supersedes the earlier restriction to student-initiated release while retaining version checks, queue order, bounded deadlines and event history.
