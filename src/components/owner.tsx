"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import Link from "next/link";

import { ArrowRight, ArrowUpRight, BedDouble, Building2, Check, CheckCircle2, ChevronDown, Clock3, FileImage, LayoutGrid, List, LockKeyhole, MapPin, Plus, ShieldCheck, Upload, Users, X } from "lucide-react";

import { activeAllocation, availability, PENDING, type Allocation, type Bed } from "@/lib/types";

import { useDwell } from "./context";

import { FloorEditor, PhotoUpload, PhotoGallery, newFloor, newRoom, RoomEditor, BedSlotEditor } from "./property-editor";
import { OwnerBedStatusControls } from "./owner-bed-status";
import { InventoryStatus } from "./inventory-status";
import { floorName, propertyFloors, photoBudget, floorsSchema, roomSchema, bedLabelsSchema, type FloorPlan } from "@/lib/property-structure";
import { LocationPicker } from "./location-map";
import type { Coordinates } from "@/lib/location";
import type { Property } from "@/lib/types";
import { AMENITIES } from "@/lib/amenities";
import { AmenityIcon, Avatar, currency, dateInput, dateTime, Dialog, Empty, remaining, relative, Status } from "./ui";



type Action={kind:"invite"|"book"|"cancel"|"block"|"checkout";bed:Bed;allocation?:Allocation};

export function OwnerInventory({requests=false}:{requests?:boolean}) {

  const {state,now,busy,run}=useDwell();
  const bedPanel=useRef<HTMLElement>(null);
  const [managementRequest,setManagementRequest]=useState(0);
  useEffect(()=>{if(!managementRequest)return;const panel=bedPanel.current;if(!panel)return;panel.focus({preventScroll:true});panel.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"start"});},[managementRequest]);
  function manageBed(id:string){setBedId(id);setManagementRequest(request=>request+1);}

  const [capacity,setCapacity]=useState<{room?:string}|null>(null);
  const [editingLocation,setEditingLocation]=useState(false),[editingPhotos,setEditingPhotos]=useState(false),[addingFloors,setAddingFloors]=useState(false),[floorNumber,setFloorNumber]=useState(1);

  const [propertyId,setPropertyId]=useState(""),[bedId,setBedId]=useState(""),[view,setView]=useState("layout"),[action,setAction]=useState<Action|null>(null),[adding,setAdding]=useState(false);

  useEffect(()=>{const selected=new URLSearchParams(window.location.search).get("property");if(selected&&state.properties.some(p=>p.id===selected)){setPropertyId(selected);setBedId(state.beds.find(b=>b.propertyId===selected)?.id??"");}},[]);

  const property=state.properties.find(p=>p.id===propertyId)??state.properties[0];

  const beds=state.beds.filter(b=>b.propertyId===property?.id);
  const activeFloorNumber=beds.some(b=>b.floor===floorNumber)?floorNumber:beds[0]?.floor;
  const selected=beds.find(b=>b.id===bedId&&b.floor===activeFloorNumber)??beds.find(b=>b.floor===activeFloorNumber);

  const floors=property?propertyFloors(property,state.beds):[];
  const currentFloor=floors.find(f=>f.number===floorNumber)??floors[0];
  const floorBeds=beds.filter(b=>b.floor===currentFloor?.number);
  const allocation=selected?activeAllocation(state,selected.id):undefined;

  const holder=state.people.find(p=>p.id===allocation?.studentId);

  const queues=state.queues.filter(q=>q.bedId===selected?.id&&["waiting","offered"].includes(q.state)).sort((a,b)=>a.sequence-b.sequence);

  function selectProperty(id:string){setPropertyId(id);const first=state.beds.find(b=>b.propertyId===id);setBedId(first?.id??"");setFloorNumber(first?.floor??1);}

  const counts={vacant:0,under_review:0,booked:0,unavailable:0};beds.forEach(b=>counts[availability(state,b)]++);

  if(!property)return <div className="owner-page"><Empty title="Your first property starts here" description="Add your property, rooms and beds. Your listing will then appear in student discovery."><button className="button primary" onClick={()=>setAdding(true)}><Plus size={17}/>Add property</button></Empty>{adding&&<AddProperty onClose={()=>setAdding(false)}/>}</div>;

  return <div className="owner-page"><div className="owner-page-heading"><div><div className="section-eyebrow"><span className="ember-dot"/>{requests?"EVERYONE GETS A FAIR TURN":"A LITTLE CLARITY. A LOT LESS CHAOS."}</div><h1>{requests?<>Interest, in <em>order.</em></>:<>Your spaces.<em> In good hands.</em></>}</h1><p>{requests?"A clear view of who’s waiting, what’s held, and who’s next.":"Every bed, every decision window, and every next chapter. All together."}</p></div><button className="button primary" onClick={()=>setAdding(true)}><Plus size={17}/>Add property</button></div>

    <div className="owner-property-switch"><span className="owner-property-icon"><Building2 size={23}/></span><div><span className="section-eyebrow">YOUR PROPERTY</span><select aria-label="Select managed property" value={property.id} onChange={e=>selectProperty(e.target.value)}>{state.properties.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select><p><MapPin size={12}/>{property.locality}, {property.city}</p></div><span className="property-live"><span/>Published listing</span><span className="owner-property-meta">{beds.length} beds <span>·</span> {floors.length} floors</span></div>

    <div className="owner-location-summary"><MapPin size={18}/><div><strong>{property.location?"Property pin saved":"Add your property’s exact location"}</strong><span>{property.location?"Students can see this pin and get directions.":"Help students find your entrance using a confirmed map pin."}</span></div><button className="button secondary small" onClick={()=>setEditingLocation(true)}>{property.location?"Edit map pin":"Add map pin"}<MapPin size={14}/></button></div>
    <div className="owner-structure-actions"><button className="button secondary small" onClick={()=>setAddingFloors(true)} disabled={floors.length>=10}><Plus size={15}/>Add floor</button><button className="button secondary small" onClick={()=>setEditingPhotos(true)}><FileImage size={15}/>Manage property photos</button></div>
    <div className="stats-grid"><div className="stat-card"><span className="stat-icon neutral"><BedDouble size={19}/></span><div><span>Total beds</span><strong>{beds.length.toString().padStart(2,"0")}</strong></div><span className="stat-small">Across your property</span></div><div className="stat-card"><span className="stat-icon green"><Check size={19}/></span><div><span>Available</span><strong>{counts.vacant.toString().padStart(2,"0")}</strong></div><span className="stat-small">Ready for a new chapter</span></div><div className="stat-card"><span className="stat-icon amber"><Clock3 size={19}/></span><div><span>Under review</span><strong>{counts.under_review.toString().padStart(2,"0")}</strong></div><span className="stat-small">Time to decide, protected</span></div><div className="stat-card"><span className="stat-icon rose"><LockKeyhole size={18}/></span><div><span>Booked</span><strong>{counts.booked.toString().padStart(2,"0")}</strong></div><span className="stat-small">A place, made theirs</span></div></div>

    {counts.unavailable>0&&<div className="info-line"><ShieldCheck size={15}/>{counts.unavailable} bed{counts.unavailable>1?"s are":" is"} operationally unavailable. Resolve the block to return it to allocation.</div>}

    <div className="inventory-grid"><section className="inventory-panel"><div className="inventory-header"><div><h2>{requests?"Requests & waitlists":"A view of every bed"}</h2><p>{requests?"Select a bed to manage its queue.":"A simple floor plan. A clear picture."}</p></div><div className="segmented"><button aria-label="Floor layout view" aria-pressed={view==="layout"} className={view==="layout"?"selected":""} onClick={()=>setView("layout")}><LayoutGrid size={16}/><span>Layout</span></button><button aria-label="Bed list view" aria-pressed={view==="list"} className={view==="list"?"selected":""} onClick={()=>setView("list")}><List size={16}/><span>List</span></button></div></div><div className="floor-overview-cards">{floors.map(f=><button type="button" key={f.number} className={`floor-overview-card ${currentFloor?.number===f.number?"selected":""}`} aria-pressed={currentFloor?.number===f.number} onClick={()=>{setFloorNumber(f.number);setBedId(beds.find(b=>b.floor===f.number)?.id??"");}}><strong>{floorName(f.number,f.name)}</strong><small>{f.rooms.length} rooms · {beds.filter(b=>b.floor===f.number).length} beds</small><InventoryStatus state={state} beds={beds.filter(b=>b.floor===f.number)}/></button>)}</div>{currentFloor&&<div className="current-floor-heading"><div><h3>{floorName(currentFloor.number,currentFloor.name)}</h3><span>Choose a room, then select a bed to manage its status.</span></div><button className="button secondary small" disabled={currentFloor.rooms.length>=30} onClick={()=>setCapacity({})}><Plus size={14}/>Add room</button></div>}{currentFloor&&<PhotoGallery images={currentFloor.images} title={floorName(currentFloor.number,currentFloor.name)}/>}

    {requests?<div className="request-list">{floorBeds.filter(b=>state.queues.some(q=>q.bedId===b.id&&["waiting","offered"].includes(q.state))).map(b=>{const entries=state.queues.filter(q=>q.bedId===b.id&&["waiting","offered"].includes(q.state));return <button key={b.id} className={`request-bed ${selected?.id===b.id?"selected":""}`} onClick={()=>manageBed(b.id)}><span className="stat-icon amber"><Users size={20}/></span><span><strong>Room {b.room} · Bed {b.label}</strong><small>{entries.length} student{entries.length===1?"":"s"} in line</small></span><Status value={availability(state,b)} compact/><ArrowRight size={17}/></button>;})}{!floorBeds.some(b=>state.queues.some(q=>q.bedId===b.id&&["waiting","offered"].includes(q.state)))&&<Empty title="A little breathing room" description="New waitlist requests will appear here, in the order students join."/>}</div>:view==="layout"?<div className="floor-plan"><div className="room-grid">{[...new Set(floorBeds.map(b=>b.room))].map(room=><div className="room" key={room}><div className="room-label"><strong>Room {room}</strong><span>{floorBeds.filter(b=>b.room===room).length} beds</span></div><InventoryStatus state={state} beds={floorBeds.filter(b=>b.room===room)}/><PhotoGallery images={currentFloor?.rooms.find(r=>r.number===room)?.images??[]} title={`Room ${room}`}/><div className="bed-grid">{floorBeds.filter(b=>b.room===room).map(b=>{const a=activeAllocation(state,b.id),status=availability(state,b);return <button aria-label={`Room ${b.room} Bed ${b.label}, ${status.replace("_"," ")}`} aria-pressed={selected?.id===b.id} className={`bed-tile bed-${status} ${selected?.id===b.id?"selected":""}`} key={b.id} onClick={()=>manageBed(b.id)}><BedDouble size={25} strokeWidth={1.4}/><strong>{b.label}</strong><Status value={status} compact/>{a?.expiresAt&&<small>{remaining(a.expiresAt,now)} left</small>}{!a&&<small>{status==="vacant"?"Ready for a hold":"Operational block"}</small>}</button>;})}</div><button type="button" className="text-button add-live-bed" disabled={floorBeds.filter(b=>b.room===room).length>=12} onClick={()=>setCapacity({room})}><Plus size={13}/>Add bed slot</button><div className="room-door"/></div>)}</div><div className="corridor"><span/>Shared corridor<span/></div></div>:<div className="inventory-table-wrapper"><table className="inventory-table"><thead><tr><th>Room / bed</th><th>Status</th><th>Decision window</th><th/></tr></thead><tbody>{floorBeds.map(b=>{const a=activeAllocation(state,b.id);return <tr key={b.id} className={selected?.id===b.id?"selected":""}><td>Room {b.room} · {b.label}</td><td><Status value={availability(state,b)} compact/></td><td>{a?.expiresAt?remaining(a.expiresAt,now):"—"}</td><td><button type="button" className="text-button" aria-controls="bed-management-panel" aria-label={`Manage room ${b.room} bed ${b.label}`} onClick={()=>manageBed(b.id)}>Manage<ArrowUpRight size={13}/></button></td></tr>;})}</tbody></table></div>}

      <div className="floor-legend"><span><i className="legend-green"/>Available</span><span><i className="legend-amber"/>Under review</span><span><i className="legend-rose"/>Booked</span><span><i className="legend-grey"/>Unavailable</span></div>

    </section><aside ref={bedPanel} id="bed-management-panel" className="bed-drawer" tabIndex={-1} aria-label={selected?`Manage room ${selected.room} bed ${selected.label}`:"Bed management"}>{selected&&<><div className="bed-drawer-heading"><span className="section-eyebrow">BED DETAILS</span><p className="quiet-text">{floorName(selected.floor,floors.find(f=>f.number===selected.floor)?.name)}</p><h2>Room {selected.room}<span> · </span>Bed {selected.label}</h2><Status value={allocation?.state==="offered"?"offered":availability(state,selected)}/></div>

    <OwnerBedStatusControls bed={selected}/>
    {allocation?<><div className="holder"><Avatar initials={holder?.initials??"OF"}/><div><span>{allocation.state==="offered"?"Exclusive offer for":"Student"}</span><strong>{holder?.name||allocation.offlineGuest?.name||"Offline reservation"}</strong></div></div>{allocation.expiresAt?<div className="owner-countdown"><span>{allocation.state==="held"?"Decision window":allocation.state==="offered"?"Offer acceptance window":"Invitation acceptance window"}</span><strong>{remaining(allocation.expiresAt,now)}<small> remaining</small></strong><p>Until {dateTime(allocation.expiresAt)}</p></div>:<div className="booked-info"><ShieldCheck size={23}/><strong>Booking confirmed</strong><p>Move-in {allocation.moveInDate??"arranged with student"}</p></div>}

      {allocation.state==="held"&&<button className="button primary full" onClick={()=>setAction({kind:"book",bed:selected,allocation})}>Confirm booking<CheckCircle2 size={16}/></button>}

      {allocation.state==="booked"&&<button className="button secondary full" onClick={()=>setAction({kind:"checkout",bed:selected,allocation})}>Record checkout<ArrowUpRight size={15}/></button>}

      {PENDING.includes(allocation.state)&&<p className="drawer-protection"><ShieldCheck size={14}/>Hold deadlines and status changes are recorded.</p>}

    </>:<div className="vacant-info"><span className={`empty-icon ${selected.enabled?"":"blocked"}`}><BedDouble size={28}/></span><h3>{selected.enabled?"A place for someone new.":"This bed is unavailable."}</h3><p>{selected.enabled?"Record an offline hold or booking above, or invite a registered student after a visit.":selected.blockedReason}</p>{selected.enabled?<button className="button primary full" onClick={()=>setAction({kind:"invite",bed:selected})}><Plus size={16}/>Invite student</button>:<button className="button secondary full" disabled={busy} onClick={()=>void run({type:"resolveBlock",bedId:selected.id,expectedVersion:selected.version})}>Resolve operational block</button>}</div>}

    <div className="owner-queue"><div className="section-heading compact"><h3>Next in line<span className="count-pill">{queues.length}</span></h3><Users size={16}/></div><p className="queue-helper">An exclusive offer goes to the next eligible student when the hold ends.</p>{queues.map((q,i)=>{const p=state.people.find(p=>p.id===q.studentId)!;const other=state.allocations.some(a=>a.studentId===p.id&&PENDING.includes(a.state)&&a.bedId!==selected.id);return <div className="owner-queue-row" key={q.id}><span className="queue-number">{i+1}</span><Avatar initials={p.initials}/><div><strong>{p.name}</strong><span>{q.state==="offered"?"Exclusive offer active":other?"Temporarily ineligible":`Joined ${relative(q.createdAt,now)}`}</span></div></div>;})}{!queues.length&&<div className="small-empty">No students waiting for this bed.</div>}</div>

    <div className="bed-actions-bottom">{allocation&&PENDING.includes(allocation.state)?<button className="text-button danger-text" onClick={()=>setAction({kind:"cancel",bed:selected,allocation})}>Exceptional cancellation</button>:!allocation&&selected.enabled?<button className="text-button" onClick={()=>setAction({kind:"block",bed:selected})}>Mark operationally unavailable</button>:null}<span>Changes are recorded in the activity log.</span></div>

    </>}</aside></div>

    <section className="activity-panel"><div className="section-heading"><div><h2>Small updates. Clear picture.</h2><p>Recent activity across your properties.</p></div><span className="live-label"><span/>Property activity</span></div>{state.activity.slice(0,5).map(a=><div className="activity-row" key={a.id}><span className="activity-icon"><Clock3 size={16}/></span><div><strong>{a.action}</strong><p>{a.detail}</p></div><span>{relative(a.createdAt,now)}</span></div>)}</section>

    {capacity&&currentFloor&&<AddCapacity property={property} floor={currentFloor} roomName={capacity.room} onClose={()=>setCapacity(null)}/>}
    {editingPhotos&&<EditPhotos property={property} onClose={()=>setEditingPhotos(false)}/>}
    {addingFloors&&<AddFloors property={property} onClose={()=>setAddingFloors(false)}/>}
    {editingLocation&&<EditLocation property={property} onClose={()=>setEditingLocation(false)}/>}
    {action&&<OwnerAction action={action} onClose={()=>setAction(null)}/>}{adding&&<AddProperty onClose={()=>setAdding(false)}/>}

  </div>;

}



function OwnerAction({action,onClose}:{action:Action;onClose:()=>void}) {

  const {state,now,busy,run}=useDwell();const [studentId,setStudentId]=useState(""),[hours,setHours]=useState(48),[reason,setReason]=useState(""),[category,setCategory]=useState("Bed damage"),[moveIn,setMoveIn]=useState(dateInput(now));

  const p=state.properties.find(p=>p.id===action.bed.propertyId)!;const [price,setPrice]=useState(p.price);

  const titles={invite:"A little time to decide",book:"Confirm a new chapter",cancel:"Exceptional cancellation",block:"Mark bed unavailable",checkout:"Record checkout"};

  async function submit(e:FormEvent){e.preventDefault();const form=new FormData(e.currentTarget as HTMLFormElement);let ok=false;const a=action.allocation;

    if(action.kind==="invite")ok=await run({type:"invite",studentId,bedId:action.bed.id,expectedVersion:action.bed.version,durationHours:hours});

    if(action.kind==="book"&&a)ok=await run({type:"book",allocationId:a.id,expectedVersion:a.version,moveInDate:String(form.get("moveInDate")??moveIn),agreedPrice:price});

    if(action.kind==="cancel"&&a)ok=await run({type:"cancel",allocationId:a.id,expectedVersion:a.version,reason:`${category}: ${reason}`});

    if(action.kind==="block")ok=await run({type:"block",bedId:action.bed.id,expectedVersion:action.bed.version,reason});

    if(action.kind==="checkout"&&a)ok=await run({type:"checkout",allocationId:a.id,expectedVersion:a.version});

    if(ok)onClose();

  }

  return <Dialog title={titles[action.kind]} onClose={onClose}><form className="dialog-body form" onSubmit={submit}><div className="form-property"><BedDouble size={22}/><div><strong>{p.name}</strong><span>{floorName(action.bed.floor)} · Room {action.bed.room} · Bed {action.bed.label}</span></div></div>

    {action.kind==="invite"&&<><p>Invite a student after a visit or direct conversation. They’ll have two hours to accept before their protected hold begins.</p><label>Student's registered email<input type="email" required value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="student@example.com"/></label><label>Decision window<select value={hours} onChange={e=>setHours(Number(e.target.value))}><option value={48}>48 hours · Recommended</option><option value={24}>24 hours</option><option value={12}>12 hours</option><option value={6}>6 hours</option></select></label><div className="info-box"><ShieldCheck size={17}/>Once accepted, the deadline is protected. Queue priority is always respected.</div></>}

    {action.kind==="book"&&<><p>Confirm the accommodation agreement you’ve made directly with the current student. This records an offline booking; it does not take a payment.</p><label>Move-in date<input name="moveInDate" type="date" required value={moveIn} onChange={e=>setMoveIn(e.target.value)}/></label><label>Agreed monthly rent (₹)<input type="number" required min={0} max={1000000} value={price} onChange={e=>setPrice(Number(e.target.value))}/></label><div className="info-box"><Users size={17}/>Other students in this bed’s queue will be notified that it has been booked.</div></>}

    {(action.kind==="cancel"||action.kind==="block")&&<><p>{action.kind==="cancel"?"Use this only for safety, bed damage, or an inventory error. The current reservation will end, the student will be notified, and the bed will be blocked.":"This removes the bed from available inventory until the operational issue is resolved."}</p>{action.kind==="cancel"&&<label>Operational reason<select value={category} onChange={e=>setCategory(e.target.value)}><option>Bed damage</option><option>Safety issue</option><option>Inventory error</option></select></label>}<label>Explain the issue<textarea required minLength={10} maxLength={500} rows={4} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describe what needs to be resolved (at least 10 characters)…"/></label><div className="info-box warning"><ShieldCheck size={17}/>A new applicant or a higher offer is not a valid reason to displace a student.</div></>}

    {action.kind==="checkout"&&<p>Confirm that this stay has ended. The booking will remain in the history and this bed will return to the normal allocation process.</p>}

    <div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose}>Not now</button><button className="button primary" disabled={busy} type="submit">{busy?"Saving…":action.kind==="invite"?"Send invitation":action.kind==="book"?"Confirm booking":action.kind==="checkout"?"Record checkout":"Confirm & block bed"}<ArrowRight size={15}/></button></div>

  </form></Dialog>;

}



function AddProperty({onClose}:{onClose:()=>void}) {

  const {run,busy,notify}=useDwell();const [floors,setFloors]=useState<FloorPlan[]>([]),[images,setImages]=useState<string[]>([]),[photoBusy,setPhotoBusy]=useState(false);const [location,setLocation]=useState<Coordinates>();const [locationPending,setLocationPending]=useState(false);const [city,setCity]=useState(""),[address,setAddress]=useState(""),[description,setDescription]=useState(""),[amenities,setAmenities]=useState<string[]>([]);const [name,setName]=useState(""),[locality,setLocality]=useState(""),[category,setCategory]=useState<"PG"|"Hostel"|"Co-living">("PG"),[price,setPrice]=useState(9000);

  return <Dialog title="Room for another chapter" onClose={onClose}><form className="dialog-body form" onSubmit={async e=>{e.preventDefault();const parsedFloors=floorsSchema.safeParse(floors);if(!parsedFloors.success){notify(parsedFloors.error.issues[0]?.message??"Check floors, rooms and bed slots.");return;}if(!photoBudget(images,floors)){notify("Keep all photos under 16 MB combined. Remove a few photos and try again.");return;}if(locationPending){notify("Confirm the map pin with Use this pin before publishing, or clear the location.");return;}if(await run({type:"addProperty",name,locality,city,address,location,description,amenities,category,price,floors,images,rooms:1,bedsPerRoom:1}))onClose();}}><fieldset className="property-form-fields" disabled={photoBusy}><p>Add your property and its initial rooms and beds. Publishing makes it visible to student accounts.</p><label>Property name<input autoComplete="off" required minLength={3} maxLength={100} placeholder="e.g. Willow Student House" value={name} onChange={e=>setName(e.target.value)}/></label><div className="form-two"><label>Neighborhood<input required minLength={2} maxLength={100} value={locality} onChange={e=>setLocality(e.target.value)} placeholder="Neighborhood or locality"/></label><label>Type<select value={category} onChange={e=>setCategory(e.target.value as typeof category)}><option>PG</option><option>Hostel</option><option>Co-living</option></select></label></div><label>City<input name="city" required minLength={2} maxLength={100} autoComplete="address-level2" placeholder="City where the property is located" value={city} onChange={e=>setCity(e.target.value)}/></label><label>Full property address<input name="address" required minLength={5} maxLength={300} autoComplete="street-address" placeholder="Building, street and area" value={address} onChange={e=>setAddress(e.target.value)}/></label><LocationPicker value={location} onChange={setLocation} onPendingChange={setLocationPending} address={[address,city].filter(Boolean).join(", ")}/><label>Description (optional)<textarea name="description" maxLength={2000} rows={3} placeholder="Tell students about your property" value={description} onChange={e=>setDescription(e.target.value)}/></label><fieldset className="amenity-picker"><legend>Amenities <span>(optional)</span></legend><p id="amenity-help">Select everything available at your property.</p><div className="amenity-options" aria-describedby="amenity-help">{AMENITIES.map(amenity=><label className={`amenity-option ${amenities.includes(amenity)?"is-selected":""}`} key={amenity}><input type="checkbox" name="amenities" value={amenity} checked={amenities.includes(amenity)} onChange={e=>setAmenities(current=>e.target.checked?[...current,amenity]:current.filter(item=>item!==amenity))}/><AmenityIcon name={amenity} size={18}/><span>{amenity}</span></label>)}</div><span className="amenity-selection-count" role="status">{amenities.length?`${amenities.length} selected`:"No amenities selected"}</span></fieldset><label>Monthly rent from (₹)<input required type="number" min={1000} max={100000} value={price} onChange={e=>setPrice(Number(e.target.value))}/></label><PhotoUpload label="Overall property photos" images={images} onChange={setImages} cover onBusyChange={setPhotoBusy}/><FloorEditor floors={floors} onChange={setFloors} onBusyChange={setPhotoBusy}/><div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy||locationPending||photoBusy}>Publish property<Plus size={15}/></button></div></fieldset></form></Dialog>;

}



export function OwnerOverview(){const{state,now,student}=useDwell();const counts={vacant:0,under_review:0,booked:0,unavailable:0};state.beds.forEach(b=>counts[availability(state,b)]++);return <div className="owner-page"><div className="owner-page-heading"><div><div className="section-eyebrow"><span className="ember-dot"/>THE BIG PICTURE, AT A GLANCE</div><h1>A good place to <em>begin.</em></h1><p>Welcome back, {student.name}. Here’s what’s happening across your spaces.</p></div><Link className="button primary" href="/owner/properties">Manage inventory<ArrowRight size={16}/></Link></div><div className="overview-banner"><div><span className="section-eyebrow">YOUR PORTFOLIO</span><h2>Homes for new beginnings.</h2><p>{state.properties.length} properties. {state.beds.length} beds. A clear picture of every one.</p><div className="overview-numbers"><span><strong>{counts.vacant}</strong>Available</span><span><strong>{counts.under_review}</strong>Under review</span><span><strong>{counts.booked}</strong>Booked</span></div></div><div className="overview-art"><Building2 size={150} strokeWidth={.8}/><span className="overview-art-circle"/></div></div><div className="section-heading"><div><h2>Your places, together.</h2><p>Each one has a next chapter waiting.</p></div></div><div className="portfolio-grid">{state.properties.map(p=><Link href={`/owner/properties?property=${p.id}`} className="portfolio-card" key={p.id}><img src={p.image} alt={`${p.name} interior`}/><div><span className="property-category">{p.category} · {p.locality}</span><h3>{p.name}</h3><p>{state.beds.filter(b=>b.propertyId===p.id&&availability(state,b)==="vacant").length} beds available<span><ArrowUpRight size={17}/></span></p></div></Link>)}</div><section className="activity-panel"><div className="section-heading"><div><h2>The latest from your spaces</h2></div></div>{state.activity.slice(0,4).map(a=><div className="activity-row" key={a.id}><span className="activity-icon"><Clock3 size={16}/></span><div><strong>{a.action}</strong><p>{a.detail}</p></div><span>{relative(a.createdAt,now)}</span></div>)}</section></div>;}


function EditLocation({property,onClose}:{property:Property;onClose:()=>void}){
  const {run,busy}=useDwell();const [location,setLocation]=useState<Coordinates|undefined>(property.location);const [locationPending,setLocationPending]=useState(false);
  return <Dialog title="Pin your property’s location" onClose={onClose}><div className="dialog-body"><p className="location-editor-intro">{property.name} · {property.address}</p><LocationPicker value={location} onChange={setLocation} onPendingChange={setLocationPending} address={[property.address,property.city].join(", ")}/><div className="dialog-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy||!location||locationPending} onClick={async()=>{if(location&&await run({type:"setPropertyLocation",propertyId:property.id,location}))onClose();}}>Save location<MapPin size={15}/></button></div></div></Dialog>;
}

function EditPhotos({property,onClose}:{property:Property;onClose:()=>void}){
  const {state,busy,run,notify}=useDwell();const [floors,setFloors]=useState(()=>propertyFloors(property,state.beds)),[images,setImages]=useState<string[]>(property.images??(property.image.startsWith("data:")?[property.image]:[])),[photoBusy,setPhotoBusy]=useState(false);
  return <Dialog title="Property, floor & room photos" onClose={onClose}><div className="dialog-body form"><fieldset className="property-form-fields" disabled={photoBusy}><PhotoUpload label="Overall property photos" images={images} onChange={setImages} cover onBusyChange={setPhotoBusy}/><FloorEditor floors={floors} onChange={setFloors} photosOnly onBusyChange={setPhotoBusy}/><div className="dialog-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy||photoBusy} onClick={async()=>{if(!photoBudget(images,floors)){notify("Keep all photos under 16 MB combined.");return;}if(await run({type:"setPropertyPhotos",propertyId:property.id,images,floors}))onClose();}}>Save photos<FileImage size={15}/></button></div></fieldset></div></Dialog>;
}
function AddFloors({property,onClose}:{property:Property;onClose:()=>void}){
  const {state,busy,run,notify}=useDwell();const existing=propertyFloors(property,state.beds);const [floors,setFloors]=useState<FloorPlan[]>([newFloor(Array.from({length:50},(_,i)=>i+1).find(n=>!existing.some(f=>f.number===n))??1)]),[photoBusy,setPhotoBusy]=useState(false);
  return <Dialog title="Add floors, rooms & beds" onClose={onClose}><div className="dialog-body form"><p>Expand {property.name}. Existing rooms, beds and reservations stay in place. Choose floor numbers that are not already in this property.</p><fieldset className="property-form-fields" disabled={photoBusy}><FloorEditor floors={floors} onChange={setFloors} onBusyChange={setPhotoBusy}/><div className="dialog-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy||photoBusy} onClick={async()=>{const parsed=floorsSchema.safeParse(floors);if(!parsed.success){notify(parsed.error.issues[0]?.message??"Check the floor structure.");return;}if(await run({type:"appendFloors",propertyId:property.id,floors:parsed.data}))onClose();}}>Add floors<Plus size={15}/></button></div></fieldset></div></Dialog>;
}

function AddCapacity({property,floor,roomName,onClose}:{property:Property;floor:FloorPlan;roomName?:string;onClose:()=>void}){
  const {state,run,busy,notify}=useDwell();const [room,setRoom]=useState(()=>newRoom(floor.number,floor.rooms.map(r=>r.number))),[labels,setLabels]=useState<string[]>([]),[photoBusy,setPhotoBusy]=useState(false);
  const existing=roomName?state.beds.filter(b=>b.propertyId===property.id&&b.floor===floor.number&&b.room===roomName).map(b=>b.label):[];
  return <Dialog title={roomName?`Add bed slots to room ${roomName}`:`Add room to ${floorName(floor.number)}`} onClose={onClose}><div className="dialog-body form"><p>{property.name} · {floorName(floor.number,floor.name)}. Existing beds and reservations stay in place.</p><fieldset className="property-form-fields" disabled={photoBusy}>{roomName?<BedSlotEditor room={roomName} labels={labels} onChange={setLabels} existing={existing}/>:<RoomEditor room={room} onChange={setRoom} onBusyChange={setPhotoBusy}/>}<div className="dialog-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy||photoBusy||(!!roomName&&!labels.length)} onClick={async()=>{if(roomName){const parsed=bedLabelsSchema.safeParse(labels);if(!parsed.success){notify(parsed.error.issues[0]?.message??"Check bed names.");return;}if(await run({type:"appendBedSlots",propertyId:property.id,floor:floor.number,room:roomName,labels:parsed.data}))onClose();}else{const parsed=roomSchema.safeParse(room);if(!parsed.success){notify(parsed.error.issues[0]?.message??"Check the room and slots.");return;}if(await run({type:"appendRooms",propertyId:property.id,floor:floor.number,rooms:[parsed.data]}))onClose();}}}>{roomName?"Add bed slots":"Add room"}<Plus size={15}/></button></div></fieldset></div></Dialog>;
}
