import type { ParsedCommand } from "./command-parser.ts";
import { ensureEntry, insertLocator, insertReference, type Index } from "./model.ts";

type PageCommand = Extract<ParsedCommand, { type: "page" }>;
type RangeCommand = Extract<ParsedCommand, { type: "range" }>;
type ReferenceCommand = Extract<ParsedCommand, { type: "see" | "seeAlso" }>;

export function applyPageCommand(index: Index, command: PageCommand, locatorHref: string): void {
  insertLocator(ensureEntry(index, command.entry), {
    locator: locatorHref,
    important: command.important,
  });
}

export function applyRangeCommand(
  index: Index,
  command: RangeCommand,
  startHref: string,
  endHref: string,
): void {
  insertLocator(ensureEntry(index, command.entry), {
    locator: { start: startHref, end: endHref },
    important: command.important,
  });
}

export function applyReferenceCommand(index: Index, command: ReferenceCommand): void {
  insertReference(ensureEntry(index, command.entry), command.type, command.target);
}
