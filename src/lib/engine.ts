import { randomUUID } from "node:crypto";
import { z } from "zod";
import { activeAllocation, DAY, HOUR, PENDING, hasAccess, type Allocation, type Bed, type DemoState } from "./types";
import { createSeed } from "./seed";
import { floorsSchema, photosSchema, photoBudget, propertyFloors, roomSchema, roomLabels, bedLabelsSchema } from "./property-structure";
import { locationSchema } from "./location";

export class DomainError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); }
}
const ident = z.string().min(1).max(100);
const version = z.number().int().positive();
export const commandSchema = z.discriminatedUnion("type", [
  z.object({type:z.literal("ownerSetBedStatus"),bedId:ident,expectedVersion:version,status:z.enum(["available","booked","on_hold"]),durationHours:z.number().int().min(1).max(48),studentEmail:z.string().trim().email().max(254).optional(),studentId:ident.optional(),offlineGuest:z.object({name:z.string().trim().max(100).optional(),phone:z.string().trim().max(25).optional()}).optional(),moveInDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),agreedPrice:z.number().int().min(0).max(1000000).optional(),reason:z.string().trim().max(500).optional()}),
  z.object({type:z.literal("appendRooms"),propertyId:ident,floor:z.number().int().min(0).max(50),rooms:z.array(roomSchema).min(1).max(30)}),
  z.object({type:z.literal("appendBedSlots"),propertyId:ident,floor:z.number().int().min(0).max(50),room:ident,labels:bedLabelsSchema}),
  z.object({type:z.literal("appendFloors"),propertyId:ident,floors:floorsSchema}),
  z.object({type:z.literal("setPropertyPhotos"),propertyId:ident,images:photosSchema,floors:floorsSchema}),
  z.object({type:z.literal("setPropertyLocation"),propertyId:ident,location:locationSchema}),
  z.object({type: z.literal("save"), studentId: ident, propertyId: ident}),
  z.object({type: z.literal("unlock"), studentId: ident, propertyId: ident}),
  z.object({type: z.literal("previewPlus"), studentId: ident}),
  z.object({type: z.literal("demoCredits"), studentId: ident}),
  z.object({type: z.literal("accept"), studentId: ident, allocationId: ident, expectedVersion: version}),
  z.object({type: z.literal("release"), studentId: ident, allocationId: ident, expectedVersion: version}),
  z.object({type: z.literal("joinQueue"), studentId: ident, bedId: ident}),
  z.object({type: z.literal("leaveQueue"), studentId: ident, entryId: ident}),
  z.object({type: z.literal("invite"), studentId: ident, bedId: ident, expectedVersion: version, durationHours: z.number().int().min(1).max(48)}),
  z.object({type: z.literal("book"), allocationId: ident, expectedVersion: version, moveInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), agreedPrice: z.number().int().min(0).max(1000000)}),
  z.object({type: z.literal("cancel"), allocationId: ident, expectedVersion: version, reason: z.string().trim().min(10).max(500)}),
  z.object({type: z.literal("block"), bedId: ident, expectedVersion: version, reason: z.string().trim().min(10).max(500)}),
  z.object({type: z.literal("resolveBlock"), bedId: ident, expectedVersion: version}),
  z.object({type: z.literal("checkout"), allocationId: ident, expectedVersion: version}),
  z.object({type: z.literal("readNotices"), studentId: ident}),
  z.object({type: z.literal("advanceClock"), hours: z.number().int().min(1).max(72)}),
  z.object({type: z.literal("reset")}),
  z.object({type: z.literal("addProperty"), floors:floorsSchema.optional(), images:photosSchema.optional(), location:locationSchema.optional(), name: z.string().trim().min(3).max(100), locality: z.string().trim().min(2).max(100), city:z.string().trim().min(2,"Enter a city with at least 2 characters.").max(100).optional(), address:z.string().trim().min(5,"Enter a full property address with at least 5 characters.").max(300).optional(), description:z.string().trim().max(2000).optional(), amenities:z.array(z.string().trim().min(1).max(50)).max(15).optional(), category: z.enum(["PG", "Hostel", "Co-living"]), price: z.number().int().min(1000).max(100000), rooms: z.number().int().min(1).max(8).default(1), bedsPerRoom: z.number().int().min(1).max(4).default(2), image: z.string().max(2800000).optional()}),
]);
export type Command = z.infer<typeof commandSchema>;

function fail(code: string, message: string): never { throw new DomainError(code, message); }
function person(s: DemoState, id: string) {
  return s.people.find(p => p.id === id) ?? fail("NOT_FOUND", "Student not found.");
}
function bed(s: DemoState, id: string) { return s.beds.find(b => b.id === id) ?? fail("NOT_FOUND", "Bed not found."); }
function property(s: DemoState, id: string) { return s.properties.find(p => p.id === id) ?? fail("NOT_FOUND", "Property not found."); }
function pending(s: DemoState, studentId: string, except?: string) {
  return s.allocations.some(a => a.studentId === studentId && a.id !== except && PENDING.includes(a.state));
}
function guardVersion(value: {version: number}, expected: number) {
  if (value.version !== expected) fail("VERSION_CONFLICT", "This bed or hold changed. The latest details have been refreshed.");
}
function log(s: DemoState, now: number, action: string, detail: string,propertyId?:string,bedId?:string) {
  s.activity.unshift({id: randomUUID(), action, detail, createdAt: now,...(propertyId?{propertyId}:{}),...(bedId?{bedId}:{})});
  s.activity = s.activity.slice(0, 250);
}
function notice(s: DemoState, now: number, studentId: string, title: string, message: string) {
  if(!studentId)return;
  s.notices.unshift({id: randomUUID(), studentId, title, message, createdAt: now, read: false});
}
function allocation(s: DemoState, id: string) {
  return s.allocations.find(a => a.id === id) ?? fail("NOT_FOUND", "Hold not found.");
}
function bump(s: DemoState, a: Allocation) { a.version++; bed(s, a.bedId).version++; }
function describe(s: DemoState, b: Bed) { return `${property(s, b.propertyId).name} · Floor ${b.floor} · Room ${b.room} · Bed ${b.label}`; }

function promote(s: DemoState, b: Bed, now: number) {
  if (!b.enabled || !property(s, b.propertyId).published || activeAllocation(s, b.id)) return;
  const next = s.queues.filter(q => q.bedId === b.id && q.state === "waiting" && !pending(s, q.studentId)).sort((a,c) => a.sequence - c.sequence)[0];
  if (!next) return;
  const offer: Allocation = {id: randomUUID(), bedId: b.id, studentId: next.studentId, state: "offered", source: "waitlist", durationHours: 48, createdAt: now, expiresAt: now + 2*HOUR, version: 1, queueId: next.id};
  s.allocations.push(offer); next.state = "offered"; b.version++;
  notice(s, now, next.studentId, "Your turn has arrived", `An exclusive offer for ${describe(s,b)} is ready. Accept within two hours to begin your 48-hour hold.`);
  log(s, now, "Waitlist offer sent", `${person(s,next.studentId).name} · ${describe(s,b)}`,b.propertyId,b.id);
}

/** Called on every read/write. Simulated clock jumps expire existing allocations,
 * then issue offers from the current server instant, avoiding already-expired notices. */
export function reconcile(s: DemoState, now: number) {
  let changed = false;
  const due = s.allocations.filter(a => PENDING.includes(a.state) && a.expiresAt !== undefined && a.expiresAt <= now)
    .sort((a,b) => a.expiresAt! - b.expiresAt!);
  for (const a of due) {
    const wasHold = a.state === "held";
    a.state = "expired"; a.closedAt = now; bump(s,a);
    if (a.queueId) { const q = s.queues.find(q => q.id === a.queueId); if (q?.state === "offered") q.state = "expired"; }
    notice(s, now, a.studentId, wasHold ? "Your hold has ended" : "Your offer has expired", `${describe(s,bed(s,a.bedId))} is no longer reserved for you.`);
    log(s, now, wasHold ? "Hold expired" : "Offer expired", describe(s,bed(s,a.bedId)),bed(s,a.bedId).propertyId,a.bedId);
    changed = true;
  }
  // Also allows a previously skipped student to become eligible after releasing another hold.
  for (const b of s.beds) {
    const before = s.allocations.length; promote(s,b,now);
    if (s.allocations.length !== before) changed = true;
  }
  if (changed) s.revision++;
  return changed;
}

export function execute(s: DemoState, c: Command, now: number): string {
  switch (c.type) {
    case "ownerSetBedStatus": {
      const b=bed(s,c.bedId);guardVersion(b,c.expectedVersion);const current=activeAllocation(s,b.id);
      const previous=current?.state??(b.enabled?"available":"blocked");
      if(c.status==="available"){
        if((current||!b.enabled)&&(!c.reason||c.reason.trim().length<5))fail("REASON_REQUIRED","Add a short reason before clearing this reservation or block.");
        if(current){current.state=current.state==="booked"?"ended":"cancelled";current.closedAt=now;current.reason=c.reason;bump(s,current);
          if(current.queueId){const q=s.queues.find(q=>q.id===current.queueId);if(q&&["waiting","offered"].includes(q.state))q.state="cancelled";}
          notice(s,now,current.studentId,"Owner updated your bed reservation",`The owner marked ${describe(s,b)} available. Your previous reservation has ended. Reason: ${c.reason}`);
        }else b.version++;
        b.enabled=true;b.blockedReason=undefined;
        log(s,now,"Owner changed bed status",`${describe(s,b)} · ${previous} → available${c.reason?` · ${c.reason}`:""}`,b.propertyId,b.id);
        reconcile(s,now);
        return activeAllocation(s,b.id)?"Reservation ended. The next eligible student has received a waitlist offer; the bed is now under review.":"Bed marked available.";
      }
      if(!b.enabled)fail("BED_UNAVAILABLE","Resolve the operational block by marking the bed Available first.");
      if(current&&c.studentId&&c.studentId!==current.studentId)fail("ACTIVE_RESERVATION","This bed already has a reservation. Complete or clear it before assigning another person.");
      if(current?.state==="booked"&&c.status==="booked")return "This bed is already booked.";
      if(current?.state==="held"&&c.status==="on_hold")return "This bed is already on hold. Its existing deadline is unchanged.";
      if(current?.state==="booked"&&c.status==="on_hold"&&(!c.reason||c.reason.trim().length<5))fail("REASON_REQUIRED","Add a reason for changing this booking back to a hold.");
      const studentId=current?.studentId??c.studentId??"";
      if(studentId){person(s,studentId);if(pending(s,studentId,current?.id))fail("ACTIVE_COMMITMENT_EXISTS","This student has another active hold or offer. Release it before assigning this bed.");}
      if(c.status==="booked"&&(!c.moveInDate||!Number.isFinite(Date.parse(c.moveInDate))||new Date(c.moveInDate).toISOString().slice(0,10)!==c.moveInDate||c.agreedPrice===undefined))fail("VALIDATION_FAILED","Choose a valid move-in date and monthly rent for the offline booking.");
      if(!current){promote(s,b,now);if(activeAllocation(s,b.id))fail("QUEUE_PRIORITY_REQUIRED","An earlier eligible student has priority. Review their offer before assigning this bed.");}
      const a:Allocation=current??{id:randomUUID(),bedId:b.id,studentId,source:"offline",state:"held",durationHours:c.durationHours,createdAt:now,version:1};
      if(!current)s.allocations.push(a);
      if(!studentId)a.offlineGuest=c.offlineGuest??a.offlineGuest??{};
      if(c.status==="booked"){
        a.state="booked";a.expiresAt=undefined;a.moveInDate=c.moveInDate;a.agreedPrice=c.agreedPrice;
        if(a.queueId){const q=s.queues.find(q=>q.id===a.queueId);if(q)q.state="converted";}
        for(const q of s.queues.filter(q=>q.bedId===b.id&&["waiting","offered"].includes(q.state))){q.state="closed";notice(s,now,q.studentId,"A waitlist has closed",`${describe(s,b)} has been booked offline. Your other waitlists are unchanged.`);}
        notice(s,now,studentId,"Your offline booking is recorded",`The owner marked ${describe(s,b)} booked. Move-in: ${c.moveInDate}.`);
      }else{
        a.state="held";a.acceptedAt=now;a.durationHours=c.durationHours;a.expiresAt=now+c.durationHours*HOUR;a.closedAt=undefined;
        if(a.queueId){const q=s.queues.find(q=>q.id===a.queueId);if(q)q.state="converted";}
        notice(s,now,studentId,"Your space is on hold",`The owner recorded a ${c.durationHours}-hour hold for ${describe(s,b)} after your offline interaction.`);
      }
      if(c.reason)a.reason=c.reason;
      if(current)bump(s,a);else b.version++;
      log(s,now,"Owner changed bed status",`${describe(s,b)} · ${previous} → ${c.status}${c.reason?` · ${c.reason}`:""}`,b.propertyId,b.id);
      return c.status==="booked"?"Offline booking recorded. Bed marked booked.":`Bed placed on hold for ${c.durationHours} hours. It will expire automatically.`;
    }
    case "save": {
      const p = person(s,c.studentId); property(s,c.propertyId);
      const exists = p.saved.includes(c.propertyId);
      p.saved = exists ? p.saved.filter(id => id !== c.propertyId) : [...p.saved,c.propertyId];
      return exists ? "Removed from your saved places." : "A good place, saved for later.";
    }
    case "unlock": {
      const p = person(s,c.studentId); property(s,c.propertyId);
      if (hasAccess(s,p.id,c.propertyId,now)) return "You already have access. No credit used.";
      if (p.credits < 1) fail("INSUFFICIENT_CREDITS", "You need one credit to unlock this property.");
      p.credits--;
      s.access.push({id: randomUUID(), studentId: p.id, propertyId: c.propertyId, expiresAt: now + 30*DAY});
      s.ledger.unshift({id: randomUUID(), studentId: p.id, delta: -1, label: `Unlocked ${property(s,c.propertyId).name}`, createdAt: now});
      return "Floor layouts unlocked for 30 days. One credit used.";
    }
    case "previewPlus": {
      const p = person(s,c.studentId); p.premiumUntil = now + 30*DAY;
      return "Plus preview enabled. This is a demo; no payment was made.";
    }
    case "demoCredits": {
      const p = person(s,c.studentId); p.credits += 5;
      s.ledger.unshift({id: randomUUID(), studentId: p.id, delta: 5, label: "Demo credit top-up (no payment)", createdAt: now});
      return "Five demo credits added. No payment was made.";
    }
    case "accept": {
      const a = allocation(s,c.allocationId);
      if (a.studentId !== c.studentId) fail("FORBIDDEN", "Only the invited student can accept this offer.");
      guardVersion(a,c.expectedVersion);
      if (!["invited","offered"].includes(a.state) || !a.expiresAt || a.expiresAt <= now) fail("OFFER_EXPIRED", "This invitation is no longer available.");
      if (pending(s,a.studentId,a.id)) fail("ACTIVE_COMMITMENT_EXISTS", "Release your other active commitment first.");
      a.state = "held"; a.acceptedAt = now; a.expiresAt = now + a.durationHours*HOUR; bump(s,a);
      if (a.queueId) { const q = s.queues.find(q => q.id === a.queueId); if(q) q.state = "converted"; }
      notice(s,now,a.studentId,"Your space, held for you",`Your ${a.durationHours}-hour decision window for ${describe(s,bed(s,a.bedId))} has started.`);
      log(s,now,"Hold accepted",`${person(s,a.studentId).name} · ${describe(s,bed(s,a.bedId))}`);
      return `Your ${a.durationHours}-hour hold has started. Take your time.`;
    }
    case "release": {
      const a = allocation(s,c.allocationId);
      if (a.studentId !== c.studentId) fail("FORBIDDEN", "Only the current student can release this hold.");
      guardVersion(a,c.expectedVersion);
      if (!PENDING.includes(a.state)) fail("HOLD_CLOSED", "This hold has already ended.");
      a.state = "released"; a.closedAt = now; bump(s,a);
      if (a.queueId) { const q=s.queues.find(q=>q.id===a.queueId); if(q?.state==="offered") q.state="declined"; }
      notice(s,now,a.studentId,"Hold released",`You released ${describe(s,bed(s,a.bedId))}.`);
      log(s,now,"Hold released",`${person(s,a.studentId).name} · ${describe(s,bed(s,a.bedId))}`);
      reconcile(s,now); return "Hold released. The next eligible student has been considered.";
    }
    case "joinQueue": {
      person(s,c.studentId); const b = bed(s,c.bedId); const a = activeAllocation(s,b.id);
      if (!b.enabled || !a || a.state === "booked") fail("QUEUE_CLOSED", "Waitlists are available only for beds currently under review.");
      const own = s.queues.filter(q=>q.studentId===c.studentId && ["waiting","offered"].includes(q.state));
      if (own.some(q=>q.bedId===b.id)) fail("ALREADY_QUEUED","You are already in this queue.");
      if (a.studentId===c.studentId) fail("OWN_HOLD","This bed is already reserved for you.");
      if (own.length>=3) fail("QUEUE_LIMIT_REACHED","You can join up to three active waitlists.");
      if (!hasAccess(s,c.studentId,b.propertyId,now)) fail("ENTITLEMENT_REQUIRED","Unlock this property's details before joining its online queue.");
      s.queues.push({id:randomUUID(),bedId:b.id,studentId:c.studentId,sequence:++s.sequence,state:"waiting",createdAt:now});
      notice(s,now,c.studentId,"You're on the list",`You joined the queue for ${describe(s,b)}. Offers follow queue order.`);
      return "You're in the queue. We’ll let you know when it’s your turn.";
    }
    case "leaveQueue": {
      const q=s.queues.find(q=>q.id===c.entryId && q.studentId===c.studentId) ?? fail("NOT_FOUND","Queue entry not found.");
      if (!["waiting","offered"].includes(q.state)) fail("QUEUE_CLOSED","This queue entry is closed.");
      if(q.state==="offered") {
        const a=s.allocations.find(a=>a.queueId===q.id && a.state==="offered");
        if(a) { a.state="released"; a.closedAt=now; bump(s,a); }
      }
      q.state="cancelled"; reconcile(s,now); return "You left the waitlist.";
    }
    case "invite": {
      person(s,c.studentId); const b=bed(s,c.bedId); guardVersion(b,c.expectedVersion);
      if(!b.enabled || activeAllocation(s,b.id)) fail("BED_UNAVAILABLE","This bed is already allocated or unavailable.");
      if(pending(s,c.studentId)) fail("ACTIVE_COMMITMENT_EXISTS","This student already has an active hold or offer.");
      promote(s,b,now);
      if(activeAllocation(s,b.id)) fail("QUEUE_PRIORITY_REQUIRED","An earlier eligible student has priority for this bed.");
      s.allocations.push({id:randomUUID(),bedId:b.id,studentId:c.studentId,state:"invited",source:"owner",durationHours:c.durationHours,createdAt:now,expiresAt:now+2*HOUR,version:1}); b.version++;
      notice(s,now,c.studentId,"A place is waiting for you",`Accept the invitation for ${describe(s,b)} within two hours to begin your hold.`);
      log(s,now,"Invitation sent",`${person(s,c.studentId).name} · ${describe(s,b)}`);
      return "Invitation sent. The student has two hours to accept.";
    }
    case "book": {
      const a=allocation(s,c.allocationId); guardVersion(a,c.expectedVersion);
      if(a.state!=="held" || !a.expiresAt || a.expiresAt<=now) fail("HOLD_EXPIRED","Only a current, unexpired hold can be booked.");
      if(!Number.isFinite(Date.parse(c.moveInDate)) || new Date(c.moveInDate).toISOString().slice(0,10)!==c.moveInDate) fail("VALIDATION_FAILED","Choose a valid move-in date.");
      a.state="booked"; a.expiresAt=undefined; a.moveInDate=c.moveInDate; a.agreedPrice=c.agreedPrice; bump(s,a);
      for(const q of s.queues.filter(q=>q.bedId===a.bedId && ["waiting","offered"].includes(q.state))) {
        q.state="closed"; notice(s,now,q.studentId,"A waitlist has closed",`${describe(s,bed(s,a.bedId))} has been booked. Your other waitlists are unchanged.`);
      }
      notice(s,now,a.studentId,"Your next chapter is confirmed",`Your owner confirmed the offline booking for ${describe(s,bed(s,a.bedId))}.`);
      log(s,now,"Booking confirmed",`${person(s,a.studentId).name} · ${describe(s,bed(s,a.bedId))}`);
      return "Booking recorded. The remaining queue has been notified.";
    }
    case "cancel": {
      const a=allocation(s,c.allocationId); guardVersion(a,c.expectedVersion);
      if(!PENDING.includes(a.state)) fail("HOLD_CLOSED","Only an active invitation, offer or hold can be cancelled here.");
      a.state="cancelled"; a.closedAt=now; a.reason=c.reason; bump(s,a);
      const b=bed(s,a.bedId); b.enabled=false; b.blockedReason=c.reason;
      if(a.queueId) { const q=s.queues.find(q=>q.id===a.queueId); if(q?.state==="offered") q.state="cancelled"; }
      notice(s,now,a.studentId,"Your hold was cancelled",`The owner blocked ${describe(s,b)} for an operational issue: ${c.reason}`);
      for(const q of s.queues.filter(q=>q.bedId===b.id && q.state==="waiting")) notice(s,now,q.studentId,"A queued bed is unavailable",`${describe(s,b)} is blocked while the owner resolves an operational issue. Your queue entry remains.`);
      log(s,now,"Exceptional cancellation",`${describe(s,b)} · ${c.reason}`);
      return "Hold cancelled and bed blocked. Affected students were notified in the demo inbox.";
    }
    case "block": {
      const b=bed(s,c.bedId); guardVersion(b,c.expectedVersion);
      if(activeAllocation(s,b.id)) fail("BED_UNAVAILABLE","Close the active booking or use exceptional cancellation first.");
      b.enabled=false; b.blockedReason=c.reason; b.version++;
      log(s,now,"Bed blocked",`${describe(s,b)} · ${c.reason}`); return "Bed marked unavailable.";
    }
    case "resolveBlock": {
      const b=bed(s,c.bedId); guardVersion(b,c.expectedVersion);
      b.enabled=true; b.blockedReason=undefined; b.version++; promote(s,b,now);
      log(s,now,"Bed reopened",describe(s,b)); return "Operational block resolved. The queue has been checked.";
    }
    case "checkout": {
      const a=allocation(s,c.allocationId); guardVersion(a,c.expectedVersion);
      if(a.state!=="booked") fail("BOOKING_CLOSED","This booking is no longer active.");
      a.state="ended"; a.closedAt=now; bump(s,a); promote(s,bed(s,a.bedId),now);
      log(s,now,"Checkout recorded",describe(s,bed(s,a.bedId))); return "Checkout recorded. The bed is available again.";
    }
    case "readNotices": s.notices.filter(n=>n.studentId===c.studentId).forEach(n=>n.read=true); return "Notifications marked as read.";
    case "advanceClock": s.clockOffset+=c.hours*HOUR; reconcile(s,now+c.hours*HOUR); return `Demo clock advanced ${c.hours} hours. Due holds and offers were reconciled.`;
    case "reset": {
      const fresh=createSeed(now-s.clockOffset); Object.assign(s,fresh); return "Demo restored to its starting state.";
    }
    case "addProperty": {
      if(c.image && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(c.image)) fail("INVALID_IMAGE","Use a JPG, PNG or WebP image.");
      const floors=c.floors??[{number:1,images:[],rooms:Array.from({length:c.rooms},(_,i)=>({number:String(101+i),beds:c.bedsPerRoom,images:[]}))}];
      const images=c.images??(c.image?[c.image]:[]);
      if(!photoBudget(images,floors))fail("PHOTO_LIMIT","Keep all property photos under 16 MB combined. Remove a few photos and try again.");
      const id=randomUUID();
      s.properties.push({id,floors,images,location:c.location,name:c.name,locality:c.locality,city:c.city||"",address:c.address||c.locality,category:c.category,price:c.price,deposit:c.price,distance:0,image:images[0]||"/images/property-placeholder.svg",description:c.description||"Contact the owner to arrange a visit and learn more.",amenities:c.amenities||[],sharing:[...new Set(floors.flatMap(f=>f.rooms.map(r=>r.beds===1?"Single":r.beds===2?"Twin":r.beds===3?"Triple":`${r.beds}-sharing`)))],contact:"",published:true});
      for(const floor of floors)for(const room of floor.rooms)for(let i=0;i<room.beds;i++)s.beds.push({id:randomUUID(),propertyId:id,floor:floor.number,room:room.number,label:roomLabels(room)[i],enabled:true,version:1});
      log(s,now,"Property created",c.name); return "Property published with its rooms and beds.";
    }
    case "appendFloors": {
      const p=property(s,c.propertyId),existing=propertyFloors(p,s.beds);
      if(existing.length+c.floors.length>10)fail("FLOOR_LIMIT","This prototype supports up to 10 floors per property.");
      if(c.floors.some(f=>existing.some(old=>old.number===f.number)))fail("DUPLICATE_FLOOR","That floor already exists. Choose a different floor number.");
      if(!photoBudget(p.images??[],[...existing,...c.floors]))fail("PHOTO_LIMIT","Keep all property photos under 16 MB combined.");
      p.floors=[...existing,...c.floors].sort((a,b)=>a.number-b.number);
      for(const floor of c.floors)for(const room of floor.rooms)for(let i=0;i<room.beds;i++)s.beds.push({id:randomUUID(),propertyId:p.id,floor:floor.number,room:room.number,label:roomLabels(room)[i],enabled:true,version:1});
      p.sharing=[...new Set(p.floors.flatMap(f=>f.rooms.map(r=>r.beds===1?"Single":r.beds===2?"Twin":r.beds===3?"Triple":`${r.beds}-sharing`)))];
      return "Floors, rooms and beds added. Existing reservations are unchanged.";
    }
    case "appendRooms": {
      const p=property(s,c.propertyId),floors=propertyFloors(p,s.beds),floor=floors.find(f=>f.number===c.floor);
      if(!floor)fail("NOT_FOUND","Floor not found.");
      if(floor.rooms.length+c.rooms.length>30)fail("ROOM_LIMIT","Use up to 30 rooms per floor.");
      const names=[...floor.rooms,...c.rooms].map(r=>r.number.toLowerCase());
      if(new Set(names).size!==names.length)fail("DUPLICATE_ROOM","A room with that name already exists on this floor.");
      const candidate=floors.map(f=>f.number===c.floor?{...f,rooms:[...f.rooms,...c.rooms]}:f);
      if(!photoBudget(p.images??[],candidate))fail("PHOTO_LIMIT","Keep all property photos under 16 MB combined.");
      p.floors=candidate;
      for(const room of c.rooms)for(const label of roomLabels(room))s.beds.push({id:randomUUID(),propertyId:p.id,floor:c.floor,room:room.number,label,enabled:true,version:1});
      p.sharing=[...new Set(candidate.flatMap(f=>f.rooms.map(r=>r.beds===1?"Single":r.beds===2?"Twin":r.beds===3?"Triple":`${r.beds}-sharing`)))];
      return "Room and bed slots added. Existing reservations stay in place.";
    }
    case "appendBedSlots": {
      const p=property(s,c.propertyId),floors=propertyFloors(p,s.beds),room=floors.find(f=>f.number===c.floor)?.rooms.find(r=>r.number===c.room);
      if(!room)fail("NOT_FOUND","Room not found.");
      const existing=s.beds.filter(b=>b.propertyId===p.id&&b.floor===c.floor&&b.room===c.room).map(b=>b.label);
      const labels=[...existing,...c.labels];
      if(labels.length>12)fail("BED_LIMIT","Use up to 12 bed slots per room.");
      if(new Set(labels.map(l=>l.toLowerCase())).size!==labels.length)fail("DUPLICATE_BED","A bed slot with that name already exists in this room.");
      room.beds=labels.length;room.bedLabels=labels;p.floors=floors;
      for(const label of c.labels)s.beds.push({id:randomUUID(),propertyId:p.id,floor:c.floor,room:c.room,label,enabled:true,version:1});
      p.sharing=[...new Set(floors.flatMap(f=>f.rooms.map(r=>r.beds===1?"Single":r.beds===2?"Twin":r.beds===3?"Triple":`${r.beds}-sharing`)))];
      return "Bed slots added. Existing holds and bookings are unchanged.";
    }
    case "setPropertyPhotos": {
      const p=property(s,c.propertyId),existing=propertyFloors(p,s.beds);
      if(c.floors.length!==existing.length||c.floors.some(f=>{const old=existing.find(o=>o.number===f.number);return !old||old.rooms.length!==f.rooms.length||f.rooms.some(r=>!old.rooms.some(o=>o.number===r.number&&o.beds===r.beds));}))fail("STRUCTURE_CHANGED","The property structure changed. Reopen the photo editor and try again.");
      if(!photoBudget(c.images,c.floors))fail("PHOTO_LIMIT","Keep all property photos under 16 MB combined.");
      if(c.floors.some(f=>f.rooms.some(r=>{const old=existing.find(o=>o.number===f.number)!.rooms.find(o=>o.number===r.number)!;return roomLabels(old).some((label,i)=>label!==roomLabels(r)[i]);})))fail("STRUCTURE_CHANGED","Bed slot names changed. Reopen the photo editor and try again.");
      p.images=c.images;p.image=c.images[0]||"/images/property-placeholder.svg";p.floors=existing.map(f=>({...f,images:c.floors.find(n=>n.number===f.number)!.images,rooms:f.rooms.map(r=>({...r,images:c.floors.find(n=>n.number===f.number)!.rooms.find(n=>n.number===r.number)!.images}))}));
      return "Property, floor and room photos saved.";
    }
    case "setPropertyLocation": {
      property(s,c.propertyId).location=c.location;
      return "Property location saved. Students can now see the pin and get directions.";
    }
  }
}
