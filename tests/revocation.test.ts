import assert from "node:assert";
import test from "node:test";

import { messages, type MessageArguments } from "../src/messages.ts";
import {
  ensureEntry,
  findUnresolvedReference,
  insertLocator,
  insertReference,
  type Index,
  type Key,
} from "../src/model.ts";
import { revokeViolations, type Revocable, type RevocationScope } from "../src/revocation.ts";

const group = { html: "a", reading: "a" };
const apple = { html: "Apple", reading: "Apple" };
const banana = { html: "Banana", reading: "Banana" };
const cherry = { html: "Cherry", reading: "Cherry" };
const reportingPath = "/publication/index.md";

function createReferenceRevocable(index: Index, from: Key, to: Key): Revocable {
  const target = { group, entry: to };
  const revoke = insertReference(ensureEntry(index, { group, entry: from }), "see", target);
  return {
    reportingPath,
    revoke,
    findViolation: () => {
      const unresolvedReference = findUnresolvedReference(index, target);
      return unresolvedReference === undefined
        ? undefined
        : messages.invalidReference(unresolvedReference);
    },
  };
}

function createScope(index: Index, revocables: readonly Revocable[]): RevocationScope {
  return {
    index,
    target: { path: reportingPath, id: "index" },
    reportingPaths: [reportingPath],
    revocables,
  };
}

function ruleIdsOf(messagesByDocument: Map<string, MessageArguments[]>): (string | undefined)[] {
  return (messagesByDocument.get(reportingPath) ?? []).map((message) => message[2]);
}

void test("revokes an unresolved reference and the heading it empties", () => {
  const messagesByDocument = new Map<string, MessageArguments[]>();
  const index: Index = { children: [] };

  revokeViolations(
    createScope(index, [createReferenceRevocable(index, apple, banana)]),
    messagesByDocument,
  );

  assert.deepStrictEqual(index.children, []);
  assert.deepStrictEqual(ruleIdsOf(messagesByDocument), [
    "vivliostyle-index:invalid-reference",
    "vivliostyle-index:vacant-entry",
  ]);
});

void test("keeps a heading while one of its references resolves", () => {
  const messagesByDocument = new Map<string, MessageArguments[]>();
  const index: Index = { children: [] };
  insertLocator(ensureEntry(index, { group, entry: banana }), {
    location: "chapter.html#banana",
  });

  revokeViolations(
    createScope(index, [
      createReferenceRevocable(index, apple, banana),
      createReferenceRevocable(index, apple, cherry),
    ]),
    messagesByDocument,
  );

  assert.deepStrictEqual(
    index.children[0]?.children.map(({ key, see }) => [key.html, see.length]),
    [
      ["Banana", 0],
      ["Apple", 1],
    ],
  );
  assert.deepStrictEqual(ruleIdsOf(messagesByDocument), ["vivliostyle-index:invalid-reference"]);
});
