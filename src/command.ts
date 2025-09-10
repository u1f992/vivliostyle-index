import {
  ensureChild,
  ensureIndex,
  toHastChildren,
  type EntryBase,
  type Index,
  type IndexId,
  type Key,
  type ResolvedKey,
} from "./model.js";

import { Ajv2020 as Ajv, type JSONSchemaType } from "ajv/dist/2020.js";
import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { getXPath } from "hast-util-get-xpath";
import YAML from "yaml";

const ajv = new Ajv();
const $schema = "https://json-schema.org/draft/2020-12/schema";

type PartialKey = null | ResolvedKey[0] | [null, ResolvedKey[1]] | ResolvedKey;
type PartialMainEntryKey = [PartialKey, PartialKey];
type PartialSubentryKey = [PartialKey, PartialKey, PartialKey];
export type PartialEntryKey = PartialMainEntryKey | PartialSubentryKey;
export type Base = [IndexId, PartialEntryKey];
const $defs = {
  IndexId: { type: "string" },
  PartialKey: {
    oneOf: [
      { type: "null" },
      { type: "string" },
      {
        type: "array",
        minItems: 2,
        maxItems: 2,
        prefixItems: [{ type: "null" }, { type: "string" }],
      },
      {
        type: "array",
        minItems: 2,
        maxItems: 2,
        prefixItems: [{ type: "string" }, { type: "string" }],
      },
    ],
  },
  PartialMainEntryKey: {
    type: "array",
    minItems: 2,
    maxItems: 2,
    prefixItems: [
      { $ref: "#/$defs/PartialKey" },
      { $ref: "#/$defs/PartialKey" },
    ],
  },
  PartialSubentryKey: {
    type: "array",
    minItems: 3,
    maxItems: 3,
    prefixItems: [
      { $ref: "#/$defs/PartialKey" },
      { $ref: "#/$defs/PartialKey" },
      { $ref: "#/$defs/PartialKey" },
    ],
  },
  PartialEntryKey: {
    oneOf: [
      { $ref: "#/$defs/PartialMainEntryKey" },
      { $ref: "#/$defs/PartialSubentryKey" },
    ],
  },
};

const testSymbol = Symbol();
const runSymbol = Symbol();

export type Command<
  T extends (string | IndexId | PartialEntryKey)[] = (
    | string
    | IndexId
    | PartialEntryKey
  )[],
> = {
  [testSymbol]: (obj: unknown) => obj is T;
  [runSymbol]: (
    obj: Readonly<T>,
    indexes: Index<Key>[],
    elem: hast.Element,
    ensureId: (elem: hast.Element) => string,
  ) => void;
};

export function defineCommand<T extends (string | IndexId | PartialEntryKey)[]>(
  partialSchema: Partial<JSONSchemaType<T>>,
  runFn: Command<T>[typeof runSymbol],
): Command<T> {
  return {
    [testSymbol]: ajv.compile<T>(
      // @ts-expect-error schema error
      {
        $schema,
        $defs,
        ...partialSchema,
      },
    ),
    [runSymbol]: runFn,
  };
}

const commandStringBrand = Symbol();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type CommandString<T extends (string | IndexId | PartialEntryKey)[]> =
  string & { [commandStringBrand]: unknown };

const memo = new Map<string, unknown>();

export function test<T extends (string | IndexId | PartialEntryKey)[]>(
  cmd: Command<T>,
  input: string,
): input is CommandString<T> {
  if (!memo.has(input)) {
    let parsed;
    try {
      parsed = YAML.parse(`[${input}]`);
    } catch {
      console.warn(`parse error: ${input}`);
      return false;
    }
    memo.set(input, parsed);
  }
  return cmd[testSymbol](memo.get(input));
}

function ensureId(tree: Readonly<hast.Root>, elem: hast.Element) {
  let id = getAttribute(elem, "id");
  if (id !== null) {
    return id;
  }

  id = getXPath(tree, elem);
  if (id !== null) {
    if (elem.properties) {
      elem.properties["id"] = id;
    } else {
      elem.properties = { id };
    }
    return id;
  }

  throw new Error("id === null: won't happen. it's likely a bug in getXPath()");
}

export function run<T extends (string | IndexId | PartialEntryKey)[]>(
  cmd: Command<T>,
  input: CommandString<T>,
  indexes: Index<Key>[],
  tree: hast.Root,
  elem: hast.Element,
  relPath: string | null,
) {
  if (!memo.has(input)) {
    let parsed;
    try {
      parsed = YAML.parse(`[${input}]`);
    } catch {
      console.warn(`parse error: ${input}`);
      return;
    }
    memo.set(input, parsed);
  }
  cmd[runSymbol](
    memo.get(input) as T,
    indexes,
    elem,
    (el) => (relPath === null ? "" : relPath + "#") + ensureId(tree, el),
  );
}

export function padNull(partial: PartialKey, elem: hast.Element): Key {
  const newElem = structuredClone(elem);
  (function stripPosition(node: hast.ElementContent): void {
    delete node["position"];
    if ("children" in node) {
      for (const child of node.children) {
        stripPosition(child);
      }
    }
  })(newElem);

  const alt = JSON.stringify(newElem.children);
  if (Array.isArray(partial)) {
    return partial[0] === null
      ? [alt, partial[1]]
      : [toHastChildren(partial[0]), partial[1]];
  } else {
    return [partial === null ? alt : toHastChildren(partial), null];
  }
}

export function ensureEntry<TKey extends Key>(
  indexes: Index<TKey>[],
  indexId: IndexId,
  [groupKey, mainEntryKey, subentryKey]: PartialEntryKey,
  elem: hast.Element,
): EntryBase<TKey> {
  const index = ensureIndex(indexes, indexId);
  const group = ensureChild(index, padNull(groupKey, elem), { children: [] });
  const mainEntry = ensureChild(group, padNull(mainEntryKey, elem), {
    children: [],
    locators: [],
    see: [],
    seeAlso: [],
  });
  return typeof subentryKey === "undefined"
    ? mainEntry
    : ensureChild(mainEntry, padNull(subentryKey, elem), {
        locators: [],
        see: [],
        seeAlso: [],
      });
}
