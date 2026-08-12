import { defineCommand, ensureEntry, type EntryKey } from "../command.ts";
import { insertLocator, type Index } from "../model.ts";

const __rangeStore = Symbol();
type RangeId = string;
type IndexWithRangeStore = Index & {
  [__rangeStore]?: {
    [key: RangeId]: {
      entryKey: EntryKey;
      important: boolean;
      locatorHref: string;
    };
  };
};

export function deleteRangeStore(index: IndexWithRangeStore) {
  const rangeStore = index[__rangeStore];
  if (rangeStore) {
    for (const rangeId of Object.keys(rangeStore)) {
      console.warn(`range start found for id=${rangeId} but no matching end marker exists`);
    }
  }
  Reflect.deleteProperty(index, __rangeStore);
}

type InsertRangeStartCommand = ["range" | "range!", EntryKey, RangeId];
export const insertRangeStart = defineCommand<InsertRangeStartCommand>(
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
  (cmd, index: IndexWithRangeStore, locatorHref) => {
    const [type, entryKey, rangeId] = cmd;
    const rangeStore = (index[__rangeStore] ??= {});
    rangeStore[rangeId] = {
      entryKey,
      important: type === "range!",
      locatorHref,
    };
  },
);

type InsertRangeEndCommand = ["/range", RangeId];
export const insertRangeEnd = defineCommand<InsertRangeEndCommand>(
  {
    type: "array",
    minItems: 2,
    maxItems: 2,
    prefixItems: [{ const: "/range" }, { type: "string" }],
  },
  (cmd, index: IndexWithRangeStore, locatorHref) => {
    const rangeId = cmd[1];
    const err = `range end found for id=${rangeId} but no matching start marker exists`;
    const rangeStore = index[__rangeStore];
    if (!rangeStore) {
      console.warn(err);
      return;
    }
    const start = rangeStore[rangeId];
    if (!start) {
      console.warn(err);
      return;
    }
    const { entryKey, important, locatorHref: startHref } = start;
    insertLocator(ensureEntry(index, entryKey), [[startHref, locatorHref], important]);

    delete rangeStore[rangeId];
    if (Object.keys(rangeStore).length === 0) {
      Reflect.deleteProperty(index, __rangeStore);
    }
  },
);
