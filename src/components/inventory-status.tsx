import { availability, type Bed, type DemoState } from "@/lib/types";
export function InventoryStatus({state,beds}:{state:DemoState;beds:Bed[]}){
  const counts={vacant:0,under_review:0,booked:0,unavailable:0};for(const b of beds)counts[availability(state,b)]++;
  return <span className="inventory-status-counts"><span className="count-available">{counts.vacant} available</span><span className="count-review">{counts.under_review} under review</span><span className="count-booked">{counts.booked} booked</span>{counts.unavailable>0&&<span className="count-unavailable">{counts.unavailable} blocked</span>}</span>;
}
