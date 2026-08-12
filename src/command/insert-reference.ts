import { type EntryKey, defineCommand, ensureEntry, toModelKey } from "../command.ts";
import { getChild, insertReference } from "../model.ts";

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
    const groupKey = toModelKey(groupInputKey);
    const mainKey = toModelKey(mainEntryInputKey);
    const subentryKey =
      typeof subentryInputKey === "undefined" ? undefined : toModelKey(subentryInputKey);
    const group = getChild(index, groupKey);
    if (!group) {
      insertReference(
        entry,
        type,
        // @ts-expect-error spread
        [groupKey, mainKey, ...(typeof subentryKey === "undefined" ? [] : [subentryKey])],
      );
    } else {
      const mainEntry = getChild(group, mainKey);
      if (!mainEntry) {
        insertReference(
          entry,
          type,
          // @ts-expect-error spread
          [group.key, mainKey, ...(typeof subentryKey === "undefined" ? [] : [subentryKey])],
        );
      } else {
        if (typeof subentryKey === "undefined") {
          insertReference(entry, type, [group.key, mainEntry.key]);
        } else {
          const subentry = getChild(mainEntry, subentryKey);
          insertReference(entry, type, [
            group.key,
            mainEntry.key,
            subentry ? subentry.key : subentryKey,
          ]);
        }
      }
    }
  },
);
