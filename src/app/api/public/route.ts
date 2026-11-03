import { NextResponse } from "next/server";
import { readPublicListings } from "@/lib/repository";
import { assertLocalDemoRequest } from "@/lib/demo-security";
import { DomainError } from "@/lib/engine";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{assertLocalDemoRequest(request);return NextResponse.json({properties:await readPublicListings()},{headers:{"Cache-Control":"no-store"}});}catch(e){return NextResponse.json({error:{message:e instanceof DomainError?e.message:"Listings could not be loaded."}},{status:e instanceof DomainError?e.status:500});}}
