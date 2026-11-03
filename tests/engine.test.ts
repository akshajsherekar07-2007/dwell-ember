import { describe, expect, it } from "vitest";
import { createSeed } from "../src/lib/seed";
import { execute, reconcile } from "../src/lib/engine";
import { activeAllocation, DAY, HOUR, PENDING } from "../src/lib/types";

const now=Date.parse("2026-11-02T12:00:00Z");
describe("protected holds and FIFO",()=>{
  it("starts a fresh 48h hold when the oldest queued student accepts",()=>{
    const state=createSeed(now);
    execute(state,{type:"release",studentId:"aarav",allocationId:"hold-aarav",expectedVersion:1},now);
    const offer=activeAllocation(state,"maple-203-B")!;
    expect(offer.studentId).toBe("riya");expect(offer.state).toBe("offered");expect(offer.expiresAt).toBe(now+2*HOUR);
    execute(state,{type:"accept",studentId:"riya",allocationId:offer.id,expectedVersion:offer.version},now+HOUR);
    expect(offer.state).toBe("held");expect(offer.expiresAt).toBe(now+49*HOUR);
    expect(state.queues.find(q=>q.studentId==="riya")?.state).toBe("converted");
  });
  it("treats equality with a deadline as expired and advances the queue",()=>{
    const state=createSeed(now);reconcile(state,now+36*HOUR);
    expect(state.allocations.find(a=>a.id==="hold-aarav")?.state).toBe("expired");
    expect(activeAllocation(state,"maple-203-B")?.studentId).toBe("riya");
    expect(activeAllocation(state,"maple-203-B")?.expiresAt).toBe(now+38*HOUR);
  });
  it("expires an unaccepted offer and advances to the next student",()=>{
    const state=createSeed(now);execute(state,{type:"release",studentId:"aarav",allocationId:"hold-aarav",expectedVersion:1},now);
    reconcile(state,now+2*HOUR);
    expect(activeAllocation(state,"maple-203-B")?.studentId).toBe("kabir");
    expect(state.queues.find(q=>q.studentId==="riya")?.state).toBe("expired");
  });
  it("skips temporarily ineligible students without deleting their queue entries",()=>{
    const state=createSeed(now);const bed=state.beds.find(b=>b.id==="cedar-201-A")!;
    execute(state,{type:"invite",studentId:"riya",bedId:bed.id,expectedVersion:bed.version,durationHours:48},now);
    execute(state,{type:"release",studentId:"aarav",allocationId:"hold-aarav",expectedVersion:1},now);
    expect(activeAllocation(state,"maple-203-B")?.studentId).toBe("kabir");
    expect(state.queues.find(q=>q.studentId==="riya")?.state).toBe("waiting");
  });
  it("does not allow another student or owner invitation to replace an active hold",()=>{
    const state=createSeed(now);const bed=state.beds.find(b=>b.id==="maple-203-B")!;
    expect(()=>execute(state,{type:"accept",studentId:"riya",allocationId:"hold-aarav",expectedVersion:1},now)).toThrow("Only the invited student");
    expect(()=>execute(state,{type:"invite",studentId:"riya",bedId:bed.id,expectedVersion:bed.version,durationHours:48},now)).toThrow("already allocated");
    expect(activeAllocation(state,bed.id)?.studentId).toBe("aarav");
  });
  it("guards one pending commitment per student and stale versions",()=>{
    const state=createSeed(now);const bed=state.beds.find(b=>b.id==="cedar-201-A")!;
    expect(()=>execute(state,{type:"invite",studentId:"aarav",bedId:bed.id,expectedVersion:1,durationHours:48},now)).toThrow("already has an active");
    expect(()=>execute(state,{type:"release",studentId:"aarav",allocationId:"hold-aarav",expectedVersion:99},now)).toThrow("changed");
  });
  it("allows leaving an exclusive offer and immediately promotes the next entry",()=>{
    const state=createSeed(now);execute(state,{type:"release",studentId:"aarav",allocationId:"hold-aarav",expectedVersion:1},now);
    execute(state,{type:"leaveQueue",studentId:"riya",entryId:"queue-riya"},now);
    expect(activeAllocation(state,"maple-203-B")?.studentId).toBe("kabir");
    expect(state.queues.find(q=>q.id==="queue-riya")?.state).toBe("cancelled");
  });
  it("blocks inventory after an exceptional cancellation and notifies those waiting",()=>{
    const state=createSeed(now);execute(state,{type:"cancel",allocationId:"hold-aarav",expectedVersion:1,reason:"Safety issue: damaged window needs repair"},now);
    const bed=state.beds.find(b=>b.id==="maple-203-B")!;expect(bed.enabled).toBe(false);expect(activeAllocation(state,bed.id)).toBeUndefined();
    expect(state.notices.filter(n=>["riya","kabir","meera"].includes(n.studentId))).toHaveLength(3);
    execute(state,{type:"resolveBlock",bedId:bed.id,expectedVersion:bed.version},now);
    expect(activeAllocation(state,bed.id)?.studentId).toBe("riya");
  });
  it("booking closes the remaining queue and checkout frees inventory",()=>{
    const state=createSeed(now);execute(state,{type:"book",allocationId:"hold-aarav",expectedVersion:1,moveInDate:"2026-11-05",agreedPrice:9500},now);
    expect(state.queues.every(q=>q.state==="closed")).toBe(true);
    const booked=activeAllocation(state,"maple-203-B")!;expect(booked.state).toBe("booked");
    execute(state,{type:"checkout",allocationId:booked.id,expectedVersion:booked.version},now);
    expect(activeAllocation(state,"maple-203-B")).toBeUndefined();
  });
  it("cannot book at expiry or use a nonexistent calendar date",()=>{
    const state=createSeed(now);const command={type:"book" as const,allocationId:"hold-aarav",expectedVersion:1,moveInDate:"2026-11-05",agreedPrice:9500};
    expect(()=>execute(state,command,now+36*HOUR)).toThrow("unexpired");
    expect(()=>execute(state,{...command,moveInDate:"2026-02-30"},now)).toThrow("valid move-in");
  });
});
describe("access and queue limits",()=>{
  it("requires detail access, rejects duplicates, and enforces three live queues",()=>{
    const state=createSeed(now);
    expect(()=>execute(state,{type:"joinQueue",studentId:"aarav",bedId:"maple-201-C"},now)).toThrow("Unlock");
    execute(state,{type:"previewPlus",studentId:"aarav"},now);
    for(const [studentId,bedId] of [["riya","cedar-201-A"],["kabir","cedar-201-B"]]) {
      const b=state.beds.find(b=>b.id===bedId)!;
      execute(state,{type:"invite",studentId,bedId,expectedVersion:b.version,durationHours:48},now);
    }
    for(const id of ["maple-201-C","maple-203-C","cedar-201-A"])execute(state,{type:"joinQueue",studentId:"aarav",bedId:id},now);
    expect(()=>execute(state,{type:"joinQueue",studentId:"aarav",bedId:"maple-201-C"},now)).toThrow("already");
    expect(()=>execute(state,{type:"joinQueue",studentId:"aarav",bedId:"cedar-201-B"},now)).toThrow("three active");
  });
  it("deducts one credit once and allows renewed access after 30 days",()=>{
    const state=createSeed(now),p=state.people[0];
    execute(state,{type:"unlock",studentId:p.id,propertyId:"maple"},now);
    execute(state,{type:"unlock",studentId:p.id,propertyId:"maple"},now);
    expect(p.credits).toBe(2);expect(state.access).toHaveLength(1);expect(state.access[0].expiresAt).toBe(now+30*DAY);
    execute(state,{type:"unlock",studentId:p.id,propertyId:"maple"},now+30*DAY);
    expect(p.credits).toBe(1);
  });
  it("never debits when subscribed or when the wallet is empty",()=>{
    const state=createSeed(now);execute(state,{type:"previewPlus",studentId:"aarav"},now);
    execute(state,{type:"unlock",studentId:"aarav",propertyId:"maple"},now);expect(state.people[0].credits).toBe(3);
    state.people[1].credits=0;
    expect(()=>execute(state,{type:"unlock",studentId:"riya",propertyId:"cedar"},now)).toThrow("one credit");
    expect(state.people[1].credits).toBe(0);
  });
  it("reconciliation never creates multiple active commitments per bed/student",()=>{
    const state=createSeed(now);reconcile(state,now+60*HOUR);reconcile(state,now+62*HOUR);reconcile(state,now+64*HOUR);
    for(const b of state.beds)expect(state.allocations.filter(a=>a.bedId===b.id&&[...PENDING,"booked"].includes(a.state)).length).toBeLessThanOrEqual(1);
    for(const p of state.people)expect(state.allocations.filter(a=>a.studentId===p.id&&PENDING.includes(a.state)).length).toBeLessThanOrEqual(1);
  });
});
