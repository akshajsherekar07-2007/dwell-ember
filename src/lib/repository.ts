import { readFile } from "node:fs/promises";
import { writeJsonAtomically } from "./atomic-json";
import path from "node:path";
import { createHash } from "node:crypto";
import { createSeed } from "./seed";
import { createEmpty } from "./empty";
import type { Person } from "./types";
import { DomainError, execute, reconcile, type Command } from "./engine";
import { DAY, hasAccess, type DemoState, type Snapshot } from "./types";

// Local demo only: a process-wide serialized transaction queue. Production must
// use the PostgreSQL constraints/command RPCs in docs/DATABASE.md, not this file.
const globalStore = globalThis as typeof globalThis & { dwellQueue?: Promise<void> };
export const directory=path.resolve(/* turbopackIgnore: true */ process.env.DWELL_DATA_DIR || path.join(process.cwd(),".data"));
const file=path.join(directory,process.env.NODE_ENV === "test" ? "demo.json" : "prototype.json");
async function load(): Promise<DemoState> {
  try { return JSON.parse(await readFile(file,"utf8")) as DemoState; }
  catch(e) { if((e as NodeJS.ErrnoException).code==="ENOENT") return process.env.NODE_ENV === "test" && process.env.DWELL_EMPTY !== "true" ? createSeed() : createEmpty(); throw e; }
}
async function save(state:DemoState){await writeJsonAtomically(file,state);}
export async function serialized<T>(operation:()=>Promise<T>):Promise<T> {
  const previous=globalStore.dwellQueue??Promise.resolve();
  let unlock!:()=>void;
  globalStore.dwellQueue=new Promise<void>(resolve=>{unlock=resolve;});
  await previous.catch(()=>undefined);
  try {return await operation();} finally {unlock();}
}
function snapshot(state:DemoState):Snapshot {return {...state,serverTime:Date.now()+state.clockOffset,mode:"local-demo"};}
export function readDemo(actor?:Person) {
  return serialized(async()=>{
    const state=await load(); reconcile(state,Date.now()+state.clockOffset); await save(state); return actor ? scopedSnapshot(state,actor) : snapshot(state);
  });
}
export function mutateDemo(command:Command,key:string,actor?:Person) {
  return serialized(async()=>{
    const state=await load(); if(actor) command=authorize(state,command,actor); key=actor ? `${actor.id}:${key}` : key; const now=Date.now()+state.clockOffset;
    const hash=createHash("sha256").update(JSON.stringify(command)).digest("hex");
    // Keep a clone for a failed command so reconciliation commits but a partially
    // applied business action cannot escape its transaction.
    reconcile(state,now);
    const previous=state.requests[key];
    if(previous && now-previous.createdAt<DAY) {
      if(previous.hash!==hash) {await save(state); throw new DomainError("IDEMPOTENCY_CONFLICT","This request key was already used for a different action.");}
      await save(state); return {state:actor?scopedSnapshot(state,actor):snapshot(state),message:previous.message};
    }
    const candidate=structuredClone(state);
    let message:string;
    try { message=execute(candidate,command,now); }
    catch(error) { await save(state); throw error; }
    if(actor && command.type==="addProperty") {const p=candidate.properties.at(-1)!;p.ownerId=actor.id;p.contact=actor.phone||"";}
    candidate.revision++;
    for(const [k,entry] of Object.entries(candidate.requests)) if(now-entry.createdAt>=DAY) delete candidate.requests[k];
    candidate.requests[key]={hash,message,createdAt:Date.now()+candidate.clockOffset};
    await save(candidate); return {state:actor?scopedSnapshot(candidate,actor):snapshot(candidate),message};
  });
}

export function registerPerson(person:Person) {
  return serialized(async()=>{const state=await load();state.people.push(person);await save(state);});
}
export function readPublicListings(){
  return serialized(async()=>{const s=await load();reconcile(s,Date.now()+s.clockOffset);await save(s);
    return s.properties.filter(p=>p.published).map(p=>({id:p.id,name:p.name,locality:p.locality,city:p.city,category:p.category,price:p.price,image:p.image,amenities:p.amenities,available:s.beds.filter(b=>b.propertyId===p.id&&b.enabled&&!s.allocations.some(a=>a.bedId===b.id&&["invited","offered","held","booked"].includes(a.state))).length}));
  });
}
function authorize(s:DemoState,c:Command,actor:Person):Command {
  const forbidden=()=>{throw new DomainError("FORBIDDEN","This action is not available for your account.",403);};
  if(["reset","advanceClock","previewPlus","demoCredits"].includes(c.type)) return forbidden();
  const ownerActions=["ownerSetBedStatus","addProperty","appendRooms","appendBedSlots","appendFloors","setPropertyPhotos","setPropertyLocation","invite","book","cancel","block","resolveBlock","checkout"];
  if(ownerActions.includes(c.type)) {
    if(actor.role!=="owner") return forbidden();
    if(c.type==="addProperty") {if(!c.city || !c.address) throw new DomainError("INVALID_INPUT","City and full property address are required.",422); return c;}
    if(c.type==="appendRooms"||c.type==="appendBedSlots"||c.type==="setPropertyLocation"||c.type==="appendFloors"||c.type==="setPropertyPhotos") {if(!s.properties.some(p=>p.id===c.propertyId&&p.ownerId===actor.id))return forbidden();return c;}
    const bedId="bedId" in c ? c.bedId : "allocationId" in c ? s.allocations.find(a=>a.id===c.allocationId)?.bedId : undefined;
    const b=s.beds.find(b=>b.id===bedId);
    if(!b || !s.properties.some(p=>p.id===b.propertyId&&p.ownerId===actor.id)) return forbidden();
    if(c.type==="ownerSetBedStatus") {
      if(c.studentEmail){const student=s.people.find(p=>p.role==="student"&&p.email?.toLowerCase()===c.studentEmail!.toLowerCase());if(!student)throw new DomainError("STUDENT_NOT_FOUND","No student account has this email. Use Offline guest, or ask them to sign up first.",404);return {...c,studentId:student.id};}
      const {studentId:ignored,...safe}=c;return safe;
    }
    if(c.type==="invite") {
      const student=s.people.find(p=>p.role==="student"&&p.email?.toLowerCase()===c.studentId.toLowerCase());
      if(!student)throw new DomainError("STUDENT_NOT_FOUND","No student account has this email. Ask them to sign up first.",404);
      return {...c,studentId:student.id};
    }
  } else if(actor.role!=="student" || !("studentId" in c) || c.studentId!==actor.id) return forbidden();
  return c;
}
function scopedSnapshot(s:DemoState,actor:Person):Snapshot {
  const v=structuredClone(s);const owned=new Set(v.properties.filter(p=>p.ownerId===actor.id).map(p=>p.id));
  if(actor.role==="owner") {
    v.properties=v.properties.filter(p=>owned.has(p.id));v.beds=v.beds.filter(b=>owned.has(b.propertyId));
    const beds=new Set(v.beds.map(b=>b.id));v.allocations=v.allocations.filter(a=>beds.has(a.bedId));v.queues=v.queues.filter(q=>beds.has(q.bedId));
  } else {
    v.properties=v.properties.map(p=>hasAccess(s,actor.id,p.id,Date.now()+s.clockOffset)?p:{...p,floors:undefined});
    v.allocations=v.allocations.map(a=>a.studentId===actor.id?a:{...a,studentId:"",reason:undefined,moveInDate:undefined,agreedPrice:undefined,offlineGuest:undefined});
    v.queues=v.queues.map(q=>q.studentId===actor.id?q:{...q,studentId:""});
  }
  const related=new Set([actor.id,...(actor.role==="owner" ? [...v.allocations,...v.queues].map(a=>a.studentId) : [])]);
  v.people=v.people.filter(p=>related.has(p.id)).map(p=>p.id===actor.id?p:{...p,email:undefined,phone:undefined,saved:[],credits:0,premiumUntil:undefined});
  v.access=v.access.filter(a=>a.studentId===actor.id);v.notices=v.notices.filter(n=>n.studentId===actor.id);v.ledger=v.ledger.filter(l=>l.studentId===actor.id);
  v.activity=actor.role==="owner"?v.activity.filter(a=>a.propertyId&&owned.has(a.propertyId)):[];v.requests={};
  return {...snapshot(v),currentUser:actor};
}
