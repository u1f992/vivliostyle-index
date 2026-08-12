import { defineCommand, ensureEntry, type EntryKey } from "../command.ts";
import { insertLocator } from "../model.ts";

export type InsertRangeCommand = ["range" | "range!", EntryKey, string];
export const insertRange = defineCommand<InsertRangeCommand>(
  {
    type: "array",
    minItems: 3,
    maxItems: 3,
    prefixItems: [
      {
        oneOf: [{ const: "range" }, { const: "range!" }],
      },
      { $ref: "#/$defs/EntryKey" },
      { type: "string" },
    ],
  },
  (cmd, index, locatorHref, rangeEndHref) => {
    if (rangeEndHref === undefined) {
      return;
    }
    const [type, entryKey] = cmd;
    insertLocator(ensureEntry(index, entryKey), [[locatorHref, rangeEndHref], type === "range!"]);
  },
);
