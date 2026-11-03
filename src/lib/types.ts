export type Availability = "vacant" | "under_review" | "booked" | "unavailable";
export type AllocationState = "invited" | "offered" | "held" | "booked" | "expired" | "released" | "cancelled" | "ended";
export type QueueState = "waiting" | "offered" | "converted" | "declined" | "expired" | "cancelled" | "closed";
export interface Person { id: string; name: string; initials: string; credits: number; premiumUntil?: number; saved: string[]; role?: "owner" | "student"; email?: string; phone?: string; }
export interface Property {
  id: string; name: string; locality: string; city: string; address: string; category: "PG" | "Hostel" | "Co-living";
  price: number; deposit: number; distance: number; image: string; description: string; amenities: string[];
  sharing: string[]; label?: string; contact: string; published: boolean; ownerId?: string; location?: {latitude:number;longitude:number};
  images?:string[]; floors?:import("./property-structure").FloorPlan[];
}
export interface Bed { id: string; propertyId: string; floor: number; room: string; label: string; enabled: boolean; blockedReason?: string; version: number; }
export interface Allocation {
  id: string; bedId: string; studentId: string; state: AllocationState; source: "owner" | "waitlist" | "offline";
  durationHours: number; createdAt: number; expiresAt?: number; acceptedAt?: number; closedAt?: number;
  version: number; queueId?: string; reason?: string; moveInDate?: string; agreedPrice?: number;
  offlineGuest?: {name?:string;phone?:string};
}
export interface QueueEntry { id: string; bedId: string; studentId: string; sequence: number; state: QueueState; createdAt: number; }
export interface Access { id: string; studentId: string; propertyId: string; expiresAt: number; }
export interface Notice { id: string; studentId: string; title: string; message: string; createdAt: number; read: boolean; }
export interface Activity { id: string; action: string; detail: string; createdAt: number; propertyId?:string;bedId?:string; }
export interface CreditEntry { id: string; studentId: string; delta: number; label: string; createdAt: number; }
export interface DemoState {
  revision: number; clockOffset: number; people: Person[]; properties: Property[]; beds: Bed[];
  allocations: Allocation[]; queues: QueueEntry[]; access: Access[]; notices: Notice[];
  activity: Activity[]; ledger: CreditEntry[]; sequence: number;
  requests: Record<string, { hash: string; message: string; createdAt: number }>;
}
export interface Snapshot extends DemoState { serverTime: number; mode: "local-demo"; currentUser?: Person; }
export const ACTIVE: AllocationState[] = ["invited", "offered", "held", "booked"];
export const PENDING: AllocationState[] = ["invited", "offered", "held"];
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export function activeAllocation(state: DemoState, bedId: string) {
  return state.allocations.find(a => a.bedId === bedId && ACTIVE.includes(a.state));
}
export function availability(state: DemoState, bed: Bed): Availability {
  if (!bed.enabled) return "unavailable";
  const allocation = activeAllocation(state, bed.id);
  return allocation?.state === "booked" ? "booked" : allocation ? "under_review" : "vacant";
}
export function hasAccess(state: DemoState, studentId: string, propertyId: string, now: number) {
  return (state.people.find(p => p.id === studentId)?.premiumUntil ?? 0) > now ||
    state.access.some(a => a.studentId === studentId && a.propertyId === propertyId && a.expiresAt > now);
}
