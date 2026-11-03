import type { DemoState } from "./types";
export function createEmpty(): DemoState {
  return {revision:0,clockOffset:0,people:[],properties:[],beds:[],allocations:[],queues:[],access:[],notices:[],activity:[],ledger:[],sequence:0,requests:{}};
}
