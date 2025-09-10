import {
  type Base,
  type PartialEntryKey,
  defineCommand,
  ensureEntry,
  padNull,
} from "../command.js";
import { ensureIndex, getChild, insertReference } from "../model.js";

type InsertReferenceCommand = ["see" | "seeAlso", ...Base, PartialEntryKey];
export default defineCommand<InsertReferenceCommand>(
  {
    type: "array",
    minItems: 4,
    maxItems: 4,
    prefixItems: [
      { oneOf: [{ const: "see" }, { const: "seeAlso" }] },
      { $ref: "#/$defs/IndexId" },
      { $ref: "#/$defs/PartialEntryKey" },
      { $ref: "#/$defs/PartialEntryKey" },
    ],
  },
  (cmd, indexes, elem) => {
    const [
      type,
      indexId,
      partialEntryKey,
      [groupPartialKey, mainEntryPartialKey, subentryPartialKey],
    ] = cmd;
    const index = ensureIndex(indexes, indexId);
    const entry = ensureEntry(indexes, indexId, partialEntryKey, elem);
    const groupKey = padNull(groupPartialKey, elem);
    const mainKey = padNull(mainEntryPartialKey, elem);
    const subentryKey =
      typeof subentryPartialKey === "undefined"
        ? undefined
        : padNull(subentryPartialKey, elem);
    const group = getChild(index, groupKey);
    if (!group) {
      insertReference(
        entry,
        type,
        // @ts-expect-error spread
        [
          groupKey,
          mainKey,
          ...(typeof subentryKey === "undefined" ? [] : [subentryKey]),
        ],
      );
    } else {
      const mainEntry = getChild(group, mainKey);
      if (!mainEntry) {
        insertReference(
          entry,
          type,
          // @ts-expect-error spread
          [
            group.key,
            mainKey,
            ...(typeof subentryKey === "undefined" ? [] : [subentryKey]),
          ],
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
