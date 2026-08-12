import { type Base, defineCommand, ensureEntry, type EntryKey } from "../command.ts";
import { insertLocator, type Index } from "../model.ts";

const __rangeStore = Symbol();
type RangeId = string;
type IndexesWithRangeStore = Index[] & {
  [__rangeStore]?: {
    [key: RangeId]: {
      indexId: string;
      entryKey: EntryKey;
      important: boolean;
      elemId: string;
    };
  };
};

export function deleteRangeStore(indexes: IndexesWithRangeStore) {
  const rangeStore = indexes[__rangeStore];
  if (rangeStore) {
    for (const rangeId of Object.keys(rangeStore)) {
      console.warn(`range start found for id=${rangeId} but no matching end marker exists`);
    }
  }
  Reflect.deleteProperty(indexes, __rangeStore);
}

type InsertRangeStartCommand = ["range" | "range!", ...Base, RangeId];
export const insertRangeStart = defineCommand<InsertRangeStartCommand>(
  {
    type: "array",
    minItems: 4,
    maxItems: 4,
    prefixItems: [
      {
        oneOf: [{ const: "range" }, { const: "range!" }],
      },
      { $ref: "#/$defs/IndexId" },
      { $ref: "#/$defs/EntryKey" },
      { type: "string" },
    ],
  },
  (cmd, indexes: IndexesWithRangeStore, elem, ensureId) => {
    const [type, indexId, entryKey, rangeId] = cmd;
    const rangeStore = (indexes[__rangeStore] ??= {});
    rangeStore[rangeId] = {
      indexId,
      entryKey,
      important: type === "range!",
      elemId: ensureId(elem),
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
  (cmd, indexes: IndexesWithRangeStore, elem, ensureId) => {
    const rangeId = cmd[1];
    const err = `range end found for id=${rangeId} but no matching start marker exists`;
    const rangeStore = indexes[__rangeStore];
    if (!rangeStore) {
      console.warn(err);
      return;
    }
    const start = rangeStore[rangeId];
    if (!start) {
      console.warn(err);
      return;
    }
    const { indexId, entryKey, important, elemId } = start;
    insertLocator(ensureEntry(indexes, indexId, entryKey), [[elemId, ensureId(elem)], important]);

    delete rangeStore[rangeId];
    if (Object.keys(rangeStore).length === 0) {
      Reflect.deleteProperty(indexes, __rangeStore);
    }
  },
);
