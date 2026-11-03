import { NextResponse } from "next/server";
import { authenticate, logout } from "@/lib/auth";
import { assertLocalDemoRequest } from "@/lib/demo-security";
import { DomainError } from "@/lib/engine";
export const runtime="nodejs";
export async function POST(request:Request){try{
  assertLocalDemoRequest(request);const raw=await request.text();if(raw.length>10000)throw new DomainError("INVALID_INPUT","Request too large.",413);
  let input:unknown;try{input=JSON.parse(raw);}catch{throw new DomainError("INVALID_INPUT","Invalid request.",400);}
  const {user,token}=await authenticate(input);const response=NextResponse.json({user},{headers:{"Cache-Control":"no-store"}});
  response.cookies.set("dwell-session",token,{httpOnly:true,sameSite:"strict",secure:new URL(request.url).protocol==="https:",path:"/",maxAge:7*86400});return response;
}catch(e){return NextResponse.json({error:{message:e instanceof DomainError?e.message:"Could not sign in. Please try again."}},{status:e instanceof DomainError?e.status:500});}}
export async function DELETE(request:Request){try{assertLocalDemoRequest(request);await logout(request);const response=NextResponse.json({ok:true});response.cookies.set("dwell-session","",{httpOnly:true,sameSite:"strict",path:"/",maxAge:0});return response;}catch{return NextResponse.json({error:{message:"Could not sign out."}},{status:400});}}
