import { mkdir, writeFile, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
/** Preserve the last complete file while Windows/OneDrive briefly locks a replacement. */
export async function writeJsonAtomically(file:string,value:unknown){
  await mkdir(path.dirname(file),{recursive:true});const temporary=`${file}.${randomUUID()}.tmp`;
  try{await writeFile(temporary,JSON.stringify(value),{encoding:"utf8",mode:0o600});
    for(let attempt=0;;attempt++){
      try{await rename(temporary,file);return;}
      catch(error){if(attempt>=5||!["EPERM","EACCES","EBUSY"].includes((error as NodeJS.ErrnoException).code??""))throw error;await new Promise(resolve=>setTimeout(resolve,30*2**attempt));}
    }
  }catch(error){await rm(temporary,{force:true}).catch(()=>undefined);throw error;}
}
