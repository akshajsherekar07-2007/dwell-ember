# Dwell Ember — UI/UX Specification

## 1. Product character and foundations

Dwell Ember should feel calm, trustworthy and contemporary. Warm neutrals support the brand's sense of home; restrained amber references the ember. Interface status colors remain semantic, never decorative pressure tactics. Main line: **Find your place. Take your time.**

| Token | Value / usage |
|---|---|
| Canvas / surface | `#FAF8F5` / `#FFFFFF` |
| Main text / secondary text | `#182321` / `#52615D` |
| Primary action | `#234D43` with white text |
| Brand accent | `#B84E26`, used sparingly |
| Vacant | Text `#166534`, background `#DCFCE7`, circle icon + “Available” |
| Under review | Text `#854D0E`, background `#FEF3C7`, clock icon + “Under review” |
| Booked | Text `#991B1B`, background `#FEE2E2`, lock icon + “Booked” |
| Operationally blocked | Text `#475569`, background `#E2E8F0`, slash icon + “Unavailable” |
| Border | `#D8DEDA`; visible focus ring `#234D43` plus surface offset |
| Radius | Cards 16px; inputs/buttons 10px; badges fully rounded |
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64px |
| Type | Inter with system sans-serif fallback; 16px body, 14px labels, 24–36px headings |

Verify contrast on rendered components, including disabled, hover, focus and status combinations. Status always includes text/icon. Do not use large red card fills or alarming countdown animations.

## 2. Information architecture

| Audience | Navigation |
|---|---|
| Public/student | Discover, Saved, My stays, Notifications, Account |
| Owner/staff | Overview, Properties, Requests & queues, Billing (owner only), Settings |
| Support admin | Incidents, Listing approvals, Allocation history, Delivery failures, Billing reconciliation |

An explicit account menu switches student/owner workspace without changing identity. Mobile student navigation uses a bottom bar; owner navigation collapses into a drawer. No public admin sign-up or role escalation UI.

## 3. Screen specifications

### Discovery and results

Desktop: constrained 1440px content, filters on the left, results and optional map to the right. Mobile: single-column cards, sticky search/filter control, optional full-screen map. URL persists nonpersonal search filters and cursor-independent selection.

Filters: locality/radius, monthly price range, PG/hostel/shared flat, sharing capacity and amenities. Cards show photo, name, locality, starting price/month, top amenities, available-bed count, saved control and freshness. Empty results offer filter reset and nearby search, never invented availability.

Free cards show counts only. Do not render actual floor/bed data beneath a blur. Premium users see a layout CTA and specific availability on the detail page. Listing counts indicate “Last updated…”; an unavailable freshness check displays an honest stale-data message.

### Property details

Hero media → name/location → pricing and owner policies → amenities → map → availability → contact/visit intent. Public content is shareable; private student details are not in shared URLs. The contact action exposes approved owner contact information; v1 has no scheduling calendar or chat system.

Locked availability panel explains subscription versus **one credit / 30 days for this property**. Unlock has a cost-confirmation modal; success shows access end date. Purchased access means visibility, not a guarantee of a bed or queue priority.

### Student dashboard / My stays

Order by urgency: pending offers/invitations, active hold, active queues, then history. Offer cards show “Accept by [exact date/time IST]”, two-hour window explanation, accept and decline. Accepted hold cards show property, room/bed, countdown, exact deadline, agreed duration and “Release hold”.

Free students see their assigned bed and queue position in a compact subject-only view. Do not expose the full room roster or another student's name. A student with another pending/active hold sees a clear eligibility explanation on queue cards.

### Owner overview and property inventory

Summary: operational bed counts, pending acceptances, active holds, oldest offers and notifications needing attention. Counts and revenue are not interchangeable; no unverified payment collection total.

Hierarchy: property switcher → floor tabs → room cards → bed markers. Provide equivalent searchable table/list view. Each marker carries a label, status text/icon and deadline where relevant. Selecting a bed opens a drawer with current allocation, student contact only where authorized, lifecycle timeline, queue and permitted actions.

Do not offer a generic status dropdown. Buttons correspond to business commands: Invite student, Confirm booking, Record checkout, Block bed, Resolve block, Exceptional cancellation. Actions explain the effect on a current holder/queue.

### Property setup and floor layouts

Wizard: basic details → map/address → amenities/photos → floors/rooms/beds → pricing/policies → review/publish. Save drafts; show validation at field and step level. Property publication requires platform review in the pilot.

V1 layout is a schematic, not architectural CAD: arrange room rectangles and bed markers using SVG; keyboard nudge/reorder and a form/table editor must offer equivalent capability. Coordinates save as numbers. Optional floor image backgrounds are private. Avoid implying scale or emergency evacuation accuracy.

Uploads allow JPG/PNG/WebP up to 10MB each, with resizing/re-encoding and validation on the server. Provide alt text, progress, retry, approval state and clear image order. Floor assets and public photos have different access policies.

### Queue manager

Per bed: current offer first, then WAITING entries in order. Display join time, position, eligibility and permitted contact details to authorized operators. No drag-and-drop reordering or paid-priority controls. Ineligible entries say why they are temporarily skipped; preserve sequence. A full bed booking explains that remaining queue entries will close with notice.

### Billing and credits

Show capability comparison, plan validity, paid-through date, cancellation-at-period-end and credit ledger. Never show test catalog prices as production pricing. Checkout returns to pending verification until the server confirms fulfillment; a payment success screen alone cannot unlock access.

Owner plan lapse banner explains which creation actions require renewal. Existing commitments retain working booking/release/checkout controls. Subscription cancellation is clear and does not masquerade as immediate deletion.

### Admin operations

Show incident context before intervention: allocation history, actor, timestamps, delivery state and relevant provider references. Require reason for exceptional cancellation, block resolution and ledger correction. Billing corrections are a separate reviewed worker action, not editable balances.

## 4. Key task flows

**Initial hold:** visit/contact → owner invites verified student → student sees two-hour acceptance deadline → review duration/terms → accept → server confirms protected hold → active-hold screen. Declining or timing out returns inventory to the FIFO process.

**Promotion:** previous hold ends → durable inbox offer → student reads exact deadline → accept → fresh 48-hour hold. Show “Offer expired” if deadline wins the race, with updated history. Never leave an optimistic yellow reservation after the server rejects acceptance.

**Credit unlock:** locked details → compare choices → confirm “Use 1 credit” → server transaction → unlocked layout and valid-until date. Insufficient credits links to purchase; returning from checkout retries explicitly and idempotently. Reopening an already unlocked property does not debit again.

**Exceptional cancellation:** operator selects affected bed → constrained reason category plus explanation → review student/queue impact and block → confirm → canonical unavailable state and audit timeline. No owner “sell immediately to someone else” button.

## 5. Required interaction states and copy

| Situation | UI behavior |
|---|---|
| Loading | Skeletons preserve geometry; no fake countdown/bed status |
| Expiry being reconciled | “Your decision window has ended. We’re updating the next offer.” |
| Bed conflict | “This bed’s status changed. We’ve refreshed its availability.” |
| Offer missed | “This offer expired at [time]. View your other options.” |
| Queue temporarily ineligible | “You already have an active commitment. Your queue entry remains, but offers go to eligible students.” |
| Email failed | Inbox remains usable; operator/support sees delivery failure, never a false “read” badge |
| Offline | Persistent offline indicator; writes disabled with retry; countdown labelled unconfirmed |
| Session expired | Reauthenticate and restore intended screen; do not repeat a charge automatically |
| Layout access expired | Lock layout and explain renewal; retain own hold controls |

Use toasts for noncritical success, inline errors for forms, and persistent cards for changes that affect a bed or payment. No urgency copy beyond actual deadlines. Countdown announcements must not fire every second to screen readers.

## 6. Responsive and accessibility acceptance

Test 360px, 390px, 768px, 1280px and 1440px; 200% zoom; keyboard-only use; a screen reader; reduced motion; color-vision simulation; slow mobile connection. Touch targets ≥44px, visible focus, labelled map/list alternatives, semantic form errors and focus return after dialogs. No horizontal scrolling for the primary mobile journey; inventory tables may use a clearly labelled horizontal region plus card alternative.

Illustrative [UI image concepts](../assets/ui-concepts/README.md) now show the student discovery dashboard, owner inventory dashboard and mobile hold/offer flows. These raster concepts support this specification; editable Figma files and a running prototype remain separate implementation deliverables.
