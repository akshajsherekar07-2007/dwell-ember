"use client";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, LocateFixed, MapPin, Check, X } from "lucide-react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { directionsUrl, locationSchema, type Coordinates } from "@/lib/location";

function MapCanvas({point,onChange}:{point?:Coordinates;onChange?:(p:Coordinates)=>void}){
  const container=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null),marker=useRef<Marker|null>(null);
  const change=useRef(onChange),current=useRef(point);change.current=onChange;current.current=point;
  const[ready,setReady]=useState(false),[error,setError]=useState("");
  const editable=!!onChange;
  useEffect(()=>{let disposed=false;let observer:ResizeObserver|undefined;
    void import("leaflet").then(L=>{if(disposed||!container.current)return;const p=current.current;
      const instance=L.map(container.current,{scrollWheelZoom:false,worldCopyJump:true}).setView(p?[p.latitude,p.longitude]:[22.5,79],p?17:5);map.current=instance;
      const tiles=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'}).addTo(instance);
      tiles.on("tileerror",()=>{if(!disposed)setError("Map tiles couldn’t load. You can still enter coordinates or open directions.");});
      const place=(position:Coordinates)=>{if(!marker.current){marker.current=L.marker([position.latitude,position.longitude],{draggable:editable,title:editable?"Property pin. Drag to adjust.":"Owner-confirmed property location",icon:L.divIcon({className:"property-map-pin",html:'<span aria-hidden="true">●</span>',iconSize:[30,38],iconAnchor:[15,36]})}).addTo(instance);
          marker.current.on("dragend",()=>{const pos=marker.current!.getLatLng().wrap();change.current?.({latitude:Math.max(-90,Math.min(90,pos.lat)),longitude:pos.lng});});
        }else marker.current.setLatLng([position.latitude,position.longitude]);};
      if(p)place(p);
      if(editable)instance.on("click",(event)=>{const pos=event.latlng.wrap();const selected={latitude:Math.max(-90,Math.min(90,pos.lat)),longitude:pos.lng};place(selected);change.current?.(selected);});
      observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(container.current);setReady(true);
    }).catch(()=>{if(!disposed)setError("The map couldn’t load. Enter coordinates instead, or try again.");});
    return()=>{disposed=true;observer?.disconnect();map.current?.remove();map.current=null;marker.current=null;};
  },[editable]);
  useEffect(()=>{if(!ready||!map.current)return;if(!point){marker.current?.remove();marker.current=null;return;}let active=true;void import("leaflet").then(L=>{if(!active||!map.current)return;
    if(!marker.current){marker.current=L.marker([point.latitude,point.longitude],{draggable:editable,title:"Property location",icon:L.divIcon({className:"property-map-pin",html:'<span aria-hidden="true">●</span>',iconSize:[30,38],iconAnchor:[15,36]})}).addTo(map.current);marker.current.on("dragend",()=>{const p=marker.current!.getLatLng().wrap();change.current?.({latitude:p.lat,longitude:p.lng});});}
    else marker.current.setLatLng([point.latitude,point.longitude]);
    map.current.setView([point.latitude,point.longitude],Math.max(map.current.getZoom(),16),{animate:false});
  });return()=>{active=false;};},[point?.latitude,point?.longitude,ready,editable]);
  return <><div ref={container} className="property-map-canvas" role="region" aria-label={editable?"Choose property location on map":"Property location map"}/>{error&&<p className="location-error" role="status">{error}</p>}</>;
}

export function LocationPicker({value,onChange,address="",onPendingChange}:{value?:Coordinates;onChange:(p:Coordinates|undefined)=>void;address?:string;onPendingChange?:(pending:boolean)=>void}){
  const[draft,setDraft]=useState<Coordinates|undefined>(value),[lat,setLat]=useState(value?.latitude.toString()??""),[lng,setLng]=useState(value?.longitude.toString()??""),[locating,setLocating]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  function choose(p:Coordinates){setDraft(p);setLat(p.latitude.toFixed(6));setLng(p.longitude.toFixed(6));setError("");setMessage("Pin moved. Check the position, then confirm it below.");}
  function locate(){setError("");setMessage("");if(!navigator.geolocation){setError("Location isn’t supported in this browser. Place a pin or enter coordinates instead.");return;}setLocating(true);
    navigator.geolocation.getCurrentPosition(position=>{if(!mounted.current)return;setLocating(false);choose({latitude:position.coords.latitude,longitude:position.coords.longitude});setMessage(`Device location found (accuracy about ${Math.round(position.coords.accuracy)} m). Adjust the pin to your property’s entrance and confirm.`);},e=>{if(!mounted.current)return;setLocating(false);setError(e.code===1?"Location permission was denied. You can place a pin or enter coordinates instead.":e.code===3?"Location request timed out. Try again or place the pin manually.":"Your location could not be determined. Place a pin or enter coordinates instead.");},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  }
  function applyCoordinates(){if(!lat.trim()||!lng.trim()){setError("Enter both latitude and longitude.");return;}const parsed=locationSchema.safeParse({latitude:Number(lat),longitude:Number(lng)});if(!parsed.success){setError("Use latitude from −90 to 90 and longitude from −180 to 180.");return;}choose(parsed.data);}
  const confirmed=!!value&&!!draft&&value.latitude===draft.latitude&&value.longitude===draft.longitude;
  const pending=!!draft&&!confirmed;
  useEffect(()=>{onPendingChange?.(pending);},[pending,onPendingChange]);
  return <section className="location-picker" aria-label="Exact property location"><div className="location-picker-title"><div><strong><MapPin size={16}/>Exact property location</strong><p>Use your location while at the PG, or zoom in and tap the map. Drag the pin to adjust it.</p></div>{confirmed&&<span className="location-confirmed"><Check size={12}/>Confirmed</span>}</div><div className="location-toolbar"><button type="button" className="button secondary small" onClick={locate} disabled={locating}><LocateFixed size={15}/>{locating?"Finding location…":"Use my current location"}</button>{address.trim()&&<a className="text-button" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">Find address on Google Maps<ExternalLink size={13}/></a>}</div><MapCanvas point={draft} onChange={choose}/><details className="location-coordinates"><summary>Enter latitude and longitude manually</summary><div className="form-two"><label>Latitude<input aria-label="Property latitude" type="number" step="any" min={-90} max={90} value={lat} onChange={e=>setLat(e.target.value)} placeholder="e.g. 18.5204"/></label><label>Longitude<input aria-label="Property longitude" type="number" step="any" min={-180} max={180} value={lng} onChange={e=>setLng(e.target.value)} placeholder="e.g. 73.8567"/></label></div><button type="button" className="text-button" onClick={applyCoordinates}>Place pin at these coordinates<MapPin size={13}/></button></details>{message&&<p className="location-message" role="status">{message}</p>}{error&&<p className="location-error" role="alert">{error}</p>}<div className="location-confirm-actions"><button type="button" className="button secondary small" disabled={!draft||confirmed} onClick={()=>{if(draft){onChange(draft);setMessage("Pin confirmed. Save or publish the property to keep this location.");}}}><Check size={15}/>{confirmed?"Pin confirmed":"Use this pin"}</button>{(draft||value)&&<button type="button" className="text-button" onClick={()=>{setDraft(undefined);setLat("");setLng("");onChange(undefined);setMessage("");setError("");}}>Clear location<X size={13}/></button>}</div><p className="location-privacy">Location permission is requested only when you choose it. Only your confirmed property pin is saved and shown to signed-in students. Map tiles are provided by OpenStreetMap.</p></section>;
}
export function PropertyLocation({location,address}:{location?:Coordinates;address:string}){
  return <section className="student-property-location"><div className="section-heading"><div><h3>Find your way home.</h3><p>{location?"Exact location confirmed by the property owner.":"The owner hasn’t added an exact pin yet. Use the address to arrange your visit."}</p></div></div>{location&&<MapCanvas point={location}/>}<div className="location-directions"><span><MapPin size={15}/>{address}</span><a className="button secondary small" href={location?directionsUrl(location):`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">{location?"Get directions":"Find address"}<ExternalLink size={14}/></a></div></section>;
}
