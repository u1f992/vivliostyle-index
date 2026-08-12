import { defineCommand, ensureEntry, type EntryKey } from "../command.ts";
import { insertLocator } from "../model.ts";

type InsertPageCommand = [EntryKey] | ["page!", EntryKey];
export default defineCommand<InsertPageCommand>(
  {
    oneOf: [
      {
        type: "array",
        minItems: 1,
        maxItems: 1,
        prefixItems: [{ $ref: "#/$defs/EntryKey" }],
      },
      {
        type: "array",
        minItems: 2,
        maxItems: 2,
        prefixItems: [{ const: "page!" }, { $ref: "#/$defs/EntryKey" }],
      },
    ],
  },
  (cmd, index, locatorHref) => {
    const entryKey = cmd.length === 1 ? cmd[0] : cmd[1];
    insertLocator(ensureEntry(index, entryKey), {
      locator: locatorHref,
      important: cmd.length === 2,
    });
  },
);
