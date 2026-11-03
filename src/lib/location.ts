import { z } from "zod";
export const locationSchema=z.object({latitude:z.number().finite().min(-90).max(90),longitude:z.number().finite().min(-180).max(180)});
export type Coordinates=z.infer<typeof locationSchema>;
export function directionsUrl(location:Coordinates){return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`;}
