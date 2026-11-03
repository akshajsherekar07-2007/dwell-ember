import { describe, expect, it } from "vitest";
import { destinationAfterLogin, loginLink } from "../src/lib/auth-navigation";
describe("public to authenticated navigation",()=>{
  it("keeps property intent and the internal destination in login links",()=>{
    const url=new URL(loginLink("/discover?property=property-123","property"),"http://localhost");
    expect(url.pathname).toBe("/login");expect(url.searchParams.get("next")).toBe("/discover?property=property-123");expect(url.searchParams.get("intent")).toBe("property");
    expect(destinationAfterLogin("student",url.searchParams.get("next"))).toBe("/discover?property=property-123");
  });
  it("preselects owner signup and returns owners to inventory",()=>{
    const url=new URL(loginLink("/owner/properties","list",true,true),"http://localhost");
    expect(url.pathname).toBe("/signup");expect(url.searchParams.get("role")).toBe("owner");expect(destinationAfterLogin("owner",url.searchParams.get("next"))).toBe("/owner/properties");
  });
  it("rejects external redirects and destinations outside the account role",()=>{
    for(const next of ["https://example.com","//example.com","/api/demo","/owner/properties","/discover/../../owner","/discover#bad"]){expect(destinationAfterLogin("student",next)).toBe("/discover");}
    expect(destinationAfterLogin("owner","/discover?property=123")).toBe("/owner");
  });
});
