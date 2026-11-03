export function destinationAfterLogin(role:"owner"|"student",next:string|null){
  if(role==="owner")return next==="/owner/properties"||next==="/owner/requests"?next:"/owner";
  if(next && /^\/(discover|saved|my-stays|billing|settings)(\?[^#]*)?$/.test(next))return next;
  return "/discover";
}
export function loginLink(next="/discover",intent="explore",signup=false,owner=false){
  return `${signup?"/signup":"/login"}?${new URLSearchParams({next,intent,...(owner?{role:"owner"}:{})})}`;
}
