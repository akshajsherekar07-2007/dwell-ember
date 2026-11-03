import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { writeJsonAtomically } from "../src/lib/atomic-json";
vi.mock("node:fs/promises",async importOriginal=>{const actual=await importOriginal<typeof import("node:fs/promises")>();return {...actual,rename:vi.fn(actual.rename)};});
let directory:string,native:typeof import("node:fs/promises");const root=path.resolve(".test-data");
beforeAll(async()=>{native=await vi.importActual("node:fs/promises");await mkdir(root,{recursive:true});directory=await mkdtemp(path.join(root,"atomic-"));});
beforeEach(()=>{vi.mocked(rename).mockReset().mockImplementation(async(from,to)=>native.rename(from,to));});
afterAll(async()=>{if(!directory.startsWith(root+path.sep))throw Error("Unexpected test directory");await rm(directory,{recursive:true,force:true});});
describe("atomic JSON replacement under Windows file locks",()=>{
  it("retries temporary file locks before replacing the complete record",async()=>{
    const file=path.join(directory,"retry.json");await writeFile(file,JSON.stringify({revision:1}));vi.mocked(rename).mockRejectedValueOnce(Object.assign(new Error("locked"),{code:"EPERM"})).mockRejectedValueOnce(Object.assign(new Error("busy"),{code:"EBUSY"}));
    await writeJsonAtomically(file,{revision:2});expect(JSON.parse(await readFile(file,"utf8"))).toEqual({revision:2});expect(rename).toHaveBeenCalledTimes(3);expect((await readdir(directory)).some(name=>name.endsWith(".tmp"))).toBe(false);
  });
  it("preserves the original JSON and removes the temporary file when replacement fails",async()=>{
    const file=path.join(directory,"failure.json");await writeFile(file,JSON.stringify({revision:1}));vi.mocked(rename).mockRejectedValue(Object.assign(new Error("disk failure"),{code:"EIO"}));
    await expect(writeJsonAtomically(file,{revision:2})).rejects.toMatchObject({code:"EIO"});expect(JSON.parse(await readFile(file,"utf8"))).toEqual({revision:1});expect(rename).toHaveBeenCalledTimes(1);expect((await readdir(directory)).some(name=>name.endsWith(".tmp"))).toBe(false);
  });
});
