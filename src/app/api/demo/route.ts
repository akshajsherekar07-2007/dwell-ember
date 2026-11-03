import { requireUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { commandSchema, DomainError } from "@/lib/engine";
import { mutateDemo, readDemo } from "@/lib/repository";
import { assertLocalDemoRequest as guard } from "@/lib/demo-security";

export const runtime="nodejs";
export const dynamic="force-dynamic";
function errorResponse(error:unknown) {
  const domain=error instanceof DomainError;
  if(!domain) console.error("Demo request failed",error instanceof Error?error.message:"unknown");
  return NextResponse.json({error:{code:domain?error.code:"INTERNAL_ERROR",message:domain?error.message:"Something went wrong. Please try again."}},{status:domain?error.status:500,headers:{"Cache-Control":"no-store"}});
}
export async function GET(request:Request) {
  try {guard(request); return NextResponse.json(await readDemo(await requireUser(request)),{headers:{"Cache-Control":"no-store"}});} catch(error) {return errorResponse(error);}
}
export async function POST(request:Request) {
  try {
    guard(request);
    const raw=await request.text();
    if(Buffer.byteLength(raw)>18_000_000) throw new DomainError("BODY_TOO_LARGE","The photo upload is too large. Keep all photos under 16 MB combined.",413);
    const key=request.headers.get("idempotency-key");
    if(!key || key.length<8 || key.length>128) throw new DomainError("INVALID_KEY","A valid request key is required.",400);
    let body:unknown; try {body=JSON.parse(raw);} catch {throw new DomainError("INVALID_JSON","The request body is not valid JSON.",400);}
    const parsed=commandSchema.safeParse(body);
    if(!parsed.success) {const issue=parsed.error.issues[0];const field=String(issue?.path[0]??"Input").replace(/([A-Z])/g," $1");throw new DomainError("VALIDATION_FAILED",issue?`${field.charAt(0).toUpperCase()+field.slice(1)}: ${issue.message}`:"Check your inputs.",422);}
    return NextResponse.json(await mutateDemo(parsed.data,key,await requireUser(request)),{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return errorResponse(error);}
}
