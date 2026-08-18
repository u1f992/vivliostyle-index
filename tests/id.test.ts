import assert from "node:assert";
import test from "node:test";

import { createEntryId, createSourceId, createSubentryId } from "../src/id.ts";

const group = { html: "a", reading: "a" };
const entry = { html: "Apple", reading: "Apple" };
const subentry = { html: "Pie", reading: "Pie" };

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
