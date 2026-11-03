"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Building2, GraduationCap, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { destinationAfterLogin } from "@/lib/auth-navigation";
import { Logo } from "./ui";
export function AuthPage(){
  const [signup,setSignup]=useState(false),[role,setRole]=useState<"student"|"owner">("student"),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [intent,setIntent]=useState(""),[next,setNext]=useState<string|null>(null);
  useEffect(()=>{const params=new URLSearchParams(window.location.search);setSignup(window.location.pathname==="/signup");setRole(params.get("role")==="owner"?"owner":"student");setIntent(params.get("intent")||"");setNext(params.get("next"));},[]);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");const form=new FormData(e.currentTarget);
    try{const response=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:signup?"signup":"login",role,name:form.get("name"),email:form.get("email"),phone:form.get("phone"),password:form.get("password")})});const data=await response.json();if(!response.ok)throw new Error(data.error?.message||"Could not sign in.");window.location.assign(destinationAfterLogin(data.user.role,next));}
    catch(e){setError(e instanceof Error?e.message:"Could not connect. Try again.");setBusy(false);}
  }
  return <main className="auth-page"><section className="auth-story"><Link href="/" aria-label="Back to Dwell Ember home"><Logo/></Link><div><span className="section-eyebrow">GOOD SPACES. NEW BEGINNINGS.</span><h1>A place to stay.<br/><em>Room to decide.</em></h1><p>Find a place that feels right, or open your doors to someone’s next chapter.</p><div className="auth-promise"><ShieldCheck size={22}/><span>Protected decision windows.<br/>A fair place in every queue.</span></div></div><span>Dwell Ember · Your next chapter starts here.</span></section><section className="auth-form-panel"><div className="auth-form-wrap"><Link className="auth-back" href="/">← Back to homepage</Link>{intent&&<div className="auth-intent"><ShieldCheck size={18}/><p>{intent==="list"?"Log in or sign up as an owner to list your property.":intent==="property"?"Log in or sign up to take a closer look at this property.":intent==="book"?"Log in or sign up to view this place and manage your booking journey.":"Log in or sign up to continue your housing journey."}</p></div>}<div className="section-eyebrow">WELCOME TO DWELL EMBER</div><h2>{signup?"Make yourself at home.":"Good to see you."}</h2><p>{signup?"Create your account to get started.":"Log in to your student or owner account."}</p><div className="segmented auth-tabs"><button type="button" className={!signup?"selected":""} onClick={()=>{setSignup(false);setError("");}}>Log in</button><button type="button" className={signup?"selected":""} onClick={()=>{setSignup(true);setError("");}}>Sign up</button></div>
    <form className="form" onSubmit={submit}>
      {signup&&<><fieldset className="auth-role"><legend>I’m joining as a</legend><button type="button" aria-pressed={role==="student"} className={role==="student"?"selected":""} onClick={()=>setRole("student")}><GraduationCap size={24}/><strong>Student</strong><span>Find your next place</span></button><button type="button" aria-pressed={role==="owner"} className={role==="owner"?"selected":""} onClick={()=>setRole("owner")}><Building2 size={24}/><strong>Owner</strong><span>List & manage spaces</span></button></fieldset><label>Full name<input name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder="Your full name"/></label></>}
      <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com"/></label>
      {signup&&<label>Phone number<input name="phone" type="tel" autoComplete="tel" required minLength={10} maxLength={20} placeholder="+91 98765 43210"/></label>}
      <label>Password<input name="password" type="password" autoComplete={signup?"new-password":"current-password"} required minLength={signup?10:1} maxLength={128} placeholder={signup?"At least 10 characters":"Enter your password"}/></label>
      {error&&<div className="auth-error" role="alert">{error}</div>}
      <button className="button primary full" disabled={busy}>{busy?"Just a moment…":signup?`Create ${role} account`:"Log in"}<ArrowRight size={17}/></button>
      <p className="setting-help">{signup?"Use a different email for each account if you’d like to test both roles. Your account role is fixed at signup.":"Testing both roles? Sign out from the account menu to switch accounts."}</p>
    </form><p className="auth-local-note">Local prototype · Accounts and listings are saved on this computer. Email and phone verification are not connected yet.</p></div></section></main>;
}
