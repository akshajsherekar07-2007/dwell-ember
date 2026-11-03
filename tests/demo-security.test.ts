import { describe,expect,it } from "vitest";
import { assertLocalDemoRequest } from "../src/lib/demo-security";
const development={NODE_ENV:"development"};
describe("localhost-only demo boundary",()=>{
  it("accepts a same-origin browser with a Next-normalized request URL",()=>{
    expect(()=>assertLocalDemoRequest(new Request("http://localhost:3000/api/demo",{headers:{host:"127.0.0.1:3000",origin:"http://127.0.0.1:3000"}}),development)).not.toThrow();
  });
  it("rejects remote hosts and cross-origin browser requests",()=>{
    expect(()=>assertLocalDemoRequest(new Request("http://localhost:3000/api/demo",{headers:{host:"example.com"}}),development)).toThrow("localhost only");
    expect(()=>assertLocalDemoRequest(new Request("http://localhost:3000/api/demo",{headers:{host:"127.0.0.1:3000",origin:"https://example.com"}}),development)).toThrow("Cross-origin");
  });
  it("disables the demo in production unless deliberately enabled",()=>{
    const request=new Request("http://localhost:3000/api/demo");
    expect(()=>assertLocalDemoRequest(request,{NODE_ENV:"production"})).toThrow("disabled");
    expect(()=>assertLocalDemoRequest(request,{NODE_ENV:"production",DWELL_DEMO_MODE:"true"})).not.toThrow();
  });
});
