import { describe, expect, it } from "vitest";
import { commandSchema, execute } from "../src/lib/engine";
import { createEmpty } from "../src/lib/empty";
import { floorsSchema, propertyFloors } from "../src/lib/property-structure";
const photo="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH5cAAAAASUVORK5CYII=";
const floors=[{number:1,images:[photo],rooms:[{number:"101",beds:2,images:[photo]},{number:"102",beds:1,images:[]}]},{number:2,images:[],rooms:[{number:"101",beds:3,images:[]}]}];
function create(){const s=createEmpty();execute(s,commandSchema.parse({type:"addProperty",name:"Multi-floor house",locality:"Test area",city:"Pune",address:"10 Test Street",category:"PG",price:9000,images:[photo],floors}),Date.now());return s;}
describe("property floor, room, bed and photo integrity",()=>{
  it("creates distinct beds on multiple floors even when room numbers repeat across floors",()=>{
    const s=create();expect(s.beds).toHaveLength(6);expect(new Set(s.beds.map(b=>b.id)).size).toBe(6);
    expect(s.beds.filter(b=>b.floor===1&&b.room==="101")).toHaveLength(2);expect(s.beds.filter(b=>b.floor===2&&b.room==="101")).toHaveLength(3);
    expect(propertyFloors(s.properties[0],s.beds)).toEqual(floors);expect(s.properties[0].image).toBe(photo);expect(s.properties[0].sharing).toEqual(["Twin","Single","Triple"]);
  });
  it("rejects duplicate floors and duplicate rooms within one floor",()=>{
    expect(floorsSchema.safeParse([floors[0],floors[0]]).success).toBe(false);
    expect(floorsSchema.safeParse([{...floors[0],rooms:[floors[0].rooms[0],floors[0].rooms[0]]}]).success).toBe(false);
    expect(floorsSchema.safeParse([{...floors[0],rooms:[{number:"101",beds:0,images:[]}]}]).success).toBe(false);
    expect(floorsSchema.safeParse([]).success).toBe(false);
  });
  it("appends floors without replacing existing bed identities or reservations",()=>{
    const s=create(),bed=s.beds[0],original=s.beds.map(b=>b.id);s.allocations.push({id:"hold",bedId:bed.id,studentId:"student",state:"held",source:"owner",durationHours:48,createdAt:0,expiresAt:Date.now()+100000,version:1});
    execute(s,commandSchema.parse({type:"appendFloors",propertyId:s.properties[0].id,floors:[{number:3,images:[],rooms:[{number:"301",beds:4,images:[]}]}]}),Date.now());
    expect(s.beds).toHaveLength(10);expect(s.beds.slice(0,6).map(b=>b.id)).toEqual(original);expect(s.allocations[0].bedId).toBe(bed.id);expect(s.allocations[0].state).toBe("held");
    expect(()=>execute(s,commandSchema.parse({type:"appendFloors",propertyId:s.properties[0].id,floors:[floors[0]]}),Date.now())).toThrow("floor already exists");
  });
  it("allows photo updates but rejects using the photo editor to alter inventory",()=>{
    const s=create(),p=s.properties[0],ids=s.beds.map(b=>b.id);execute(s,commandSchema.parse({type:"setPropertyPhotos",propertyId:p.id,images:[],floors}),Date.now());expect(p.image).toBe("/images/property-placeholder.svg");expect(s.beds.map(b=>b.id)).toEqual(ids);
    expect(()=>execute(s,commandSchema.parse({type:"setPropertyPhotos",propertyId:p.id,images:[photo],floors:[{...floors[0],rooms:[{number:"101",beds:12,images:[]}]}]}),Date.now())).toThrow("structure changed");
  });
  it("reconstructs older single-floor properties without changing bed identities",()=>{
    const s=create();delete s.properties[0].floors;expect(propertyFloors(s.properties[0],s.beds)[0].rooms).toEqual([{number:"101",beds:2,images:[]},{number:"102",beds:1,images:[]}]);
  });
  it("stores optional floor names and owner-defined bed slot names",()=>{
    const s=createEmpty();const configured=[{number:1,name:"First floor · East wing",images:[],rooms:[{number:"101",beds:2,bedLabels:["101-A","Window bed"],images:[]}]}];
    execute(s,commandSchema.parse({type:"addProperty",name:"Named slots",locality:"Test area",category:"PG",price:9000,floors:configured}),Date.now());
    expect(s.beds.map(b=>b.label)).toEqual(["101-A","Window bed"]);expect(propertyFloors(s.properties[0],s.beds)).toEqual(configured);
  });
  it("rejects empty, duplicate and inconsistent bed slot definitions",()=>{
    for(const bedLabels of [["101-A","101-a"],[" ","101-B"],["101-A"]]){
      expect(floorsSchema.safeParse([{number:1,rooms:[{number:"101",beds:2,bedLabels,images:[]}],images:[]}]).success).toBe(false);
    }
    expect(floorsSchema.safeParse([{number:1,rooms:[],images:[]}]).success).toBe(false);
  });
  it("adds rooms and individual slots inside saved floors without replacing reserved beds",()=>{
    const s=create(),p=s.properties[0],original=s.beds.map(b=>b.id);const held=s.beds[0];s.allocations.push({id:"protected",bedId:held.id,studentId:"student",state:"held",source:"owner",durationHours:48,createdAt:0,expiresAt:Date.now()+100000,version:1});
    execute(s,commandSchema.parse({type:"appendRooms",propertyId:p.id,floor:1,rooms:[{number:"103",beds:1,bedLabels:["103-A"],images:[]}]}),Date.now());
    execute(s,commandSchema.parse({type:"appendBedSlots",propertyId:p.id,floor:1,room:"101",labels:["101-C"]}),Date.now());
    expect(s.beds).toHaveLength(8);expect(s.beds.slice(0,6).map(b=>b.id)).toEqual(original);expect(s.allocations[0].bedId).toBe(held.id);expect(s.allocations[0].state).toBe("held");
    expect(propertyFloors(p,s.beds)[0].rooms.find(r=>r.number==="101")?.bedLabels).toEqual(["A","B","101-C"]);
    expect(propertyFloors(p,s.beds)[0].rooms.find(r=>r.number==="103")?.bedLabels).toEqual(["103-A"]);
  });
  it("rejects duplicate live rooms or bed slots before changing inventory",()=>{
    const s=create(),p=s.properties[0];
    expect(()=>execute(s,commandSchema.parse({type:"appendRooms",propertyId:p.id,floor:1,rooms:[{number:"101",beds:1,images:[]}]}),Date.now())).toThrow("already exists");
    expect(()=>execute(s,commandSchema.parse({type:"appendBedSlots",propertyId:p.id,floor:1,room:"101",labels:["a"]}),Date.now())).toThrow("already exists");
    expect(s.beds).toHaveLength(6);
    expect(()=>execute(s,commandSchema.parse({type:"appendRooms",propertyId:p.id,floor:7,rooms:[{number:"701",beds:1,images:[]}]}),Date.now())).toThrow("Floor not found");
  });
  it("does not let a photo update rename bed slots or floor labels",()=>{
    const s=create(),p=s.properties[0];const changed=floors.map(f=>({...f,rooms:f.rooms.map(r=>({...r,bedLabels:Array.from({length:r.beds},(_,i)=>`changed-${i}`)}))}));
    expect(()=>execute(s,commandSchema.parse({type:"setPropertyPhotos",propertyId:p.id,images:[],floors:changed}),Date.now())).toThrow("Bed slot names changed");
    expect(s.beds[0].label).toBe("A");
    execute(s,commandSchema.parse({type:"setPropertyPhotos",propertyId:p.id,images:[],floors:floors.map(f=>({...f,name:"tampered"}))}),Date.now());expect(p.floors?.[0].name).toBeUndefined();
  });
});
