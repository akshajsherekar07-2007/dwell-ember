"""Build Dwell Ember's OpenAPI contract; standard library only.

Edit this file, regenerate api/openapi.json, and review the contract diff together.
No provider calls, secrets, or application infrastructure are created.
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
S = {}


def ref(name):
    return {"$ref": f"#/components/schemas/{name}"}


def obj(properties, required=(), description=None):
    result = {"type": "object", "properties": properties,
              "required": list(required), "additionalProperties": False}
    if description:
        result["description"] = description
    return result


def string(**kw):
    return {"type": "string", **kw}


def integer(**kw):
    return {"type": "integer", **kw}


def array(items, **kw):
    return {"type": "array", "items": items, **kw}


UUID = string(format="uuid")
TIME = string(format="date-time")
BOOL = {"type": "boolean"}
PAISE = integer(minimum=0, maximum=9007199254740991, description="Integer INR paise; never floating-point rupees.")
VERSION = integer(minimum=1)

S["Meta"] = obj({"requestId": UUID, "serverTime": TIME, "asOf": TIME,
                 "nextCursor": string()}, ["requestId", "serverTime"])
S["Error"] = obj({
    "error": obj({"code": string(), "message": string(),
                  "fieldErrors": {"type": "object", "additionalProperties": array(string())},
                  "currentVersion": VERSION}, ["code", "message"]),
    "meta": ref("Meta")}, ["error", "meta"])
S["Ok"] = obj({"success": {"const": True}}, ["success"])
S["Point"] = obj({"latitude": {"type": "number", "minimum": -90, "maximum": 90},
                  "longitude": {"type": "number", "minimum": -180, "maximum": 180}},
                 ["latitude", "longitude"])
S["Profile"] = obj({"id": UUID, "displayName": string(), "emailVerified": BOOL,
                    "phone": string(), "active": BOOL}, ["id", "displayName", "emailVerified", "active"])
S["Organization"] = obj({"id": UUID, "name": string(), "role": string(enum=["owner", "staff"])},
                        ["id", "name", "role"])
S["OrganizationInput"] = obj({"name": string(minLength=1, maxLength=160)}, ["name"])
S["Staff"] = obj({"userId": UUID, "role": string(enum=["owner", "staff"]),
                  "active": BOOL, "propertyIds": array(UUID), "canExceptionallyCancel": BOOL},
                 ["userId", "role", "active", "propertyIds", "canExceptionallyCancel"])
S["StaffInput"] = obj({"userId": UUID, "propertyIds": array(UUID, minItems=1),
                       "canExceptionallyCancel": BOOL}, ["userId", "propertyIds"])
S["Amenity"] = obj({"id": UUID, "code": string(), "label": string()}, ["id", "code", "label"])
S["PublicProperty"] = obj({
    "id": UUID, "name": string(), "slug": string(), "description": string(),
    "category": string(enum=["pg", "hostel", "shared_flat"]), "audiencePolicy": string(),
    "locality": string(), "city": string(), "address": string(), "location": ref("Point"),
    "monthlyPriceFromPaise": PAISE, "currency": {"const": "INR"},
    "availableBedCount": integer(minimum=0), "availabilityAsOf": TIME,
    "inventoryUpdatedAt": TIME, "amenities": array(ref("Amenity")),
    "photos": array(string(format="uri")), "ownerContact": string(),
    "detailAccess": string(enum=["locked", "subscription", "credit_unlock", "operator"])},
    ["id", "name", "slug", "category", "locality", "city", "monthlyPriceFromPaise", "currency",
     "availableBedCount", "availabilityAsOf", "inventoryUpdatedAt", "detailAccess"])
S["PropertyInput"] = obj({
    "name": string(minLength=1, maxLength=160), "description": string(maxLength=10000),
    "category": string(enum=["pg", "hostel", "shared_flat"]), "audiencePolicy": string(maxLength=2000),
    "address": string(minLength=1), "locality": string(minLength=1), "city": string(minLength=1),
    "region": string(minLength=1), "postalCode": string(pattern="^[1-9][0-9]{5}$"),
    "location": ref("Point"), "googlePlaceId": string(), "monthlyPriceFromPaise": PAISE,
    "amenityIds": array(UUID, uniqueItems=True)},
    ["name", "category", "audiencePolicy", "address", "locality", "city", "region", "postalCode",
     "location", "monthlyPriceFromPaise", "amenityIds"])
S["OwnerProperty"] = obj({"id": UUID, "organizationId": UUID, "name": string(),
                          "publication": string(enum=["draft", "pending_review", "published", "archived"]),
                          "inventoryUpdatedAt": TIME}, ["id", "organizationId", "name", "publication"])
S["Floor"] = obj({"id": UUID, "propertyId": UUID, "label": string(), "sortOrder": integer()},
                 ["id", "propertyId", "label", "sortOrder"])
S["FloorInput"] = obj({"label": string(minLength=1, maxLength=100), "sortOrder": integer()}, ["label", "sortOrder"])
S["RoomInput"] = obj({"label": string(minLength=1, maxLength=100),
                      "sharingCapacity": integer(minimum=1, maximum=30), "monthlyPricePaise": PAISE,
                      "layoutX": {"type": "number"}, "layoutY": {"type": "number"},
                      "layoutWidth": {"type": "number", "exclusiveMinimum": 0},
                      "layoutHeight": {"type": "number", "exclusiveMinimum": 0}},
                     ["label", "sharingCapacity", "monthlyPricePaise", "layoutX", "layoutY", "layoutWidth", "layoutHeight"])
S["Room"] = obj({"id": UUID, "propertyId": UUID, "floorId": UUID, **S["RoomInput"]["properties"]},
                ["id", "propertyId", "floorId", *S["RoomInput"]["required"]])
S["BedInput"] = obj({"label": string(minLength=1, maxLength=100), "layoutX": {"type": "number"},
                     "layoutY": {"type": "number"}}, ["label", "layoutX", "layoutY"])
S["Bed"] = obj({"id": UUID, "propertyId": UUID, "roomId": UUID, "label": string(),
                "availability": string(enum=["vacant", "under_review", "booked", "unavailable", "reconciling"]),
                "version": VERSION, "expiresAt": TIME, "enabled": BOOL,
                "layoutX": {"type": "number"}, "layoutY": {"type": "number"}},
               ["id", "propertyId", "roomId", "label", "availability", "version", "enabled"])
S["Layout"] = obj({"propertyId": UUID, "floors": array(ref("Floor")), "rooms": array(ref("Room")),
                   "beds": array(ref("Bed")),
                   "backgrounds": array(obj({"floorId": UUID, "url": string(format="uri"), "expiresAt": TIME},
                                            ["floorId", "url", "expiresAt"]))},
                  ["propertyId", "floors", "rooms", "beds", "backgrounds"])
S["Allocation"] = obj({
    "id": UUID, "bedId": UUID, "propertyId": UUID, "bedLabel": string(), "roomLabel": string(),
    "propertyName": string(), "state": string(enum=["invited", "offered", "held", "booked", "expired", "released", "cancelled", "ended"]),
    "source": string(enum=["owner_invitation", "waitlist"]), "version": VERSION,
    "holdDurationSeconds": integer(minimum=3600, maximum=172800),
    "acceptedAt": TIME, "expiresAt": TIME, "createdAt": TIME, "closeReason": string()},
    ["id", "bedId", "propertyId", "state", "source", "version", "holdDurationSeconds", "createdAt"])
S["InviteInput"] = obj({"studentId": UUID, "holdDurationHours": integer(minimum=1, maximum=48, default=48),
                        "expectedBedVersion": VERSION}, ["studentId", "expectedBedVersion"])
S["VersionInput"] = obj({"expectedVersion": VERSION}, ["expectedVersion"])
S["ExceptionalCancelInput"] = obj({"expectedVersion": VERSION,
    "reasonCategory": string(enum=["safety", "bed_damage", "inventory_error"]),
    "reason": string(minLength=10, maxLength=1000)}, ["expectedVersion", "reasonCategory", "reason"])
S["BlockInput"] = obj({"expectedVersion": VERSION, "reason": string(minLength=10, maxLength=1000)},
                      ["expectedVersion", "reason"])
S["QueueEntry"] = obj({"id": UUID, "bedId": UUID, "propertyId": UUID,
    "state": string(enum=["waiting", "offered", "converted", "declined", "expired", "cancelled", "closed"]),
    "position": integer(minimum=1, description="Ordinal among live entries; not a promise of offer time."),
    "eligibleNow": BOOL, "eligibilityReason": string(), "createdAt": TIME, "allocationId": UUID},
    ["id", "bedId", "propertyId", "state", "eligibleNow", "createdAt"])
S["OwnerQueueEntry"] = obj({**S["QueueEntry"]["properties"], "studentId": UUID,
                           "studentDisplayName": string()}, [*S["QueueEntry"]["required"], "studentId"])
S["QueueJoinInput"] = obj({"bedId": UUID}, ["bedId"])
S["QueueInviteInput"] = obj({"studentId": UUID}, ["studentId"])
S["InvitationLink"] = obj({"url": string(format="uri"), "expiresAt": TIME}, ["url", "expiresAt"])
S["RedeemInput"] = obj({"token": string(minLength=32, maxLength=512)}, ["token"])
S["AccessGrant"] = obj({"bedId": UUID, "expiresAt": TIME}, ["bedId", "expiresAt"])
S["BookingInput"] = obj({"expectedVersion": VERSION, "moveInDate": string(format="date"),
    "agreedMonthlyPricePaise": PAISE, "offlineReference": string(maxLength=200)},
    ["expectedVersion", "moveInDate", "agreedMonthlyPricePaise"])
S["Booking"] = obj({"id": UUID, "allocationId": UUID, "bedId": UUID,
    "state": string(enum=["confirmed", "checked_in", "checked_out", "cancelled"]),
    "moveInDate": string(format="date"), "agreedMonthlyPricePaise": PAISE,
    "currency": {"const": "INR"}, "createdAt": TIME},
    ["id", "allocationId", "bedId", "state", "moveInDate", "agreedMonthlyPricePaise", "currency"])
S["CheckoutInput"] = obj({"expectedAllocationVersion": VERSION,
                          "reason": string(minLength=1, maxLength=1000),
                          "outcome": string(enum=["checked_out", "cancelled"])},
                         ["expectedAllocationVersion", "reason", "outcome"])
S["Entitlement"] = obj({"propertyId": UUID, "accessSource": string(enum=["subscription", "credit_unlock", "operator"]),
    "validUntil": TIME, "creditsDebited": integer(minimum=0, maximum=1)}, ["propertyId", "accessSource", "creditsDebited"])
S["Plan"] = obj({"id": UUID, "code": string(), "audience": string(enum=["owner", "student"]),
    "pricePaise": PAISE, "currency": {"const": "INR"}, "interval": {"const": "monthly"},
    "propertyCap": integer(minimum=1), "bedCap": integer(minimum=1)},
    ["id", "code", "audience", "pricePaise", "currency", "interval"])
S["Subscription"] = obj({"id": UUID, "planId": UUID, "organizationId": UUID,
    "state": string(enum=["pending", "active", "past_due", "cancelled", "expired"]),
    "paidThrough": TIME, "cancelAtPeriodEnd": BOOL}, ["id", "planId", "state", "cancelAtPeriodEnd"])
S["CreditPack"] = obj({"code": string(), "quantity": integer(minimum=1), "pricePaise": PAISE,
                       "currency": {"const": "INR"}}, ["code", "quantity", "pricePaise", "currency"])
S["CheckoutRequest"] = {"oneOf": [
    obj({"kind": {"const": "student_subscription"}, "planId": UUID}, ["kind", "planId"]),
    obj({"kind": {"const": "owner_subscription"}, "planId": UUID, "organizationId": UUID},
        ["kind", "planId", "organizationId"]),
    obj({"kind": {"const": "credit_pack"}, "packCode": string()}, ["kind", "packCode"])]}
S["CheckoutSession"] = obj({"paymentReference": UUID, "providerKeyId": string(), "providerOrderId": string(),
    "providerSubscriptionId": string(), "amountPaise": PAISE, "currency": {"const": "INR"}},
    ["paymentReference", "providerKeyId", "amountPaise", "currency"])
S["CreditEntry"] = obj({"id": UUID, "delta": integer(), "reason": string(), "createdAt": TIME},
                       ["id", "delta", "reason", "createdAt"])
S["Wallet"] = obj({"balance": integer(minimum=0), "entries": array(ref("CreditEntry"))}, ["balance", "entries"])
S["Notification"] = obj({"id": UUID, "kind": string(), "resourceType": string(), "resourceId": UUID,
    "title": string(), "message": string(), "createdAt": TIME, "readAt": TIME},
    ["id", "kind", "resourceType", "resourceId", "title", "message", "createdAt"])
S["MediaUploadInput"] = obj({"kind": string(enum=["property_photo", "layout_background"]), "floorId": UUID,
    "mimeType": string(enum=["image/jpeg", "image/png", "image/webp"]),
    "sizeBytes": integer(minimum=1, maximum=10485760), "altText": string(maxLength=500)},
    ["kind", "mimeType", "sizeBytes", "altText"])
S["MediaUpload"] = obj({"mediaId": UUID, "uploadUrl": string(format="uri"), "expiresAt": TIME},
                       ["mediaId", "uploadUrl", "expiresAt"])
S["Overview"] = obj({"totalBeds": integer(minimum=0), "vacantBeds": integer(minimum=0),
    "underReviewBeds": integer(minimum=0), "bookedBeds": integer(minimum=0), "blockedBeds": integer(minimum=0),
    "deliveryFailures": integer(minimum=0)}, ["totalBeds", "vacantBeds", "underReviewBeds", "bookedBeds", "blockedBeds", "deliveryFailures"])
S["AuditEvent"] = obj({"id": UUID, "action": string(), "resourceType": string(), "resourceId": UUID,
    "actorKind": string(enum=["user", "worker", "admin"]), "reason": string(), "createdAt": TIME},
    ["id", "action", "resourceType", "resourceId", "actorKind", "createdAt"])
S["AdminAction"] = obj({"reason": string(minLength=10, maxLength=1000)}, ["reason"])
S["AdminIncident"] = obj({"resourceId": UUID, "kind": string(), "severity": string(), "createdAt": TIME},
                         ["resourceId", "kind", "severity", "createdAt"])

PATHS = {}
IDEMPOTENCY = {"name": "Idempotency-Key", "in": "header", "required": True,
               "description": "Actor/operation-scoped request key, replayed for 24h. Reuse with different content returns 409.",
               "schema": string(minLength=8, maxLength=128)}
CSRF = {"name": "X-CSRF-Token", "in": "header", "required": False,
        "description": "Required for cookie-authenticated browser mutations; bearer-only trusted callers do not use cookies.",
        "schema": string()}


def query(name, schema, description="", required=False):
    return {"name": name, "in": "query", "required": required,
            "schema": schema, "description": description}


PAGING = [query("cursor", string(), "Opaque cursor returned in meta.nextCursor."),
          query("limit", integer(minimum=1, maximum=100, default=20))]


def operation(path, method, ident, summary, output="Ok", body=None, *, tag="Student", public=False,
              listing=False, params=(), requirements=(), status="200", description=""):
    data_schema = array(ref(output)) if listing else ref(output)
    result_schema = obj({"data": data_schema, "meta": ref("Meta")}, ["data", "meta"])
    success = {"description": "Success", "content": {"application/json": {"schema": result_schema}},
               "headers": {"Cache-Control": {"schema": string(), "description": "private, no-store for personal or paid data."}}}
    op = {"operationId": ident, "summary": summary, "tags": [tag], "description": description,
          "security": [] if public else [{"cookieSession": []}, {"bearerAuth": []}],
          "responses": {status: success}, "x-requirements": list(requirements)}
    parameters = []
    for part in path.split("/"):
        if part.startswith("{"):
            parameters.append({"name": part[1:-1], "in": "path", "required": True, "schema": UUID})
    parameters.extend(params)
    if method not in ("get", "head"):
        parameters.extend([IDEMPOTENCY, CSRF])
    if parameters:
        op["parameters"] = parameters
    if body:
        op["requestBody"] = {"required": True, "content": {"application/json": {"schema": ref(body)}}}
    for code in ("400", "401", "403", "404", "409", "422", "429", "503"):
        op["responses"][code] = {"$ref": f"#/components/responses/Error{code}"}
    PATHS.setdefault(path, {})[method] = op


operation("/properties", "get", "searchProperties", "Search published listings with aggregate availability", "PublicProperty",
    public=True, tag="Discovery", listing=True, params=[*PAGING,
    query("city", string()), query("locality", string()), query("latitude", {"type": "number", "minimum": -90, "maximum": 90}),
    query("longitude", {"type": "number", "minimum": -180, "maximum": 180}),
    query("radiusKm", {"type": "number", "exclusiveMinimum": 0, "maximum": 50, "default": 5}),
    query("minPricePaise", PAISE), query("maxPricePaise", PAISE),
    query("category", string(enum=["pg", "hostel", "shared_flat"])),
    query("sharingCapacity", integer(minimum=1, maximum=30)),
    query("amenityCodes", array(string()), "Comma-separated amenity codes.")], requirements=["FR-02", "FR-17"],
    description="Latitude/longitude must be supplied together. Radius requires both. City or coordinate pair is required. Counts can be briefly stale and never authorize allocation.")
operation("/properties/{propertyId}", "get", "getProperty", "Read public property information", "PublicProperty", public=True,
          tag="Discovery", requirements=["FR-17"])
operation("/amenities", "get", "listAmenities", "List supported amenity filters", "Amenity", public=True, listing=True, tag="Discovery", requirements=["FR-02"])
operation("/properties/{propertyId}/layout", "get", "getPropertyLayout", "Read an authorized private floor layout", "Layout", tag="Access", requirements=["FR-17", "FR-25"],
          description="Requires current student subscription/property entitlement or scoped operator access. Never returns another applicant's identity.")
operation("/properties/{propertyId}/unlock", "post", "unlockProperty", "Explicitly unlock one property for 30 elapsed days", "Entitlement", tag="Access", requirements=["FR-18"],
          description="Uses one credit atomically, or zero when an entitlement/subscription/operator access already applies. This purchases visibility, not a hold.")
operation("/me", "get", "getMe", "Read current profile", "Profile", requirements=["FR-01"])
operation("/me/saved-properties", "get", "getSavedProperties", "Read saved public properties", "PublicProperty", listing=True, params=PAGING, requirements=["FR-17"])
operation("/me/saved-properties/{propertyId}", "put", "saveProperty", "Save a property", requirements=["FR-17"])
operation("/me/saved-properties/{propertyId}", "delete", "unsaveProperty", "Remove a saved property", requirements=["FR-17"])
operation("/me/allocations", "get", "getMyAllocations", "Read own invitations, offers, holds and history", "Allocation", listing=True, params=PAGING, requirements=["FR-04", "FR-17"])
operation("/allocations/{allocationId}", "get", "getAllocation", "Read own or operator-scoped allocation", "Allocation", requirements=["FR-01", "FR-17"])
operation("/allocations/{allocationId}/accept", "post", "acceptAllocation", "Accept an unexpired initial invitation or FIFO offer", "Allocation", "VersionInput", requirements=["FR-04", "FR-06", "FR-10", "FR-12"])
operation("/allocations/{allocationId}/release", "post", "releaseAllocation", "Decline an invitation/offer or release own hold", "Allocation", "VersionInput", requirements=["FR-10", "FR-12"])
operation("/me/waitlists", "get", "getMyWaitlists", "Read own queue entries and eligibility", "QueueEntry", listing=True, params=PAGING, requirements=["FR-08", "FR-09"])
operation("/waitlists", "post", "joinWaitlist", "Join a yellow bed's FIFO queue", "QueueEntry", "QueueJoinInput", status="201", requirements=["FR-07", "FR-08", "FR-11"])
operation("/waitlists/{entryId}", "delete", "leaveWaitlist", "Leave queue; decline linked active offer if present", requirements=["FR-11", "FR-12"])
operation("/bed-access/redeem", "post", "redeemBedAccess", "Redeem a one-use account-bound queue invitation", "AccessGrant", "RedeemInput", requirements=["FR-07"])
operation("/me/notifications", "get", "getNotifications", "Read durable personal inbox", "Notification", listing=True, params=PAGING, tag="Notifications", requirements=["FR-22"])
operation("/me/notifications/{notificationId}/read", "post", "markNotificationRead", "Mark own notification read", tag="Notifications", requirements=["FR-22"])
operation("/me/credits", "get", "getCredits", "Read own credit balance and ledger", "Wallet", tag="Billing", params=PAGING, requirements=["FR-18", "FR-21"])
operation("/me/subscriptions", "get", "getSubscriptions", "Read own student subscriptions", "Subscription", tag="Billing", listing=True, params=PAGING, requirements=["FR-19"])
operation("/billing/plans", "get", "getPlans", "Read active configured plans", "Plan", tag="Billing", public=True, listing=True, requirements=["FR-19"])
operation("/billing/credit-packs", "get", "getCreditPacks", "Read configured credit packs", "CreditPack", tag="Billing", public=True, listing=True, requirements=["FR-21"])
operation("/billing/checkout", "post", "createCheckout", "Create a server-priced checkout session", "CheckoutSession", "CheckoutRequest", tag="Billing", requirements=["FR-19", "FR-20", "FR-21"],
          description="Owner subscription requires organization owner. Amount/credit quantity comes from catalog, never client input. Returning from checkout does not grant access.")
operation("/billing/subscriptions/{subscriptionId}/cancel", "post", "cancelSubscription", "Cancel renewal while retaining paid-through access", "Subscription", tag="Billing", requirements=["FR-19"])
operation("/owner/organizations", "post", "createOrganization", "Create organization with caller as owner", "Organization", "OrganizationInput", tag="Owner", status="201", requirements=["FR-01"])
operation("/owner/organizations", "get", "getOrganizations", "Read own organization memberships", "Organization", tag="Owner", listing=True, requirements=["FR-01"])
operation("/owner/organizations/{organizationId}/overview", "get", "getOwnerOverview", "Read authorized aggregate owner dashboard", "Overview", tag="Owner", requirements=["FR-01", "FR-03"])
operation("/owner/organizations/{organizationId}/staff", "get", "getStaff", "Read organization staff (owner only)", "Staff", tag="Owner", listing=True, requirements=["FR-01"])
operation("/owner/organizations/{organizationId}/staff", "post", "addStaff", "Assign existing verified user to organization properties", "Staff", "StaffInput", tag="Owner", status="201", requirements=["FR-01"])
operation("/owner/organizations/{organizationId}/staff/{userId}", "delete", "revokeStaff", "Deactivate staff membership and property access", tag="Owner", requirements=["FR-01"])
operation("/owner/organizations/{organizationId}/subscriptions", "get", "getOwnerSubscriptions", "Read owner billing status (organization owner only)", "Subscription", tag="Owner", listing=True, requirements=["FR-19"])
operation("/owner/organizations/{organizationId}/properties", "get", "getOwnerProperties", "List scoped managed properties", "OwnerProperty", tag="Owner", listing=True, params=PAGING, requirements=["FR-01", "FR-02"])
operation("/owner/organizations/{organizationId}/properties", "post", "createProperty", "Create draft property within plan limits", "OwnerProperty", "PropertyInput", tag="Owner", status="201", requirements=["FR-02", "FR-19"])
operation("/owner/properties/{propertyId}", "put", "updateProperty", "Update authorized property's catalog fields", "OwnerProperty", "PropertyInput", tag="Owner", requirements=["FR-01", "FR-02"])
operation("/owner/properties/{propertyId}/submit", "post", "submitProperty", "Submit complete draft for publication review", "OwnerProperty", tag="Owner", requirements=["FR-02"])
operation("/owner/properties/{propertyId}/floors", "get", "getOwnerFloors", "Read property floors", "Floor", tag="Owner", listing=True, requirements=["FR-01", "FR-02"])
operation("/owner/properties/{propertyId}/floors", "post", "createFloor", "Create a floor", "Floor", "FloorInput", tag="Owner", status="201", requirements=["FR-02"])
operation("/owner/floors/{floorId}", "put", "updateFloor", "Update floor label/order", "Floor", "FloorInput", tag="Owner", requirements=["FR-02"])
operation("/owner/floors/{floorId}/rooms", "get", "getRooms", "Read floor rooms", "Room", tag="Owner", listing=True, requirements=["FR-02"])
operation("/owner/floors/{floorId}/rooms", "post", "createRoom", "Create a room", "Room", "RoomInput", tag="Owner", status="201", requirements=["FR-02"])
operation("/owner/rooms/{roomId}", "put", "updateRoom", "Update room metadata and layout geometry", "Room", "RoomInput", tag="Owner", requirements=["FR-02"])
operation("/owner/rooms/{roomId}/beds", "get", "getBeds", "Read room beds", "Bed", tag="Owner", listing=True, requirements=["FR-02", "FR-03"])
operation("/owner/rooms/{roomId}/beds", "post", "createBed", "Create bed within room and plan capacity", "Bed", "BedInput", tag="Owner", status="201", requirements=["FR-02", "FR-19"])
operation("/owner/beds/{bedId}/invitations", "post", "inviteBed", "Invite verified student when bed is free and no eligible queue precedes them", "Allocation", "InviteInput", tag="Owner", status="201", requirements=["FR-06", "FR-09", "FR-12"])
operation("/owner/beds/{bedId}/queue-invitations", "post", "inviteQueueAccess", "Create student-bound queue invitation link", "InvitationLink", "QueueInviteInput", tag="Owner", status="201", requirements=["FR-07"])
operation("/owner/beds/{bedId}/waitlist", "get", "getOwnerWaitlist", "Read scoped FIFO queue with eligibility", "OwnerQueueEntry", tag="Owner", listing=True, params=PAGING, requirements=["FR-01", "FR-09"])
operation("/owner/allocations/{allocationId}/book", "post", "confirmBooking", "Confirm offline agreement for current unexpired holder", "Booking", "BookingInput", tag="Owner", status="201", requirements=["FR-05", "FR-12"])
operation("/owner/allocations/{allocationId}/cancel-exceptionally", "post", "cancelExceptionally", "Cancel for operational reason and block the bed", "Allocation", "ExceptionalCancelInput", tag="Owner", requirements=["FR-03", "FR-12", "FR-16"])
operation("/owner/beds/{bedId}/block", "post", "blockBed", "Block an unallocated bed; active yellow requires exceptional cancellation", "Bed", "BlockInput", tag="Owner", requirements=["FR-03", "FR-12"])
operation("/owner/beds/{bedId}/resolve-block", "post", "resolveBedBlock", "Record operational correction and reconcile queued interest", "Bed", "BlockInput", tag="Owner", requirements=["FR-03", "FR-09", "FR-12"])
operation("/owner/bookings/{bookingId}/end", "post", "endBooking", "Record checkout or cancellation of an offline booking", "Booking", "CheckoutInput", tag="Owner", requirements=["FR-05", "FR-12"])
operation("/owner/properties/{propertyId}/media/uploads", "post", "createMediaUpload", "Issue a constrained quarantine upload URL", "MediaUpload", "MediaUploadInput", tag="Owner", status="201", requirements=["FR-02", "FR-17"])
operation("/owner/media/{mediaId}/complete", "post", "completeMediaUpload", "Request validation and safe processing of uploaded image", tag="Owner", requirements=["FR-02", "FR-17"])
operation("/owner/media/{mediaId}", "delete", "removeMedia", "Remove media from listing and queue object cleanup", tag="Owner", requirements=["FR-02", "FR-17"])
operation("/admin/incidents", "get", "getIncidents", "List operational incidents (MFA admin only)", "AdminIncident", tag="Admin", listing=True, params=PAGING, requirements=["FR-01", "FR-26"])
operation("/admin/resources/{resourceId}/audit", "get", "getAudit", "Read audited support timeline", "AuditEvent", tag="Admin", listing=True, params=[*PAGING, query("resourceType", string(), required=True)], requirements=["FR-01", "FR-16"])
operation("/admin/properties/{propertyId}/approve", "post", "approveProperty", "Approve listing publication", "OwnerProperty", "AdminAction", tag="Admin", requirements=["FR-02", "FR-16"])
operation("/admin/deliveries/{eventId}/replay", "post", "replayDelivery", "Replay failed delivery after checking current resource state", "Ok", "AdminAction", tag="Admin", requirements=["FR-16", "FR-24"])

# Provider webhook is raw signed JSON, not a user mutation or normal envelope.
PATHS["/webhooks/razorpay"] = {"post": {
    "operationId": "receiveRazorpayWebhook", "summary": "Persist verified Razorpay event before acknowledging",
    "tags": ["Billing"], "security": [], "x-requirements": ["FR-20"],
    "description": "Verify HMAC-SHA256 over exact raw bytes. Signature header provides authentication. Persist event before 200; provider event ID deduplicates retries. No user Idempotency-Key or CSRF token.",
    "parameters": [{"name": "X-Razorpay-Signature", "in": "header", "required": True, "schema": string()},
                   {"name": "X-Razorpay-Event-Id", "in": "header", "required": True, "schema": string()}],
    "requestBody": {"required": True, "content": {"application/json": {"schema": {"type": "object", "additionalProperties": True}}}},
    "responses": {"200": {"description": "Durably accepted or already seen", "content": {"application/json": {"schema": obj({"received": {"const": True}}, ["received"])}}},
                  "400": {"$ref": "#/components/responses/Error400"},
                  "503": {"$ref": "#/components/responses/Error503"}}}}

ERRORS = {"400": "Malformed request or invalid webhook signature", "401": "Authentication required",
          "403": "Scope, capability or entitlement denied", "404": "Resource absent or not visible",
          "409": "Business state, version or idempotency conflict", "422": "Validation failed",
          "429": "Rate limit exceeded", "503": "Dependency unavailable; safe retry may be possible"}
DOC = {
    "openapi": "3.1.0", "jsonSchemaDialect": "https://json-schema.org/draft/2020-12/schema",
    "info": {"title": "Dwell Ember API", "version": "1.0.0",
             "description": "Implementation contract, not a deployed service. India-first student housing; protected holds, FIFO offers and paid detail access. See docs/SRS.md for normative rules."},
    "servers": [{"url": "http://localhost:3000/api/v1", "description": "Planned local development API"}],
    "tags": [{"name": n} for n in ["Discovery", "Student", "Owner", "Access", "Billing", "Notifications", "Admin"]],
    "paths": PATHS,
    "components": {"securitySchemes": {
        "cookieSession": {"type": "apiKey", "in": "cookie", "name": "de-session",
                          "description": "Application session adapter backed by server-verified Supabase identity. The adapter must handle refresh and chunked session cookies without exposing privileged keys."},
        "bearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}},
        "schemas": S,
        "responses": {f"Error{k}": {"description": v, "content": {"application/json": {"schema": ref("Error")}}}
                      for k, v in ERRORS.items()}}
}

if __name__ == "__main__":
    path = ROOT / "api" / "openapi.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(DOC, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Generated {path.name}: {len(PATHS)} paths, {sum(len(v) for v in PATHS.values())} operations, {len(S)} schemas")
