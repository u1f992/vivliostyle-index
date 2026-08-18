import assert from "node:assert";
import test from "node:test";

import { createEntryId, createSourceId, createSubentryId } from "../src/id.ts";
import { createKey } from "../src/model.ts";

const group = createKey("a", "a");
const entry = createKey("Apple", "Apple");
const subentry = createKey("Pie", "Pie");

/*
 * Generated IDs use index.{source,entry,subentry}. as their namespace.
 * Their value is naturally unique: source IDs use structural XPath, and headings with identical
 * {html, reading} keys are merged. Document IDs are not validated against this namespace, so
 * documents that do not follow the ID convention may produce ambiguous references.
 */
void test("namespaces generated IDs by their role", () => {
  assert.strictEqual(createSourceId("/html/body/span[2]"), "index.source.L2h0bWwvYm9keS9zcGFuWzJd");
  assert.strictEqual(
    createEntryId("index", group, entry),
    "index.entry.aW5kZXg.YQ.YQ.QXBwbGU.QXBwbGU",
  );
  assert.strictEqual(
    createSubentryId("index", group, entry, subentry),
    "index.subentry.aW5kZXg.YQ.YQ.QXBwbGU.QXBwbGU.UGll.UGll",
  );
});

void test("distinguishes IDs for keys that differ only by lone surrogates", () => {
  const high = String.fromCharCode(0xd800);
  const low = String.fromCharCode(0xdc00);

  assert.notStrictEqual(
    createEntryId("index", group, createKey(high, high)),
    createEntryId("index", group, createKey(low, low)),
  );
});
