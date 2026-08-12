import { ensureChild, toHastChildren, type EntryBase, type Index, type Key } from "./model.ts";

import { Ajv2020 as Ajv, type JSONSchemaType } from "ajv/dist/2020.js";
import YAML from "yaml";

const ajv = new Ajv();
const $schema = "https://json-schema.org/draft/2020-12/schema";

type InputKey = [string, string];
type MainEntryKey = [InputKey, InputKey];
type SubentryKey = [InputKey, InputKey, InputKey];
export type EntryKey = MainEntryKey | SubentryKey;
const $defs = {
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
  [runSymbol]: (obj: Readonly<T>, index: Index, locatorHref: string, rangeEndHref?: string) => void;
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

const parseError = Symbol();
const memo = new Map<string, unknown>();

export function parse(input: string): boolean {
  if (!memo.has(input)) {
    try {
      memo.set(input, YAML.parse(`[${input}]`));
    } catch {
      memo.set(input, parseError);
    }
  }
  return memo.get(input) !== parseError;
}

export function test<T extends (string | EntryKey)[]>(
  cmd: Command<T>,
  input: string,
): input is CommandString {
  if (!parse(input)) {
    return false;
  }
  return cmd[testSymbol](memo.get(input));
}

export function read<T extends (string | EntryKey)[]>(input: CommandString): Readonly<T> {
  return memo.get(input) as T;
}

export function run<T extends (string | EntryKey)[]>(
  cmd: Command<T>,
  input: CommandString,
  index: Index,
  locatorHref: string,
  rangeEndHref?: string,
) {
  if (!parse(input)) {
    return;
  }
  cmd[runSymbol](memo.get(input) as T, index, locatorHref, rangeEndHref);
}

export function toModelKey([word, reading]: InputKey): Key {
  return [toHastChildren(word), reading];
}

export function ensureEntry(
  index: Index,
  [groupKey, mainEntryKey, subentryKey]: EntryKey,
): EntryBase {
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
