"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { BedDouble, Check, Clock3, LockKeyhole, X, Wifi, Utensils, WashingMachine, Wind, BookOpen, Zap, ShowerHead, Droplets, Car, Cctv, ShieldCheck, Brush, ArrowUpDown, Dumbbell, Armchair, CircleCheck } from "lucide-react";
import type { Availability } from "@/lib/types";

export function Logo({small=false}:{small?:boolean}) {
  return <span className={`brand ${small?"brand-small":""}`}><span className="brand-mark"><svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="m5 18 13-12 13 12v12h-9V20h-8v10H5V18Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round"/><path d="M18 13c5 5 5 9 0 12-5-3-5-7 0-12Z" fill="currentColor" stroke="none"/></svg></span><span>Dwell <strong>Ember</strong><span className="brand-period">.</span></span></span>;
}
export function Status({value,compact=false}:{value:Availability|"offered"|"invited";compact?:boolean}) {
  const label=value==="vacant"?"Available":value==="booked"?"Booked":value==="unavailable"?"Unavailable":value==="offered"?"Your turn":value==="invited"?"Invitation":"Under review";
  const Icon=value==="vacant"?Check:value==="booked"?LockKeyhole:value==="unavailable"?X:Clock3;
  return <span className={`status status-${value} ${compact?"status-compact":""}`}><Icon size={12}/>{label}</span>;
}
export function Dialog({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null);
  const titleId=useRef(`dialog-${Math.random().toString(36).slice(2)}`);
  useEffect(()=>{const d=ref.current; d?.showModal(); const old=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=old;d?.close();};},[]);
  return <dialog ref={ref} className={`dialog ${wide?"dialog-wide":""}`} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}} aria-labelledby={titleId.current}>
    <div className="dialog-shell"><div className="dialog-title"><h2 id={titleId.current}>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>{children}</div>
  </dialog>;
}
export function Empty({title,description,children}:{title:string;description:string;children?:ReactNode}) {
  return <div className="empty"><div className="empty-icon"><BedDouble size={26}/></div><h2>{title}</h2><p>{description}</p>{children}</div>;
}
export function Avatar({initials,className=""}:{initials:string;className?:string}) {return <span className={`avatar ${className}`}>{initials}</span>;}
export function AmenityIcon({name,size=15}:{name:string;size?:number}) {
  const icons:Record<string,typeof Wifi>={"Wi-Fi":Wifi,"Meals":Utensils,"Laundry":WashingMachine,"AC":Wind,"Study room":BookOpen,"Power backup":Zap,"Hot water":ShowerHead,"Drinking water":Droplets,"Parking":Car,"CCTV":Cctv,"Security":ShieldCheck,"Housekeeping":Brush,"Lift":ArrowUpDown,"Gym":Dumbbell,"Common area":Armchair};
  const Icon=icons[name]??CircleCheck;
  return <Icon size={size} strokeWidth={1.6}/>;
}
export function currency(value:number) {return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(value);}
export function dateTime(value:number) {return new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit",timeZone:"Asia/Kolkata"}).format(value)+" IST";}
export function dateInput(value:number) {return new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Asia/Kolkata"}).format(value);}
export function remaining(value:number,now:number) {
  const total=Math.max(0,Math.floor((value-now)/60000));
  return `${Math.floor(total/60).toString().padStart(2,"0")}h ${(total%60).toString().padStart(2,"0")}m`;
}
export function relative(value:number,now:number) {
  const minutes=Math.max(0,Math.floor((now-value)/60000));
  return minutes<1?"Just now":minutes<60?`${minutes}m ago`:minutes<1440?`${Math.floor(minutes/60)}h ago`:`${Math.floor(minutes/1440)}d ago`;
}
