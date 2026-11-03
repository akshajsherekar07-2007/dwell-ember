import { DomainError } from "./engine";

const loopback=new Set(["localhost","127.0.0.1","[::1]"]);
/** Next can normalize request.url to localhost while preserving the browser's
 * 127.0.0.1 Host header. Compare browser Origin against the validated Host. */
export function assertLocalDemoRequest(request:Request,environment:Record<string,string|undefined>=process.env) {
  if(environment.NODE_ENV!=="development" && environment.DWELL_DEMO_MODE!=="true") throw new DomainError("DEMO_DISABLED","The local demo API is disabled. Connect the production services before deployment.",503);
  let host:URL;
  try {host=new URL(`http://${request.headers.get("host")||new URL(request.url).host}`);}
  catch {throw new DomainError("INVALID_HOST","Invalid local request host.",400);}
  if(!loopback.has(host.hostname)) throw new DomainError("LOCAL_ONLY","This demo runs on localhost only.",403);
  const origin=request.headers.get("origin");
  if(origin) {
    let source:URL;
    try {source=new URL(origin);} catch {throw new DomainError("INVALID_ORIGIN","Invalid request origin.",403);}
    if(source.host!==host.host || !["http:","https:"].includes(source.protocol)) throw new DomainError("INVALID_ORIGIN","Cross-origin demo requests are not allowed.",403);
  }
}
