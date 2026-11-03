import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { writeJsonAtomically } from "./atomic-json";
import path from "node:path";
import { z } from "zod";
import { directory, registerPerson } from "./repository";
import { DomainError } from "./engine";
import type { Person } from "./types";
const scrypt=promisify(scryptCallback);
type Account={person:Person;salt:string;hash:string};
type AuthData={accounts:Account[];sessions:{hash:string;userId:string;expires:number}[]};
const file=path.join(directory,"accounts.json");
const globals=globalThis as typeof globalThis & {authQueue?:Promise<void>;loginAttempts?:Map<string,{count:number;until:number}>};
async function transaction<T>(fn:(data:AuthData)=>Promise<T>):Promise<T>{
  const prior=globals.authQueue??Promise.resolve();let release!:()=>void;globals.authQueue=new Promise(r=>{release=r;});await prior.catch(()=>undefined);
  try{let data:AuthData;try{data=JSON.parse(await readFile(file,"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;data={accounts:[],sessions:[]};}
    data.sessions=data.sessions.filter(s=>s.expires>Date.now());const result=await fn(data);await writeJsonAtomically(file,data);return result;
  }finally{release();}
}
const email=z.string().trim().email().max(254).transform(v=>v.toLowerCase());
const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("signup"),name:z.string().trim().min(2).max(100),email,phone:z.string().trim().regex(/^\+?[\d ()-]{10,20}$/,"Enter a valid phone number.").refine(v=>v.replace(/\D/g,"").length>=10,"Enter at least 10 digits."),password:z.string().min(10).max(128),role:z.enum(["owner","student"])}),
  z.object({action:z.literal("login"),email,password:z.string().min(1).max(128)})
]);
const digest=(token:string)=>createHash("sha256").update(token).digest("hex");
export async function authenticate(body:unknown){
  const parsed=schema.safeParse(body);if(!parsed.success)throw new DomainError("INVALID_INPUT",parsed.error.issues[0]?.message||"Check your details.",422);
  const c=parsed.data;const attempts=globals.loginAttempts??=new Map();const attempt=attempts.get(c.email);
  if(attempt&&attempt.until>Date.now()&&attempt.count>=10)throw new DomainError("RATE_LIMIT","Too many attempts. Try again in 15 minutes.",429);
  attempts.set(c.email,{count:attempt&&attempt.until>Date.now()?attempt.count+1:1,until:attempt&&attempt.until>Date.now()?attempt.until:Date.now()+900000});
  return transaction(async data=>{
    let account=data.accounts.find(a=>a.person.email===c.email);
    if(c.action==="signup"){
      if(account)throw new DomainError("EMAIL_EXISTS","This email already has an account. Log in or use a different email for your second account.",409);
      const salt=randomBytes(16).toString("hex");const hash=(await scrypt(c.password,salt,64) as Buffer).toString("hex");
      const person:Person={id:randomUUID(),name:c.name,email:c.email,phone:c.phone,role:c.role,initials:c.name.split(/\s+/).map(n=>n[0]).slice(0,2).join("").toUpperCase(),credits:0,saved:[]};
      account={person,salt,hash};await registerPerson(person);data.accounts.push(account);
    }else{
      const computed=await scrypt(c.password,account?.salt??"missing-account-salt",64) as Buffer;
      if(!account||!timingSafeEqual(computed,Buffer.from(account.hash,"hex")))throw new DomainError("INVALID_CREDENTIALS","Email or password is incorrect.",401);
    }
    attempts.delete(c.email);const token=randomBytes(32).toString("hex");data.sessions.push({hash:digest(token),userId:account.person.id,expires:Date.now()+7*86400000});
    return {user:account.person,token};
  });
}
export function sessionToken(request:Request){return request.headers.get("cookie")?.split(";").map(c=>c.trim()).find(c=>c.startsWith("dwell-session="))?.slice("dwell-session=".length);}
export async function requireUser(request:Request){const token=sessionToken(request);if(!token)throw new DomainError("UNAUTHENTICATED","Please log in to continue.",401);
  return transaction(async data=>{const session=data.sessions.find(s=>s.hash===digest(token));const account=data.accounts.find(a=>a.person.id===session?.userId);if(!account)throw new DomainError("UNAUTHENTICATED","Your session ended. Please log in again.",401);return account.person;});
}
export async function logout(request:Request){const token=sessionToken(request);if(token)await transaction(async d=>{d.sessions=d.sessions.filter(s=>s.hash!==digest(token));});}
