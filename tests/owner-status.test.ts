import { describe, expect, it } from "vitest";
import { commandSchema, execute, reconcile } from "../src/lib/engine";
import { createSeed } from "../src/lib/seed";
import { activeAllocation, availability, HOUR } from "../src/lib/types";
const now=Date.parse("2026-11-03T10:00:00Z");
function change(s:ReturnType<typeof createSeed>,bedId:string,status:"available"|"on_hold"|"booked",extra:Record<string,unknown>={}){
  const b=s.beds.find(b=>b.id===bedId)!;return execute(s,commandSchema.parse({type:"ownerSetBedStatus",bedId,expectedVersion:b.version,status,durationHours:48,moveInDate:"2026-11-04",agreedPrice:9500,...extra}),now);
}
describe("owner-managed offline bed statuses",()=>{
  it("records an offline booking without creating a student account",()=>{
    const s=createSeed(now),people=s.people.length;change(s,"cedar-201-A","booked",{offlineGuest:{name:"Offline visitor",phone:"1234567890"}});
    const a=activeAllocation(s,"cedar-201-A")!;expect(a.state).toBe("booked");expect(a.source).toBe("offline");expect(a.studentId).toBe("");expect(a.offlineGuest?.name).toBe("Offline visitor");expect(s.people).toHaveLength(people);
    expect(availability(s,s.beds.find(b=>b.id===a.bedId)!)).toBe("booked");expect(s.activity[0].bedId).toBe(a.bedId);expect(s.notices.some(n=>n.studentId==="")).toBe(false);
  });
  it("expires offline holds and offers the bed to the FIFO student",()=>{
    const s=createSeed(now);change(s,"cedar-201-A","on_hold",{durationHours:2});const hold=activeAllocation(s,"cedar-201-A")!;
    s.queues.push({id:"offline-queue",bedId:hold.bedId,studentId:"riya",sequence:++s.sequence,state:"waiting",createdAt:now});
    reconcile(s,now+2*HOUR);expect(hold.state).toBe("expired");expect(activeAllocation(s,hold.bedId)?.studentId).toBe("riya");expect(activeAllocation(s,hold.bedId)?.expiresAt).toBe(now+4*HOUR);
    expect(s.notices.some(n=>n.studentId==="")).toBe(false);
  });
  it("marks an offline booked bed available with an ended history record",()=>{
    const s=createSeed(now);change(s,"cedar-201-A","booked");const a=activeAllocation(s,"cedar-201-A")!;
    expect(()=>change(s,a.bedId,"available")).toThrow("reason");change(s,a.bedId,"available",{reason:"Resident checked out offline."});
    expect(a.state).toBe("ended");expect(a.closedAt).toBe(now);expect(activeAllocation(s,a.bedId)).toBeUndefined();expect(availability(s,s.beds.find(b=>b.id===a.bedId)!)).toBe("vacant");
  });
  it("clears a registered hold with a reason, notifies its student, and preserves FIFO",()=>{
    const s=createSeed(now);const message=change(s,"maple-203-B","available",{reason:"Student cancelled after our conversation."});
    expect(s.allocations.find(a=>a.id==="hold-aarav")?.state).toBe("cancelled");expect(activeAllocation(s,"maple-203-B")?.studentId).toBe("riya");expect(message).toContain("waitlist offer");
    expect(s.notices.some(n=>n.studentId==="aarav"&&n.message.includes("Student cancelled"))).toBe(true);
  });
  it("books the current registered student and closes the remaining waitlist",()=>{
    const s=createSeed(now);change(s,"maple-203-B","booked");expect(activeAllocation(s,"maple-203-B")?.studentId).toBe("aarav");expect(activeAllocation(s,"maple-203-B")?.state).toBe("booked");
    expect(s.queues.filter(q=>q.bedId==="maple-203-B").every(q=>q.state==="closed")).toBe(true);expect(s.notices.some(n=>n.studentId==="riya"&&n.title.includes("waitlist"))).toBe(true);
  });
  it("rejects reassigning someone else’s hold and does not reset an existing hold deadline",()=>{
    const s=createSeed(now),original=activeAllocation(s,"maple-203-B")!;const deadline=original.expiresAt;
    expect(()=>change(s,"maple-203-B","booked",{studentId:"riya"})).toThrow("already has a reservation");
    change(s,"maple-203-B","on_hold");expect(original.expiresAt).toBe(deadline);
  });
  it("requires a reason for booking-to-hold corrections and never exceeds 48 hours",()=>{
    const s=createSeed(now);change(s,"cedar-201-A","booked");expect(()=>change(s,"cedar-201-A","on_hold")).toThrow("reason");change(s,"cedar-201-A","on_hold",{durationHours:6,reason:"Correcting booking entered before final confirmation."});
    expect(activeAllocation(s,"cedar-201-A")?.expiresAt).toBe(now+6*HOUR);
    expect(commandSchema.safeParse({type:"ownerSetBedStatus",bedId:"a",expectedVersion:1,status:"on_hold",durationHours:49}).success).toBe(false);
  });
  it("rejects stale writes, invalid calendar dates and reservations on blocked beds",()=>{
    const s=createSeed(now);expect(()=>change(s,"cedar-201-A","booked",{moveInDate:"2026-02-31"})).toThrow("valid move-in date");
    expect(()=>change(s,"cedar-201-A","booked",{expectedVersion:999})).toThrow("changed");
    const b=s.beds.find(b=>b.id==="cedar-201-A")!;b.enabled=false;expect(()=>change(s,b.id,"booked")).toThrow("operational block");change(s,b.id,"available",{reason:"Maintenance completed and bed inspected."});expect(b.enabled).toBe(true);
  });
});
