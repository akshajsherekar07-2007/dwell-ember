import { z } from "zod";
import type { Bed, Property } from "./types";
export const photoSchema=z.string().max(2_800_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/,"Choose a JPG, PNG or WebP photo.");
export const photosSchema=z.array(photoSchema).max(6,"Use up to 6 photos per property, floor or room.");
export const bedLabelsSchema=z.array(z.string().trim().min(1,"Name each bed slot.").max(30)).min(1).max(12).superRefine((labels,ctx)=>{if(new Set(labels.map(l=>l.toLowerCase())).size!==labels.length)ctx.addIssue({code:"custom",message:"Bed slot names must be unique within a room."});});
export const roomSchema=z.object({number:z.string().trim().min(1).max(20),beds:z.number().int().min(1).max(12),bedLabels:bedLabelsSchema.optional(),images:photosSchema.default([])}).superRefine((room,ctx)=>{if(room.bedLabels&&room.bedLabels.length!==room.beds)ctx.addIssue({code:"custom",path:["bedLabels"],message:"The bed count must match its bed slots."});});
export const floorsSchema=z.array(z.object({number:z.number().int().min(0).max(50),name:z.string().trim().max(80).optional(),images:photosSchema.default([]),rooms:z.array(roomSchema).min(1,"Add at least one room to each floor.").max(30)})).min(1,"Add your first floor to continue.").max(10).superRefine((floors,ctx)=>{
  const numbers=new Set<number>();for(const [i,f] of floors.entries()){if(numbers.has(f.number))ctx.addIssue({code:"custom",path:[i,"number"],message:"Each floor number must be unique."});numbers.add(f.number);const rooms=new Set<string>();for(const [j,r]of f.rooms.entries()){const key=r.number.toLowerCase();if(rooms.has(key))ctx.addIssue({code:"custom",path:[i,"rooms",j,"number"],message:"Room numbers must be unique within a floor."});rooms.add(key);}}
});
export type FloorPlan=z.infer<typeof floorsSchema>[number];
export const floorName=(number:number,name?:string)=>name?.trim()?`${number===0?"Ground floor":`Floor ${number}`} · ${name.trim()}`:number===0?"Ground floor":`Floor ${number}`;
export const roomLabels=(room:FloorPlan["rooms"][number])=>room.bedLabels??Array.from({length:room.beds},(_,i)=>String.fromCharCode(65+i));
export function propertyFloors(property:Property,beds:Bed[]):FloorPlan[]{
  const own=beds.filter(b=>b.propertyId===property.id);
  return [...new Set(own.map(b=>b.floor))].sort((a,b)=>a-b).map(number=>{const saved=property.floors?.find(f=>f.number===number);return {number,...(saved?.name?{name:saved.name}:{}),images:saved?.images??[],rooms:[...new Set(own.filter(b=>b.floor===number).map(b=>b.room))].map(room=>{const stored=saved?.rooms.find(r=>r.number===room);const slots=own.filter(b=>b.floor===number&&b.room===room);return {number:room,beds:slots.length,...(stored?.bedLabels?{bedLabels:slots.map(b=>b.label)}:{}),images:stored?.images??[]};})};});
}
export function photoBudget(images:string[],floors:FloorPlan[]){return [...images,...floors.flatMap(f=>[...f.images,...f.rooms.flatMap(r=>r.images)])].reduce((sum,p)=>sum+p.length,0)<=16_000_000;}
