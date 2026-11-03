# Dwell Ember — API Documentation

Version 1.0 · JSON REST under `/api/v1` · [Machine contract](../api/openapi.json)

This is an implementation specification; endpoints are not deployed. The OpenAPI contract is generated from `scripts/build_openapi.py`. Authentication endpoints use the Supabase Auth SDK and configured SSR session integration; they are not duplicated as invented password endpoints here.

## 1. Conventions and authorization

- Verify signed identity on every protected request; derive actor ID, never trust client roles. Organization owners/staff require resource-scoped membership. Admin endpoints additionally require server-controlled admin authorization and MFA; they are not granted by membership role.
- Support a same-origin application session cookie (`de-session` adapter) backed by server-verified Supabase identity, or bearer JWT for trusted clients. The adapter must implement refresh/chunked-cookie handling and verify identity on the server; its final implementation is tested with Supabase SSR in phase 0. Cookie-authenticated browser mutations require CSRF token and origin checks.
- Protected and paid responses use `Cache-Control: private, no-store`. Public listing caches carry `availabilityAsOf` and never determine booking success.
- Return UUID identifiers, integer paise, RFC3339 instants, camelCase JSON and `meta.serverTime` from the database-associated request clock. Database identifiers/sequence numbers beyond JavaScript precision must be strings.
- Normal success shape: `{ "data": ..., "meta": { "requestId": "uuid", "serverTime": "..." } }`. List data is an array; include opaque `meta.nextCursor` only when another page exists. Cursor results use stable ordering plus unique ID.
- Errors: `{ "error": { "code": "HOLD_EXPIRED", "message": "..." }, "meta": {...} }`. User-facing messages contain no SQL, secrets or unrelated applicant identity.
- All user mutation requests require `Idempotency-Key` (8–128 characters); same actor + operation + key + payload returns the original response for 24 hours. Different payload returns 409. Underlying financial uniqueness lasts beyond this window.
- Allocation mutations carry `expectedVersion`; initial invitations carry `expectedBedVersion`. Stale version returns 409 `VERSION_CONFLICT` and current version if authorized. Updating catalog metadata does not reuse bed allocation version; normal PUT is last-write-wins until catalog revision support is added.
- Worker reconciliation and fulfillment are not public unauthenticated HTTP endpoints. They call restricted internal functions.

## 2. Endpoint catalog

| Group | Operations | Access |
|---|---|---|
| Discovery | `GET /properties`, `/properties/{id}`, `/amenities` | Public minimal projection; aggregate counts only |
| Details | `GET /properties/{id}/layout`, `POST /properties/{id}/unlock` | Entitlement/operator; explicit credit action |
| Student account | `GET /me`, `/me/allocations`, `/me/waitlists`, `/me/saved-properties` | Subject only |
| Saved properties | `PUT/DELETE /me/saved-properties/{id}` | Subject only |
| Allocations | `GET /allocations/{id}`, `POST .../accept`, `POST .../release` | Subject; operator may read scoped allocation |
| Queue | `POST /waitlists`, `DELETE /waitlists/{id}`, `POST /bed-access/redeem` | Verified student with entry access |
| Inbox | `GET /me/notifications`, `POST /me/notifications/{id}/read` | Subject only |
| Billing | Plans, credit packs, checkout, subscriptions, credits | Public catalog; protected purchases/account data |
| Owner tenancy | Organizations, staff, scoped properties, overview | Organization owner or assigned staff as specified |
| Owner inventory | Floors, rooms, beds, uploads, publication submission | Scoped operator; plan gates creation |
| Owner allocation | Bed invitation, queue invitation, booking, exceptional cancellation, block/resolve, checkout | Scoped capabilities and state guards |
| Admin | Listing approval, incidents, audit, delivery replay | MFA administrator; record reason/access |
| Provider | `POST /webhooks/razorpay` | Raw-body HMAC signature, durable provider-event inbox |

Canonical acceptance uses `/allocations/{id}/accept` for both initial invitations and waitlist offers. It dispatches to one domain transaction; there are no independently implemented `/offers` and `/holds` engines.

## 3. Worked example: initial invitation and acceptance

Owner creates invitation after account linking and direct interaction:

```http
POST /api/v1/owner/beds/11111111-1111-4111-8111-111111111111/invitations
Authorization: Bearer <owner-jwt>
Idempotency-Key: invite-demo-0001
Content-Type: application/json

{"studentId":"22222222-2222-4222-8222-222222222222","holdDurationHours":48,"expectedBedVersion":3}
```

```json
{
  "data": {
    "id": "33333333-3333-4333-8333-333333333333",
    "bedId": "11111111-1111-4111-8111-111111111111",
    "propertyId": "44444444-4444-4444-8444-444444444444",
    "state": "invited",
    "source": "owner_invitation",
    "version": 1,
    "holdDurationSeconds": 172800,
    "createdAt": "2026-11-02T08:00:00Z",
    "expiresAt": "2026-11-02T10:00:00Z"
  },
  "meta": {"requestId":"55555555-5555-4555-8555-555555555555","serverTime":"2026-11-02T08:00:00Z"}
}
```

Student accepts at 08:30 UTC:

```http
POST /api/v1/allocations/33333333-3333-4333-8333-333333333333/accept
Authorization: Bearer <student-jwt>
Idempotency-Key: accept-demo-0001
Content-Type: application/json

{"expectedVersion":1}
```

Response is the same allocation with `state: held`, `version: 2`, `acceptedAt: 2026-11-02T08:30:00Z` and `expiresAt: 2026-11-04T08:30:00Z`. The two-hour invitation period does not consume the accepted 48-hour hold.

## 4. Worked example: queue and promotion

`POST /waitlists` accepts `{ "bedId": "..." }`. A free student needs a redeemed bed grant; a paid student may use property detail access. Response contains the student's entry, ordinal position and current eligibility. Neither queue response nor realtime exposes the complete applicant roster to a student.

After the holder releases/expires, the database issues the first eligible entry an exclusive OFFERED allocation. Inbox/realtime points to it; the student accepts via the same allocation endpoint. The offer expires two hours after creation and an accepted promoted hold lasts a fresh 48 hours. Deleting an OFFERED queue entry also declines/releases its associated allocation in the same transaction.

Initial owner invitation must not bypass earlier eligible queue entries. The command can commit due reconciliation and return `QUEUE_PRIORITY_REQUIRED` if promotion consumed the bed.

## 5. Worked example: detail unlock

```http
POST /api/v1/properties/44444444-4444-4444-8444-444444444444/unlock
Authorization: Bearer <student-jwt>
Idempotency-Key: unlock-demo-0001
```

```json
{
  "data": {
    "propertyId":"44444444-4444-4444-8444-444444444444",
    "accessSource":"credit_unlock",
    "validUntil":"2026-12-02T08:30:00Z",
    "creditsDebited":1
  },
  "meta":{"requestId":"55555555-5555-4555-8555-555555555555","serverTime":"2026-11-02T08:30:00Z"}
}
```

Already subscribed/unlocked/operator access returns `creditsDebited: 0`; it never creates an extra charge on retry. `GET .../layout` issues private asset URLs valid five minutes, rechecking permission each time URLs are issued. Revoked users may retain a previously downloaded copy; do not claim URL expiry retracts it.

## 6. Error and failure catalog

| HTTP | Codes / meaning |
|---|---|
| 400 | `BAD_REQUEST`, `INVALID_SIGNATURE`, `INVALID_SEARCH_LOCATION` |
| 401 | `AUTH_REQUIRED`, `SESSION_EXPIRED` |
| 403 | `ACCOUNT_UNVERIFIED`, `ACCOUNT_INACTIVE`, `RESOURCE_FORBIDDEN`, `ENTITLEMENT_REQUIRED`, `OWNER_PLAN_REQUIRED` |
| 404 | `NOT_FOUND` (including hidden resources where existence should not leak) |
| 409 | `BED_UNAVAILABLE`, `BED_AVAILABLE`, `HOLD_EXPIRED`, `OFFER_EXPIRED`, `QUEUE_PRIORITY_REQUIRED`, `ACTIVE_COMMITMENT_EXISTS`, `QUEUE_LIMIT_REACHED`, `QUEUE_CLOSED`, `ALREADY_QUEUED`, `VERSION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `INSUFFICIENT_CREDITS`, `INVITATION_USED`, `INVITATION_EXPIRED` |
| 422 | `VALIDATION_FAILED`, `CAPACITY_EXCEEDED`, `PLAN_LIMIT_EXCEEDED` |
| 429 | `RATE_LIMITED`; include `Retry-After` |
| 503 | `DEPENDENCY_UNAVAILABLE`; retry with same idempotency key when applicable |

Do not label a failed payment as failed booking: v1 bookings are offline and independent of plan/credit payment. Unexpected SQL errors are opaque 500s with a request ID, logged privately. Business conflicts do not trigger unbounded server retries.

## 7. Provider and realtime contracts

Razorpay: HMAC-SHA256 over exact request bytes; use webhook secret, not API key secret. Require provider event ID, persist verified payload, acknowledge 200 promptly, and fulfill asynchronously/idempotently. Duplicate events return 200. Signature rejection returns 400; inbox storage outage returns 503. Keep verified payment-event payloads restricted and retention controlled.

Realtime signal shape:

```json
{"eventId":"66666666-6666-4666-8666-666666666666","kind":"allocation.changed","resourceId":"33333333-3333-4333-8333-333333333333","version":2}
```

Channels: `user:{subjectId}` for inbox/commitments; `property:{propertyId}` for authorized inventory signals. Channel access is authenticated and checked server-side. Realtime payloads have no student PII. Clients ignore older versions, refetch on signals/reconnect, and poll active commitment screens every 30 seconds. Expired paid access prevents continued property subscriptions and layout reads.

## 8. Limits and contract maintenance

Default list page size 20, maximum 100; radius maximum 50km. JSON request maximum 256KB except webhook maximum 1MB. Images upload directly through constrained signed URLs, at most 10MB each. Initial application rate limits: 120 authenticated reads/minute/user, 30 mutations/minute/user, 60 public searches/minute/IP; tune with measured traffic and provider auth limits. Provider webhooks use signature verification and appropriately sized independent limits rather than the student bucket.

OpenAPI schemas define field-level requests/responses. SRS guards remain normative for cross-field and state-dependent validation. Rebuild contract and run validator after edits; any implementation route change must update this contract and relevant browser/domain tests.

## Local prototype: owner status command

Authenticated owners can POST an idempotent `ownerSetBedStatus` command to `/api/demo`, with `bedId`, `expectedVersion`, `status` (`available`, `on_hold`, `booked`) and `durationHours` (1–48). Optional `offlineGuest` contains `name`/`phone`; `studentEmail` links an existing student server-side. `booked` requires `moveInDate` (valid YYYY-MM-DD) and `agreedPrice`; clearing an active reservation or converting a booking back to a hold requires `reason` (5–500 characters). API responses include the scoped updated state and a message explaining any FIFO promotion. This prototype command is separate from the production OpenAPI contract. Production schema work must support owner-private guest reservations without fabricating authenticated student accounts.
