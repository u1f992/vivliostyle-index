import assert from "node:assert";
import test from "node:test";

import { fromHtml } from "hast-util-from-html";
import { getAttribute } from "hast-util-get-attribute";
import { select } from "hast-util-select";

import { collectSourceSnapshot } from "../src/source-snapshot.ts";

void test("extracts instructions, targets, locators, and element IDs", () => {
  const root = fromHtml(
    '<span data-index="index.md?q=a%5C%40b!Apple|(end.md%3Fx%3D1%23end#index"></span><i id="end"></i>',
  );

  const snapshot = collectSourceSnapshot(root, "/publication/chapter.md");

  assert.strictEqual(snapshot.messages.length, 0);
  assert.strictEqual(snapshot.attachments.length, 1);
  assert.deepStrictEqual(snapshot.attachments[0], {
    sourcePath: "/publication/chapter.md",
    sourceId: "/html/body/span",
    target: { path: "/publication/index.md", id: "index" },
    targetKey: '["/publication/index.md","index"]',
    instruction: {
      type: "range",
      entry: {
        group: { html: "a@b", reading: "a@b" },
        mainEntry: { html: "Apple", reading: "Apple" },
      },
      important: false,
      endReference: "end.md?x=1#end",
    },
    locatorHref: "chapter.html#%2Fhtml%2Fbody%2Fspan",
    rangeEnd: { path: "/publication/end.md", id: "end" },
  });
  assert.deepStrictEqual(snapshot.ids, ["/html/body/span", "end"]);
  const source = select("[data-index]", root);
  assert.ok(source);
  assert.strictEqual(getAttribute(source, "id"), "/html/body/span");
});

void test("reports invalid references and instructions", () => {
  const root = fromHtml(
    '<span data-index="https://example.test/index.md?q=a!Apple#index"></span><span data-index="index.md?q=%5B#index"></span><span data-index="index.md?q=a!Apple|(end.md#index"></span>',
  );

  const snapshot = collectSourceSnapshot(root, "/publication/chapter.md");

  assert.deepStrictEqual(
    snapshot.messages.map((message) => message[2]?.split(":")[1]),
    ["invalid-index-reference", "instruction-parse-error", "invalid-range-end-reference"],
  );
  assert.strictEqual(snapshot.attachments.length, 0);
});
