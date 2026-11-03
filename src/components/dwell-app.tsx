"use client";

import { LandingPage } from "./landing";
import { AuthPage } from "./auth-page";
import { useState } from "react";

import Link from "next/link";

import { usePathname } from "next/navigation";

import { ArrowLeftRight, ArrowRight, Bell, Bookmark, Building2, Check, ChevronDown, CircleHelp, Compass, CreditCard, Heart, LayoutDashboard, Leaf, Menu, Settings, ShieldCheck, Sparkles, Users, X } from "lucide-react";

import { DemoProvider, useDwell } from "./context";

import { Avatar, dateTime, Dialog, Empty, Logo, relative } from "./ui";

import { Discover, MyStays, PropertyDialog } from "./student";

import { OwnerInventory, OwnerOverview } from "./owner";

import { Billing, SettingsPage } from "./account";



export function DwellApp(){const pathname=usePathname();if(pathname==="/")return <LandingPage/>;if(pathname==="/login"||pathname==="/signup")return <AuthPage key={pathname}/>;return <DemoProvider><Application/></DemoProvider>;}

function Application(){const pathname=usePathname();const ownerPath=pathname.startsWith("/owner");const{state,student,studentId,now,busy,run,propertyId,notify}=useDwell();const[notifications,setNotifications]=useState(false),[mobileNav,setMobileNav]=useState(false);

  const owner=student.role==="owner";

  if(ownerPath&&!owner)return <main className="student-main"><Empty title="Owner workspace" description="Sign in with an owner account to manage properties."><Link className="button primary" href="/discover">Back to discovery</Link></Empty></main>;

  const unread=state.notices.filter(n=>n.studentId===studentId&&!n.read).length;

  const studentLinks=[{href:"/discover",label:"Discover",icon:Compass},{href:"/saved",label:"Saved places",icon:Heart},{href:"/my-stays",label:"My stays",icon:Bookmark}];

  const ownerLinks=[{href:"/owner",label:"Overview",icon:LayoutDashboard},{href:"/owner/properties",label:"Properties",icon:Building2},{href:"/owner/requests",label:"Requests & queues",icon:Users}];

  function navLinks(){return (owner?ownerLinks:studentLinks).map(l=><Link key={l.href} href={l.href} className={pathname===l.href?"active":""} onClick={()=>setMobileNav(false)}><l.icon size={18}/>{l.label}{l.href==="/owner/requests"&&<span className="nav-counter">{state.queues.filter(q=>q.state==="waiting").length}</span>}</Link>);}

  return <div className={owner?"app-shell owner-shell":"app-shell student-shell"}>

    <a className="skip-link" href="#main-content">Skip to content</a>

    {owner&&<aside className="owner-sidebar"><Link href="/owner" className="brand-link"><Logo/></Link><div className="workspace-caption">OWNER WORKSPACE</div><nav className="owner-nav" aria-label="Owner navigation">{navLinks()}<div className="nav-divider"/><Link href="/billing"><CreditCard size={18}/>Plans & access</Link><Link href="/settings"><Settings size={18}/>Settings</Link></nav><div className="sidebar-story"><span className="sidebar-story-icon"><Leaf size={23}/></span><h3>Good spaces.<br/>New beginnings.</h3><p>A little clarity for the places people call home.</p><span className="sidebar-story-rule"/></div><Link className="sidebar-profile" href="/settings"><Avatar initials={student.initials}/><div><strong>{student.name}</strong><span>Property owner</span></div><ChevronDown size={14}/></Link></aside>}

    <div className="app-body"><header className={`topbar ${owner?"owner-topbar":""}`}>

      {!owner?<Link href="/" className="brand-link"><Logo/></Link>:<div className="topbar-breadcrumb">Workspace <span>/</span> <strong>{pathname==="/owner"?"Overview":pathname.endsWith("requests")?"Requests & queues":"Properties"}</strong></div>}

      {!owner&&<nav className="student-nav" aria-label="Student navigation">{studentLinks.map(l=><Link href={l.href} key={l.href} className={pathname===l.href?"active":""}>{l.label}</Link>)}</nav>}

      <div className="topbar-actions"><span className="topbar-divider"/><button className="icon-button notification-button" aria-label={`Notifications, ${unread} unread`} onClick={()=>setNotifications(true)}><Bell size={19}/>{unread>0&&<span/>}</button><details className="account-menu"><summary aria-label="Account menu"><Avatar initials={student.initials}/><ChevronDown size={13}/></summary><div className="account-dropdown"><strong>{student.name}</strong><span className="quiet-text">{student.role} account</span><Link href="/settings"><Settings size={15}/>My profile</Link><Link href="/billing"><Sparkles size={15}/>Plans & credits<span>{student.credits}</span></Link><button className="text-button" onClick={async()=>{await fetch("/api/auth",{method:"DELETE"});window.location.assign("/login");}}>Sign out</button></div></details><button className="icon-button mobile-menu-button" aria-label="Open navigation" onClick={()=>setMobileNav(!mobileNav)}>{mobileNav?<X size={20}/>:<Menu size={20}/>}</button></div>

    </header>

    {mobileNav&&<nav className="mobile-menu" aria-label="Mobile navigation">{navLinks()}<Link href="/billing" onClick={()=>setMobileNav(false)}><CreditCard size={18}/>Plans & access</Link><Link href="/settings" onClick={()=>setMobileNav(false)}><Settings size={18}/>Settings</Link></nav>}

    <div id="main-content" className="main-content">{pathname==="/discover"?(owner?<OwnerOverview/>:<Discover/>):pathname==="/saved"?<Discover savedOnly/>:pathname==="/my-stays"?<MyStays/>:pathname==="/owner"?<OwnerOverview/>:pathname==="/owner/properties"?<OwnerInventory/>:pathname==="/owner/requests"?<OwnerInventory requests/>:pathname==="/billing"?<Billing/>:pathname==="/settings"?<SettingsPage/>:pathname==="/login"||pathname==="/signup"?(owner?<OwnerOverview/>:<Discover/>):<main className="student-main"><Empty title="A little off the path" description="The page you’re looking for isn’t here."><Link className="button primary" href="/discover">Back to discovery<ArrowRight size={16}/></Link></Empty></main>}</div>

    <footer className="app-footer"><Link href="/" className="footer-brand"><Logo small/></Link><span>A place for your next chapter.</span><Link href="/settings" className="demo-footer"><span/>Interactive local demo<span className="footer-sample"> · Sample data</span></Link></footer>

    {!owner&&<nav className="mobile-bottom-nav" aria-label="Mobile primary navigation">{studentLinks.map(l=><Link href={l.href} key={l.href} className={pathname===l.href?"active":""}><l.icon size={20}/><span>{l.label==="Saved places"?"Saved":l.label}</span></Link>)}<Link href="/settings" className={pathname==="/settings"?"active":""}><Settings size={20}/><span>Account</span></Link></nav>}

    </div>

    {propertyId&&<PropertyDialog key={propertyId}/>}

    {notifications&&<Dialog title="A little update for you" onClose={()=>setNotifications(false)}><div className="notification-content"><div className="notification-toolbar"><span>{unread} unread</span><button className="text-button" disabled={busy||!unread} onClick={()=>void run({type:"readNotices",studentId})}>Mark all read<Check size={14}/></button></div>{state.notices.filter(n=>n.studentId===studentId).map(n=><article className={`notification-item ${!n.read?"unread":""}`} key={n.id}><span className="notification-icon"><Bell size={17}/></span><div><strong>{n.title}</strong><p>{n.message}</p><span>{relative(n.createdAt,now)}</span></div></article>)}{!state.notices.some(n=>n.studentId===studentId)&&<Empty title="All quiet, for now" description="Your invitations, offers, and stay updates will appear here."/>}<p className="notification-note"><ShieldCheck size={14}/>Your in-app inbox. External email delivery is not connected.</p></div></Dialog>}

  </div>;

}

