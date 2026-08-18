import type { Key } from "./model.ts";

// TextEncoder is not injective: WHATWG Encoding replaces lone surrogates with U+FFFD.
const wtf8Bytes = (value: string): number[] => {
  const bytes: number[] = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return bytes;
};

const encodeIdSegment = (value: string): string => {
  const binary = wtf8Bytes(value).reduce((binary, byte) => binary + String.fromCharCode(byte), "");
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const keySegments = (keys: readonly Key[]): string[] =>
  keys.flatMap(({ reading, html }) => [reading, html]);

const createId = (type: "source" | "entry" | "subentry", segments: readonly string[]): string =>
  ["index", type, ...segments.map(encodeIdSegment)].join(".");

export const createSourceId = (xpath: string): string => createId("source", [xpath]);

export const createEntryId = (indexId: string, group: Key, entry: Key): string =>
  createId("entry", [indexId, ...keySegments([group, entry])]);

export const createSubentryId = (indexId: string, group: Key, entry: Key, subentry: Key): string =>
  createId("subentry", [indexId, ...keySegments([group, entry, subentry])]);
