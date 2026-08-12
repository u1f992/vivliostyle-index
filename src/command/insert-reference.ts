import { type EntryKey, defineCommand, ensureEntry, toModelKey } from "../command.ts";
import { insertReference } from "../model.ts";

type InsertReferenceCommand = ["see" | "seeAlso", EntryKey, EntryKey];
export default defineCommand<InsertReferenceCommand>(
  {
    type: "array",
    minItems: 3,
    maxItems: 3,
    prefixItems: [
      { oneOf: [{ const: "see" }, { const: "seeAlso" }] },
      { $ref: "#/$defs/EntryKey" },
      { $ref: "#/$defs/EntryKey" },
    ],
  },
  (cmd, index) => {
    const [type, entryKey, [groupInputKey, mainEntryInputKey, subentryInputKey]] = cmd;
    const entry = ensureEntry(index, entryKey);
    insertReference(entry, type, {
      group: toModelKey(groupInputKey),
      mainEntry: toModelKey(mainEntryInputKey),
      ...(subentryInputKey === undefined ? {} : { subentry: toModelKey(subentryInputKey) }),
    });
  },
);
