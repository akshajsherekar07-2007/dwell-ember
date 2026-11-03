# Dwell Ember — Operations Runbook

## 1. Environments and configuration

Separate local/test, staging and production Supabase, Razorpay modes, email recipients and application origins. Never connect a preview build to production write credentials. Test email goes to an allowlist/sandbox; test-mode Razorpay cannot fulfill production subscriptions.

Required configuration groups: application origin and auth redirect allowlists; Supabase URL/publishable key; isolated server/worker secrets; Razorpay key ID/secret and webhook secret; email provider credential/sender; separate restricted Maps browser/server keys; observability DSN; feature flags; approved production plan IDs and catalog prices/caps. Browser-exposed variables contain public identifiers only.

No production secrets are included in this repository. Keep environment files ignored. Use provider secret stores, scoped keys and rotation procedures.

## 2. Provisioning and deployment sequence

1. Create database in Mumbai; verify extensions, chosen backup capability and actual recovery policy. Record provider project and region identifiers.
2. Apply versioned migrations from empty database on staging, including command functions and storage policies. Schema bootstrap alone is not sufficient for launch.
3. Create public approved-photo bucket, private layout bucket and private quarantine bucket. Configure size/type limits, approved-path publication, short-lived layout URLs and re-encoding/EXIF removal.
4. Configure Auth, sender domain, redirects, admin MFA, application service roles and rate limits.
5. Configure application deployment, worker capabilities, Maps keys/quotas and payment test-mode webhooks.
6. Register minute reconciliation and outbox schedules; keep secrets in Vault/worker config. Check actual run logs and failure alerts.
7. Run smoke scenarios against staging. Apply reviewed production migration, deploy compatible app, enable required integrations and perform a small authorized live paid test before public paid launch.

Pricing: obtain current provider quotes at provisioning. Set spend alerts for hosting, database/storage/egress, email and Maps. Payment fees and tax treatment are provider/account-specific; do not treat a documentation example as a quote or tax advice.

## 3. Monitoring and alert thresholds

| Signal | Initial trigger | Action |
|---|---|---|
| Authenticated application health | 3 consecutive failures over 3 minutes | Check deploy, Auth and DB; notify operator |
| Due allocation lag | Oldest due >120 seconds | Check cron/function locks/errors; run bounded reconciliation |
| Outbox age | Oldest actionable pending >120 seconds | Check scheduler, leases, provider/API failures |
| Delivery failure | Permanent bounce or retry exhaustion | Surface in admin inbox; correct contact/delivery channel |
| Webhook backlog | Oldest unprocessed >5 minutes | Check signature config, inbox worker and provider fetch |
| Inventory inconsistency | Any overlapping active allocation or booking mismatch | Freeze affected bed commands, inspect audit, repair through audited command |
| Latency / DB saturation | p95 above SRS target for 15 minutes or connection pressure | Inspect query plans, locks, pool sizing and load |
| Inventory freshness | Owner-defined inventory not reconfirmed for 24 hours | Owner prompt and stale indicator; never silently assume vacant |

Measure email attempt, provider acceptance and actual delivery separately. A delivered message is not proof of a read. Use request/event IDs in structured logs; redact tokens, contact details and raw payment payloads from general logs.

## 4. Incident procedures

### Expiry job failed

Inspect cron run logs and database lock waits. Stop duplicate unbounded jobs, then run the normal bounded reconciler with a worker identity. It uses database deadlines, not restart time. Confirm affected inbox/outbox events and FIFO outcomes. Do not manually recolor beds or extend expired holds to hide an outage. Commands continue reconciling individually.

### Email provider unavailable

Inventory and in-app inbox remain authoritative. Resume leased pending deliveries after lease expiry; recheck allocation state before sending. Inspect exhausted/permanent failures. Do not roll back allocations or restart offer timers automatically. Support can contact affected students through authorized channels, but the system does not claim successful external notice before delivery evidence.

### Payment events duplicate or arrive out of order

Verify stored signature-validated event and unique event/payment fulfillment IDs. Fetch current provider subscription/payment state and compare catalog amount/currency before correction. Replay via idempotent worker, never by manually adding balance. If inbox persistence is broken, return non-2xx so retries remain possible.

### Disputed allocation / emergency closure

Inspect actor/timestamp history, invitation terms, acceptance, version and deadline. Limit changes to the affected bed. A verified operational issue permits reasoned cancellation/block; commercial displacement does not. Preserve history and notify affected users. Record block resolution after inspection; if waiting entries remain, promotion precedes new owner assignment.

### Suspected data exposure

Disable affected endpoint/feature, revoke or rotate implicated service credentials, preserve necessary incident evidence with restricted access, patch authorization, and run cross-tenant/privacy tests. Follow reviewed incident communication policy. Do not place secrets or affected-user data in a public issue or general application log.

## 5. Backup and recovery

Initial recovery targets are RPO ≤24h and RTO ≤4h, conditional on chosen provider backup plan and a successful drill. Record exact backup schedule and retention before launch. Enable PITR if a tighter recovery objective is needed; do not advertise it merely because the provider offers the feature.

Database backups do not necessarily restore object-storage files. Keep an explicit media backup/restore strategy. Quarterly and before high-risk migrations: restore into isolated staging, verify constraints and row counts, replay safe reconciliation, validate private storage URLs/access, and compare ledger/provider references. A recovery must not resend old actionable offers blindly or duplicate payment fulfillment.

## 6. Rollback and retention

Use feature flags to disable new assignments, credit purchases or short-stay experiments independently. Existing release/booking/checkout functionality should remain available. Use expand/contract migrations and roll back app code only to a schema-compatible release; destructive down migrations are not the default recovery action.

Before paid public launch, approve user-facing terms, cancellation/refund rules, privacy/retention periods and support process. Implement retention-aware anonymization rather than deleting financial/audit rows. Schema immutability rules intentionally require a separately reviewed privileged maintenance path for legally required anonymization; no blanket delete API is provided.
