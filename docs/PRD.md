# Dwell Ember — Product Requirements Document

Version 1.0 · 2 November 2026 · Status: implementation baseline

## 1. Product thesis

Students often find the right bed before they are ready to commit. During conversations with parents or visits to other properties, the bed is allocated to someone else. Owners have no reliable record of priority or obligation to the earlier student. Dwell Ember makes that decision window visible and enforceable inside the platform through protected holds, fair offers and an auditable allocation history.

**Value proposition:** find accommodation, get time to decide, and know exactly where you stand. Owners gain a dependable bed inventory and interested-student queue.

The platform cannot enforce off-platform owner behavior or guarantee that a message is read. Promise an explicit reservation deadline, recorded allocation rules, and attempted/delivered notification status, rather than an unconditional guarantee that accommodation can never be lost.

## 2. Users and jobs

| Persona | Job | Success |
|---|---|---|
| Student moving to a new city | Compare PGs/hostels, consult family, preserve a preferred option | Knows bed, cost, deadline and next action |
| Parent/guardian supporting a student | Help compare location, amenities and affordability | Student can share a public property page without exposing personal records |
| Owner/operator | Keep inventory current, manage interest, confirm bookings | No competing allocations; queue and expiry work without manual tracking |
| Property staff member | Operate only assigned properties | Can create invitations and record legitimate transitions within delegated permissions |
| Platform administrator | Resolve incidents and disputed allocations | Can inspect evidence, act with a reason, and preserve audit history |

Owners may also hold student accounts; permissions attach to organization membership and resource, not one permanent account-wide role.

## 3. Launch scope and priorities

### P0 — pilot requirements

1. Account creation, verified email, Google sign-in, owner onboarding and property-scoped staff access. Phone verification may be added before SMS activation; it is not required for the email-first pilot.
2. Property creation with address/map pin, amenities, price information, photos, publication status and floors → rooms → beds.
3. Student search by locality/radius, price, accommodation category, room sharing, amenities and property audience policy. Exact gender/occupancy policies are owner-supplied, explicitly displayed and never inferred by AI.
4. Owner-created bed invitation, student acceptance, up-to-48-hour hold, voluntary release, booking confirmation and checkout.
5. FIFO per-bed waitlists, exclusive offers, reminders, expiry reconciliation and personal notifications.
6. Student dashboard for saved properties, offers, holds and queues; owner dashboard for inventory and requests.
7. Free aggregate discovery; subscription/credit-controlled detail access.
8. Owner and student paid plans, credit purchases, webhook reconciliation, audit and incident tools.

### P1 — after a stable pilot

AI-assisted filters and owner listing drafts; optional SMS/WhatsApp delivery; richer owner analytics; bulk inventory import; advanced floor editing.

### P2 — separate release

Hourly/daily visitor stays, interval conflicts across long/short stays, cleaning buffers and time-based pricing. Future roadmap includes tenant operations and internationalization only after customer validation.

Hospital clinical workflows, native apps, online rent/deposit collection, commissions, roommate matching and paid queue priority are outside v1.

## 4. Core journey

1. Student discovers a property and sees public details plus aggregate available beds.
2. Student visits or contacts the owner. Owner locates the student's verified account and invites them to a vacant bed. Invitations cannot displace an existing eligible queue.
3. Student receives an in-app/email invitation with bed label, property, deadline and terms. Two hours are reserved for acceptance; the hold itself has not started.
4. Acceptance starts the agreed hold, at most 48 hours. Student may consult family, compare options or release early.
5. Owner confirms an offline accommodation agreement for that holder. Red means committed/booked, including before move-in.
6. If the hold expires or is released, the first eligible queued student receives an exclusive two-hour offer. Acceptance starts their fresh 48-hour hold. Decline/expiry advances the queue.

An empty eligible queue returns the bed to vacant. Every allocation change produces an audit record and durable notification intent.

## 5. Fairness and exceptional events

- Hold deadlines are protected after acceptance; no paid applicant can jump the queue.
- Initial invitation terms may specify 1–48 hours; duration is immutable after acceptance. Automatic queue offers always grant a fresh 48 hours.
- One pending invitation/offer/active hold per student across the platform; at most three live queue memberships.
- Students temporarily ineligible due to another commitment retain their queue sequence; the next eligible student may receive an offer. Once skipped legitimately, no already-issued offer is recalled.
- Owners cannot override a hold for a higher bidder or more decisive applicant. Safety, bed damage or inventory errors allow exceptional cancellation with a reason and operational block. The bed stays blocked until corrected.
- Booking a bed closes all remaining queue entries with notice. Reopening after checkout does not silently reinstate those entries.

## 6. Business model and entitlements

| Offering | Capability | Commercial default |
|---|---|---|
| Free student | Public listings/counts, own commitments and invited queues | No charge |
| Student subscription | Detailed layouts and specific vacancies across published properties | Monthly subscription; no queue advantage |
| Student detail credit | One property's detail access | One credit for 30 days; repeat access during validity is free |
| Owner subscription | Inventory management, new invitations, staff and queue tools | Monthly per-organization plan with configurable property/bed caps |

Do not invent a final price before willingness-to-pay interviews. Catalog prices and caps are configuration; paid launch requires configured, approved INR plans. A test catalog uses clearly labelled test-mode prices only.

Owner subscription lapse stops new inventory and invitation creation but preserves read access, existing queue processing, booking/release/checkout and emergency actions. Existing student commitments never depend on continuing premium access. Queue-entry access is checked at entry; lapse does not eject existing students.

## 7. Metrics

Measure discovery → visit/contact intent, invitation acceptance, hold → booking conversion, time-to-allocation, queue acceptance, expiry lag, notification delivery lag, vacancy freshness and owner weekly activity. Report exceptional cancellation rates separately from student abandonment.

Pilot learning goals: 5–10 participating properties, coverage of all three bed states, genuine multi-student queue cases, and interviews with at least 10 students and 5 operators. Conversion targets are set after this baseline; they are not fabricated market benchmarks.

## 8. Product acceptance criteria

| ID | Scenario | Acceptance |
|---|---|---|
| AC-01 | Two owners/staff try assigning the same bed | One allocation succeeds; other receives a clear conflict |
| AC-02 | Student accepts before invitation/offer deadline | Protected hold starts from database acceptance time |
| AC-03 | Student tries confirming an expired hold | Booking is refused even if the expiry worker is delayed |
| AC-04 | Hold expires with a queue | First eligible entry receives exclusive offer; new arrival cannot bypass it |
| AC-05 | Free student tracks assigned bed | Own bed/deadline/actions visible without premium purchase |
| AC-06 | Credit unlock is retried/concurrent | One entitlement and one debit; access expires after 30 days |
| AC-07 | Subscription or notification provider fails | Inventory commitments remain correct; failure is visible/retryable |
| AC-08 | Owner exceptionally cancels | Required reason, audit, student notice and bed block |
| AC-09 | Booking confirmed | Bed red, holder notified, other queued students notified and closed |
| AC-10 | Mobile user loses connection | Reconnect refetches status; offline countdown never authorizes a write |

## 9. Dependencies and launch risks

Owner accuracy and off-platform behavior remain important. Display freshness, provide correction/reporting tools and use a verification/publishing process. Payment production activation, email sender setup, Maps billing/keys, production backup selection, account policies and customer-facing terms must be completed before public launch. They do not block creating the foundation locally.
