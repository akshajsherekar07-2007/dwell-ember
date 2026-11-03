# Dwell Ember — Current Implementation Status

Updated 2 November 2026.

## Public landing and account gate

The root `/` is a responsive public landing page, independent of account loading. It includes property summaries, local search, how-it-works guidance, an owner section, FAQs and login/signup calls to action. `/api/public` returns only published property summaries and aggregated vacancy counts; it excludes accounts, contacts, precise addresses, specific bed records and reservations. Opening a property or listing a space sends visitors to `/login` or `/signup` with context and a safe internal return destination. Owner listing prompts preselect the Owner role. Direct unauthenticated dashboard visits redirect to login. Student discovery now lives at `/discover`. The selected property opens after student authentication when it remains available.

## Working local prototype

- Starts empty: no fictional students, owner or properties are loaded.
- Signup as owner or student with name, email, phone and password (minimum 10 characters). Email addresses are unique and normalized; separate emails are needed for separate role accounts.
- Passwords use salted scrypt hashes. Random session tokens are stored hashed server-side, with a seven-day HTTP-only SameSite cookie. Sign-out revokes the session. Repeated authentication attempts are throttled by email.
- Server authentication is required for every application read and mutation. Student commands must match the session identity. Property commands require the authenticated owner of that property.
- Owners create listings with name, locality, city, full address, description, amenities, price, rooms, beds and optional image upload. Contact comes from the owner’s phone. Listings become discoverable to students immediately.
- Owner dashboards show only their properties. Students see published listings and their own profile/inbox/history. Other students’ private identities are removed from student snapshots.
- Owners invite a student by registered email; no account directory or fictional identity selector is exposed. Existing protected holds, acceptance, booking and FIFO logic remain.
- Profile page displays the actual account, with sign-out. Sample reset, clock manipulation and demo payment/credit mutations are blocked.
- Paid access and purchases remain unavailable until billing is integrated. Free accounts can discover listings and manage their own invitations/holds.

## Storage and deployment boundary

Ignored `.data/prototype.json` stores current users/listings and `.data/accounts.json` stores credential hashes/sessions. Old `.data/demo.json` is retained but never loaded by the app. Seeded fixtures remain solely for legacy domain tests. Production requires Supabase identity/database, transactional cross-process storage, verified contacts, password recovery and delivery providers. This server stays localhost-only.

## Verification

37 tests pass, covering core hold/FIFO constraints, serialized mutations, localhost guards, empty initial state, signup/login, duplicate emails, password hashing, session revocation, listing discovery across accounts, invitation acceptance, owner isolation and student role restrictions. Type checking and optimized Next.js build pass. Browser inspection verified landing layouts at desktop and mobile widths without horizontal overflow, owner signup routing, and direct protected-page login redirection. No sample accounts or properties were created in the user workspace.

## Suggested later profile fields

Keep signup short. Ask students for college/course, preferred city, budget and expected move-in date when they begin searching. Ask owners for business/display name and their relationship to the property (owner/authorized manager) when they list. Collect address, amenities, rent, deposit and house rules per listing. Add contact verification before external launch. Do not require government IDs at initial signup.

## Exact property location — 2 November 2026

Leaflet 1.9.4 now renders interactive OpenStreetMap maps. During property creation, owners can request their browser’s current location, tap/drag a pin, or enter latitude and longitude. They explicitly confirm the pin before saving; publish/save is disabled while a moved pin remains unconfirmed. A text address is still required and GPS remains optional. Existing properties have an Add/Edit map pin action in owner inventory.

Signed-in students see the owner-confirmed pin in property details without needing paid floor-layout access, and Google Maps directions target the saved coordinates. Older listings with no pin retain address-based navigation. Exact coordinates are excluded from public landing summaries. Server-side coordinate bounds and ownership checks cover pin creation/updates; other owners and students cannot modify a property pin.

Only a user click requests geolocation. Permission-denied, timeout, unsupported-browser and unavailable-position cases offer manual alternatives. Device accuracy is shown for review. No continuous location tracking or automatic address geocoding is enabled. Map tiles load over the internet from OpenStreetMap; attribution stays visible. Public tile service use follows https://operations.osmfoundation.org/policies/tiles/ and should move to a suitable hosted/self-hosted provider when production volume requires it. Leaflet APIs: https://leafletjs.com/reference.html . No Google Maps API key or billing integration is required for the current directions links.

37 tests pass, including coordinate range/nonfinite checks, student read-after-owner-save, rejected cross-owner/student changes, unchanged public field allowlist and precise directions targets. Browser checks in a temporary isolated component page verified real tile rendering, map click selection, manual coordinates, confirmation, clearing and directions. No account/listing was created by these checks, and the temporary route was removed. Actual device GPS permission/accuracy was not exercised by automation.

## Multi-floor inventory and scoped photo galleries — 2 November 2026

New listings use a nested floor/room editor. Owners add floors (including Ground floor), choose each floor from a dropdown, add/name rooms and select 1–12 beds per room independently. Limits for the local prototype are 10 floors per property and 30 rooms per floor. Duplicate floor numbers and duplicate room names within a floor are rejected; the same room number on different floors is supported. Bed identity includes its property/floor/room, and generated bed IDs are globally distinct.

Overall property photos have a Main listing photo selector. That selected image appears on the public homepage, student cards and owner portfolio. Up to six photos can be attached separately to the property, each floor and each room. Uploads accept JPG/PNG/WebP originals up to 5 MB, resize locally to a maximum dimension of 1400 px and encode JPEG before saving. Photos remain in the local JSON store, with a 16 MB combined encoded-data budget per property. Production must move media into object storage and use URLs/thumbnails before scaling beyond this prototype.

Owner inventory switches floors and shows floor/room galleries. Existing properties have Add floors & rooms (new floors) and Manage property photos actions. Appending floors preserves existing bed IDs, allocations and queues. Photo-only updates validate existing structure and cannot change room/bed counts. Premium/unlocked student property details offer floor selection, room/bed availability and separate floor/room galleries. Free student API snapshots omit nested floor/room media; public summaries expose only the main listing image. Legacy records reconstruct floor/room metadata from existing beds without resetting data.

37 tests pass, including multi-floor construction, repeated room labels across different floors, duplicate prevention, preserving reservations during expansion, preventing inventory changes through photo updates, ownership checks, main image projection and gated nested media. Browser checks in a temporary component preview verified two floors, three rooms with independent bed counts, multiple photo uploads and changing the main listing photo. The temporary route was removed; no user account or property records were created or modified by those checks.

## Hierarchical floor → room → bed-slot configuration — 3 November 2026

The owner editor now starts empty and explicitly offers Add first floor. Each floor is a collapsible configuration card with a number, optional label, nested rooms, and individually named bed slots within each room. Add room creates its first slot; Add bed slot expands capacity and removal applies to draft slots only. Sharing/capacity text derives from actual slot count. Owners can configure the next floor and return to earlier floors without losing their draft. Room/floor photo uploads remain in separate optional sections; amenities remain property-level.

Bed labels are persisted exactly after trimming, with case-insensitive uniqueness within a room and a count/slot consistency check. Old numeric bed-count configurations continue to work. Floor names and named slots appear in inventory and premium student layouts. The photo editor cannot rename slots or floor labels.

For saved properties, Add room on the selected floor and Add bed slot inside a room append inventory with new IDs. Existing bed IDs, allocations, queues and statuses remain unchanged. Floor cards and room summaries show available, under-review, booked and blocked counts. Selecting a floor and a bed retains existing invitation, booking, cancellation and operational-status actions. Only the owning account can append rooms or slots.

43 tests pass, including custom labels, duplicate/empty labels, slot-count consistency, room and slot expansion without replacing reserved beds, photo-only edit protection, owner-role boundaries, and concurrent duplicate slot prevention. Browser verification used a temporary editor preview: created two floors, three rooms, named/renamed slots, returned to an earlier floor, and checked mobile overflow at 390 px. No user records were modified; the temporary route was removed.

## Bed Manage navigation fix — 3 November 2026

Manage in the bed table now selects the bed, scrolls the bed-management panel into view and gives it keyboard focus. Clicking the already-selected bed repeats the reveal. Layout tiles and request rows use the same behavior. Controls retain their existing role: invite a student to an available bed; inspect holds and FIFO queues; confirm an accepted hold’s booking; record checkout; or apply/resolve operational unavailability. The table control names its target room/bed and links to the panel with aria-controls. Reduced-motion preference is respected. Type checking and all 43 existing tests pass. The browser verification session was unauthenticated, so no owner account or property data was changed by verification.

## Owner-managed offline bed statuses — 3 November 2026

Bed management now exposes Available, On hold and Booked controls for the owning account. Offline reservations need no app account: guest name/phone are optional private metadata, not fictional student identities. An owner can instead link a registered student by email so their stay and notices appear in that student’s account. Client-supplied student IDs are discarded; the server resolves any linked identity by registered email.

An offline hold starts immediately for 1–48 hours and expires through the existing reconciliation/FIFO path. Re-selecting an existing hold cannot reset/extend its deadline. A booking records a valid move-in date and agreed rent without taking payment. A current registered reservation stays linked to its original student; an owner cannot silently replace it with a different person in the booking action. Booking closes the remaining bed waitlist and notifies registered students.

Marking an active reservation Available requires a reason and confirmation, closes the old reservation in history, notifies linked students, and promotes the next eligible waitlisted student. As a result the bed can immediately be under review again. Booking-to-hold corrections also require a reason. Operationally blocked beds must first be explicitly reopened. These owner-managed corrections intentionally extend the earlier student-only release policy in response to the owner-status requirement.

Every manual status change records a property/bed-scoped activity entry. Relevant owners can see these updates and automatic expiry/offer events; other owners/students cannot see private activity or offline guest contacts. Writes check ownership and bed version, are serialized and idempotent, and preserve the last complete JSON when Windows/OneDrive temporarily locks a file replacement. Atomic file replacement retries brief locks and removes only its own temporary file on failure.

56 tests pass across nine files, including offline booking without accounts, linked registered stays, hold expiry/FIFO, reasoned release and correction, existing deadline preservation, invalid dates/versions, cross-owner/student denial, forged-ID stripping, guest-contact privacy, competing bookings and atomic-file failure recovery. Browser verification exercised all three status choices in a temporary isolated preview, which was removed afterward. No user property or booking records were changed by verification.
