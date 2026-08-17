import assert from "node:assert";
import test from "node:test";

import { messages, type MessageArguments } from "../src/messages.ts";
import {
  ensureEntry,
  findUnresolvedXref,
  insertLocator,
  insertXref,
  type Index,
  type Key,
} from "../src/model.ts";
import { revokeViolations, type Revocable, type RevocationScope } from "../src/revocation.ts";
import { identityTemplate } from "../src/template.ts";

const group = { html: "a", reading: "a" };
const apple = { html: "Apple", reading: "Apple" };
const banana = { html: "Banana", reading: "Banana" };
const cherry = { html: "Cherry", reading: "Cherry" };
const reportingPath = "/publication/index.md";

function createXrefRevocable(index: Index, from: Key, to: Key): Revocable {
  const target = { group, entry: to };
  const revoke = insertXref(
    ensureEntry(index, { group, entry: from }),
    "preferred",
    target,
    identityTemplate,
  );
  return {
    reportingPath,
    revoke,
    findViolation: () => {
      const unresolvedXref = findUnresolvedXref(index, target);
      return unresolvedXref === undefined ? undefined : messages.invalidXref(unresolvedXref);
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

void test("revokes an unresolved cross-reference and the heading it empties", () => {
  const messagesByDocument = new Map<string, MessageArguments[]>();
  const index: Index = { children: [] };

  revokeViolations(
    createScope(index, [createXrefRevocable(index, apple, banana)]),
    messagesByDocument,
  );

  assert.deepStrictEqual(index.children, []);
  assert.deepStrictEqual(ruleIdsOf(messagesByDocument), [
    "vivliostyle-index:invalid-xref",
    "vivliostyle-index:vacant-entry",
  ]);
});

void test("keeps a heading while one of its cross-references resolves", () => {
  const messagesByDocument = new Map<string, MessageArguments[]>();
  const index: Index = { children: [] };
  insertLocator(ensureEntry(index, { group, entry: banana }), {
    location: { type: "page", href: "chapter.html#banana" },
    template: identityTemplate,
  });

  revokeViolations(
    createScope(index, [
      createXrefRevocable(index, apple, banana),
      createXrefRevocable(index, apple, cherry),
    ]),
    messagesByDocument,
  );

  assert.deepStrictEqual(
    index.children[0]?.children.map(({ key, xrefPreferred }) => [key.html, xrefPreferred.length]),
    [
      ["Banana", 0],
      ["Apple", 1],
    ],
  );
  assert.deepStrictEqual(ruleIdsOf(messagesByDocument), ["vivliostyle-index:invalid-xref"]);
});
