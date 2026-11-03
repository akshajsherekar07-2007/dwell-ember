import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { mutateDemo as Mutation, readDemo as Reader } from "../src/lib/repository";

let mutateDemo:typeof Mutation, readDemo:typeof Reader, directory:string;
const testRoot=path.resolve(process.cwd(),".test-data");
beforeAll(async()=>{
  await mkdir(testRoot,{recursive:true});directory=await mkdtemp(path.join(testRoot,"repository-"));
  process.env.DWELL_DATA_DIR=directory;
  const repository=await import("../src/lib/repository");mutateDemo=repository.mutateDemo;readDemo=repository.readDemo;
});
beforeEach(async()=>{await mutateDemo({type:"reset"},randomUUID());});
afterAll(async()=>{
  delete process.env.DWELL_DATA_DIR;
  if(!path.resolve(directory).startsWith(testRoot+path.sep))throw new Error("Refusing to remove unexpected test path");
  await rm(directory,{recursive:true,force:true});
});
describe("serialized local demo transactions",()=>{
  it("competing offline bookings allocate a bed only once",async()=>{
    const s=await readDemo(),b=s.beds.find(b=>b.id==="cedar-201-A")!;
    const attempts=await Promise.allSettled(Array.from({length:30},()=>mutateDemo({type:"ownerSetBedStatus",bedId:b.id,expectedVersion:b.version,status:"booked",durationHours:48,moveInDate:"2026-11-04",agreedPrice:9000},randomUUID())));
    expect(attempts.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect((await readDemo()).allocations.filter(a=>a.bedId===b.id&&a.state==="booked")).toHaveLength(1);
  });
  it("competing additions cannot create duplicate named bed slots",async()=>{
    const before=await readDemo();const attempts=await Promise.allSettled(Array.from({length:30},()=>mutateDemo({type:"appendBedSlots",propertyId:"cedar",floor:1,room:"201",labels:["201-New"]},randomUUID())));
    expect(attempts.filter(a=>a.status==="fulfilled")).toHaveLength(1);
    const after=await readDemo();expect(after.beds).toHaveLength(before.beds.length+1);expect(after.beds.filter(b=>b.propertyId==="cedar"&&b.floor===1&&b.room==="201"&&b.label==="201-New")).toHaveLength(1);
    expect(after.allocations.map(a=>a.bedId)).toEqual(before.allocations.map(a=>a.bedId));
  });
  it("100 competing invitations produce exactly one reservation",async()=>{
    const state=await readDemo(),bed=state.beds.find(b=>b.id==="cedar-201-A")!;
    const attempts=await Promise.allSettled(Array.from({length:100},(_,i)=>mutateDemo({type:"invite",studentId:["riya","kabir","meera"][i%3],bedId:bed.id,expectedVersion:bed.version,durationHours:48},randomUUID())));
    expect(attempts.filter(a=>a.status==="fulfilled")).toHaveLength(1);
    const after=await readDemo();expect(after.allocations.filter(a=>a.bedId===bed.id&&a.state==="invited")).toHaveLength(1);
  });
  it("concurrent unlocks create one entitlement and one debit",async()=>{
    await Promise.all(Array.from({length:10},()=>mutateDemo({type:"unlock",studentId:"aarav",propertyId:"cedar"},randomUUID())));
    const state=await readDemo();expect(state.people.find(p=>p.id==="aarav")?.credits).toBe(2);
    expect(state.access.filter(a=>a.studentId==="aarav"&&a.propertyId==="cedar")).toHaveLength(1);
  });
  it("replaying an identical request does not toggle saved state twice",async()=>{
    const key=randomUUID(),command={type:"save" as const,studentId:"aarav",propertyId:"cedar"};
    const first=await mutateDemo(command,key),second=await mutateDemo(command,key);
    expect(second.message).toBe(first.message);expect(second.state.people[0].saved).toContain("cedar");
    await expect(mutateDemo({...command,propertyId:"fern"},key)).rejects.toMatchObject({code:"IDEMPOTENCY_CONFLICT"});
  });
  it("failed commands do not persist partial business changes",async()=>{
    const before=await readDemo();
    await expect(mutateDemo({type:"accept",studentId:"riya",allocationId:"hold-aarav",expectedVersion:1},randomUUID())).rejects.toMatchObject({code:"FORBIDDEN"});
    const after=await readDemo();expect(after.allocations).toEqual(before.allocations);expect(after.people).toEqual(before.people);
  });
  it("advancing the clock reconciles holds and creates a fresh two-hour offer",async()=>{
    const result=await mutateDemo({type:"advanceClock",hours:48},randomUUID());
    const offer=result.state.allocations.find(a=>a.bedId==="maple-203-B"&&a.state==="offered")!;
    expect(offer.studentId).toBe("riya");expect(offer.expiresAt!-result.state.serverTime).toBeGreaterThan(7_190_000);
  });
});
