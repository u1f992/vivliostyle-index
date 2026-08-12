import {
  ensureChild,
  ensureIndex,
  toHastChildren,
  type EntryBase,
  type Index,
  type IndexId,
  type Key,
} from "./model.ts";

import { Ajv2020 as Ajv, type JSONSchemaType } from "ajv/dist/2020.js";
import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { getXPath } from "hast-util-get-xpath";
import YAML from "yaml";

const ajv = new Ajv();
const $schema = "https://json-schema.org/draft/2020-12/schema";

type InputKey = [string, string];
type MainEntryKey = [InputKey, InputKey];
type SubentryKey = [InputKey, InputKey, InputKey];
export type EntryKey = MainEntryKey | SubentryKey;
export type Base = [IndexId, EntryKey];
const $defs = {
  IndexId: { type: "string" },
  Key: {
    type: "array",
    minItems: 2,
    maxItems: 2,
    prefixItems: [{ type: "string" }, { type: "string" }],
  },
  MainEntryKey: {
    type: "array",
    minItems: 2,
    maxItems: 2,
    prefixItems: [{ $ref: "#/$defs/Key" }, { $ref: "#/$defs/Key" }],
  },
  SubentryKey: {
    type: "array",
    minItems: 3,
    maxItems: 3,
    prefixItems: [{ $ref: "#/$defs/Key" }, { $ref: "#/$defs/Key" }, { $ref: "#/$defs/Key" }],
  },
  EntryKey: {
    oneOf: [{ $ref: "#/$defs/MainEntryKey" }, { $ref: "#/$defs/SubentryKey" }],
  },
};

const testSymbol = Symbol();
const runSymbol = Symbol();

export type Command<T extends (string | EntryKey)[] = (string | EntryKey)[]> = {
  [testSymbol]: (obj: unknown) => obj is T;
  [runSymbol]: (
    obj: Readonly<T>,
    indexes: Index[],
    elem: hast.Element,
    ensureId: (elem: hast.Element) => string,
  ) => void;
};

export function defineCommand<T extends (string | EntryKey)[]>(
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
export type CommandString = string & {
  [commandStringBrand]: unknown;
};

const memo = new Map<string, unknown>();

export function test<T extends (string | EntryKey)[]>(
  cmd: Command<T>,
  input: string,
): input is CommandString {
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

export function read<T extends (string | EntryKey)[]>(input: CommandString): Readonly<T> {
  return memo.get(input) as T;
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

function encodeRelativePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function createHref(relPath: string | null, id: string) {
  const path = relPath === null ? "" : encodeRelativePath(relPath);
  return `${path}#${encodeURIComponent(id)}`;
}

export function run<T extends (string | EntryKey)[]>(
  cmd: Command<T>,
  input: CommandString,
  indexes: Index[],
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
  cmd[runSymbol](memo.get(input) as T, indexes, elem, (el) =>
    createHref(relPath, ensureId(tree, el)),
  );
}

export function toModelKey([word, reading]: InputKey): Key {
  return [toHastChildren(word), reading];
}

export function ensureEntry(
  indexes: Index[],
  indexId: IndexId,
  [groupKey, mainEntryKey, subentryKey]: EntryKey,
): EntryBase {
  const index = ensureIndex(indexes, indexId);
  const group = ensureChild(index, toModelKey(groupKey), { children: [] });
  const mainEntry = ensureChild(group, toModelKey(mainEntryKey), {
    children: [],
    locators: [],
    see: [],
    seeAlso: [],
  });
  return typeof subentryKey === "undefined"
    ? mainEntry
    : ensureChild(mainEntry, toModelKey(subentryKey), {
        locators: [],
        see: [],
        seeAlso: [],
      });
}
