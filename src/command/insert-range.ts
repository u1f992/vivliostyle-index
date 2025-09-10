import {
  type Base,
  defineCommand,
  ensureEntry,
  type PartialEntryKey,
} from "../command.js";
import { insertLocator, type Index, type Key } from "../model.js";

const __rangeStore = Symbol();
type RangeId = string;
type IndexesWithRangeStore = Index<Key>[] & {
  [__rangeStore]?: {
    [key: RangeId]: {
      indexId: string;
      partialEntryKey: PartialEntryKey;
      important: boolean;
      elemId: string;
      elemStr: string;
    };
  };
};

export function deleteRangeStore(indexes: IndexesWithRangeStore) {
  const rangeStore = indexes[__rangeStore];
  if (rangeStore) {
    for (const rangeId of Object.keys(rangeStore)) {
      console.warn(
        `range start found for id=${rangeId} but no matching end marker exists`,
      );
    }
  }
  delete indexes[__rangeStore];
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
      { $ref: "#/$defs/PartialEntryKey" },
      { type: "string" },
    ],
  },
  (cmd, indexes: IndexesWithRangeStore, elem, ensureId) => {
    const [type, indexId, partialEntryKey, rangeId] = cmd;
    const rangeStore = (indexes[__rangeStore] ??= {});
    rangeStore[rangeId] = {
      indexId,
      partialEntryKey,
      important: type === "range!",
      elemId: ensureId(elem),
      elemStr: JSON.stringify(elem),
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
    const { indexId, partialEntryKey, important, elemId, elemStr } = start;
    insertLocator(
      ensureEntry(indexes, indexId, partialEntryKey, JSON.parse(elemStr)),
      [[elemId, ensureId(elem)], important],
    );

    delete rangeStore[rangeId];
    if (Object.keys(rangeStore).length === 0) {
      delete indexes[__rangeStore];
    }
  },
);
