import type { ParsedInstruction } from "./instruction.ts";
import { ensureEntry, insertLocator, insertReference, type Index } from "./model.ts";

type PageInstruction = Extract<ParsedInstruction, { type: "page" }>;
type RangeInstruction = Extract<ParsedInstruction, { type: "range" }>;
type ReferenceInstruction = Extract<ParsedInstruction, { type: "see" | "seeAlso" }>;

export function applyPageInstruction(
  index: Index,
  instruction: PageInstruction,
  locatorHref: string,
): void {
  insertLocator(ensureEntry(index, instruction.entry), {
    locator: locatorHref,
    important: instruction.important,
  });
}

export function applyRangeInstruction(
  index: Index,
  instruction: RangeInstruction,
  startHref: string,
  endHref: string,
): void {
  insertLocator(ensureEntry(index, instruction.entry), {
    locator: { start: startHref, end: endHref },
    important: instruction.important,
  });
}

export function applyReferenceInstruction(index: Index, instruction: ReferenceInstruction): void {
  insertReference(ensureEntry(index, instruction.entry), instruction.type, instruction.target);
}
