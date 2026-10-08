// index.ts — Re-export all split engine functions
export { alloc } from "./alloc";
export type { Weights } from "./alloc";
export { allocPercent } from "./percent";
export { allocExact } from "./exact";
export { allocItems } from "./items";
export type { ItemInput, AdjustmentInput } from "./items";
export { computeBalances } from "./balances";
export type { ExpenseInput, SettlementInput } from "./balances";
export { settle } from "./settle";
export type { Transfer } from "./settle";
