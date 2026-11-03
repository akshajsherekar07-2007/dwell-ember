"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { CircleAlert, LoaderCircle, X } from "lucide-react";

import type { Command } from "@/lib/engine";

import type { Person, Snapshot } from "@/lib/types";

import { usePathname, useRouter } from "next/navigation";
import { loginLink } from "@/lib/auth-navigation";

import { Logo } from "./ui";



type Context={state:Snapshot;student:Person;studentId:string;setStudentId:(id:string)=>void;now:number;busy:boolean;run:(command:Command)=>Promise<boolean>;refresh:()=>Promise<void>;openProperty:(id:string)=>void;closeProperty:()=>void;propertyId:string|null;notify:(message:string)=>void};

const DwellContext=createContext<Context|null>(null);

export function useDwell(){const value=useContext(DwellContext);if(!value)throw new Error("Dwell provider missing");return value;}

export function DemoProvider({children}:{children:ReactNode}) {

  const pathname=usePathname(),router=useRouter();
  const [state,setState]=useState<Snapshot|null>(null),[studentId,setStudentId]=useState(""),[now,setNow]=useState(Date.now());

  const [unauthenticated,setUnauthenticated]=useState(false);

  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[toast,setToast]=useState("");

  const [propertyId,setPropertyId]=useState<string|null>(null);

  const offset=useRef(0), inFlight=useRef(false), toastRef=useRef<HTMLDivElement>(null);

  const apply=useCallback((next:Snapshot)=>{offset.current=next.serverTime-Date.now();setNow(next.serverTime);setState(next);setStudentId(next.currentUser!.id);setUnauthenticated(false);setError("");},[]);

  const refresh=useCallback(async()=>{

    try {const response=await fetch("/api/demo",{cache:"no-store"});const body=await response.json();if(response.status===401){setState(null);setUnauthenticated(true);return;}if(!response.ok)throw new Error(body.error?.message||"Could not load the workspace.");apply(body);}

    catch(e){setError(e instanceof Error?e.message:"Could not connect. Please try again.");}

  },[apply]);

  useEffect(()=>{void refresh();const interval=setInterval(()=>{if(!inFlight.current)void refresh();},30000);return()=>clearInterval(interval);},[refresh]);

  useEffect(()=>{const interval=setInterval(()=>setNow(Date.now()+offset.current),1000);return()=>clearInterval(interval);},[]);

  useEffect(()=>{if(!toast)return;toastRef.current?.showPopover?.();const timeout=setTimeout(()=>setToast(""),5500);return()=>clearTimeout(timeout);},[toast]);

  const run=useCallback(async(command:Command)=>{

    if(inFlight.current)return false;

    inFlight.current=true;setBusy(true);

    try {

      const response=await fetch("/api/demo",{method:"POST",headers:{"content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify(command)});

      const body=await response.json();

      if(!response.ok)throw new Error(body.error?.message||"This action could not be completed.");

      apply(body.state);setToast(body.message);return true;

    } catch(e){setToast(e instanceof Error?e.message:"Something went wrong.");await refresh();return false;}

    finally {inFlight.current=false;setBusy(false);}

  },[apply,refresh]);

  function selectStudent(){/* Identity comes exclusively from the server session. */}

  useEffect(()=>{if(unauthenticated)router.replace(loginLink(pathname+window.location.search,pathname.startsWith("/owner")?"list":"continue",false,pathname.startsWith("/owner")));},[unauthenticated,pathname,router]);
  useEffect(()=>{if(state){const selected=new URLSearchParams(window.location.search).get("property");if(selected&&state.properties.some(p=>p.id===selected))setPropertyId(selected);}},[!!state]);
  if(unauthenticated)return <div className="boot"><Logo/><p>Please log in or sign up to continue…</p></div>;

  if(!state)return <div className="boot"><Logo/><div className="boot-content">{error?<><CircleAlert/><h1>Let’s get you connected.</h1><p>{error}</p><button className="button primary" onClick={()=>void refresh()}>Try again</button></>:<><LoaderCircle className="spin"/><p>Finding your next chapter…</p></>}</div></div>;

  const student=state.people.find(p=>p.id===studentId)??state.people[0];

  return <DwellContext.Provider value={{state,student,studentId:student.id,setStudentId:selectStudent,now,busy,run,refresh,openProperty:setPropertyId,closeProperty:()=>setPropertyId(null),propertyId,notify:setToast}}>

    {error&&<div className="connection-error" role="alert"><CircleAlert size={16}/>{error}<button onClick={()=>void refresh()}>Reconnect</button></div>}

    {children}

    {toast&&<div ref={toastRef} popover="manual" className="toast" role="status"><span className="toast-dot"/>{toast}<button className="icon-button" aria-label="Dismiss notification" onClick={()=>setToast("")}><X size={16}/></button></div>}

  </DwellContext.Provider>;

}

