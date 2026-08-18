import type { Key } from "./model.ts";

const idSegmentEncoder = new TextEncoder();

const encodeIdSegment = (value: string): string => {
  const binary = [...idSegmentEncoder.encode(value)].reduce(
    (binary, byte) => binary + String.fromCharCode(byte),
    "",
  );
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
