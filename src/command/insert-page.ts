import { type Base, defineCommand, ensureEntry } from "../command.js";
import { insertLocator } from "../model.js";

type InsertPageCommand = [...Base] | ["page!", ...Base];
export default defineCommand<InsertPageCommand>(
  {
    oneOf: [
      {
        type: "array",
        minItems: 2,
        maxItems: 2,
        prefixItems: [
          { $ref: "#/$defs/IndexId" },
          { $ref: "#/$defs/PartialEntryKey" },
        ],
      },
      {
        type: "array",
        minItems: 3,
        maxItems: 3,
        prefixItems: [
          { const: "page!" },
          { $ref: "#/$defs/IndexId" },
          { $ref: "#/$defs/PartialEntryKey" },
        ],
      },
    ],
  },
  (cmd, indexes, elem, ensureId) => {
    const [indexId, partialEntryKey] =
      cmd.length === 2 ? cmd : [cmd[1], cmd[2]];
    insertLocator(ensureEntry(indexes, indexId, partialEntryKey, elem), [
      ensureId(elem),
      cmd.length === 3,
    ]);
  },
);
