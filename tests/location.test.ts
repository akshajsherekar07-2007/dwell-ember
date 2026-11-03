import { describe, expect, it } from "vitest";
import { commandSchema } from "../src/lib/engine";
import { directionsUrl, locationSchema } from "../src/lib/location";
describe("confirmed property coordinates",()=>{
  it("accepts valid coordinates, including zero and geographic boundaries",()=>{
    for(const point of [{latitude:0,longitude:0},{latitude:18.5204,longitude:73.8567},{latitude:-90,longitude:180}])expect(locationSchema.safeParse(point).success).toBe(true);
  });
  it("rejects incomplete, nonfinite and out-of-range pins at the command boundary",()=>{
    for(const location of [{latitude:91,longitude:70},{latitude:18,longitude:181},{latitude:NaN,longitude:0},{latitude:0,longitude:Infinity},{latitude:18}])expect(commandSchema.safeParse({type:"setPropertyLocation",propertyId:"property-1",location}).success).toBe(false);
  });
  it("builds directions to the saved coordinates rather than a similar text address",()=>{
    const link=new URL(directionsUrl({latitude:18.5204,longitude:73.8567}));expect(link.hostname).toBe("www.google.com");expect(link.searchParams.get("destination")).toBe("18.5204,73.8567");expect(link.searchParams.get("api")).toBe("1");
  });
});
