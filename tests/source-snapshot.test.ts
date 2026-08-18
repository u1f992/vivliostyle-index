import assert from "node:assert";
import test from "node:test";

import { fromHtml } from "hast-util-from-html";
import { getAttribute } from "hast-util-get-attribute";
import { select } from "hast-util-select";

import { collectSourceSnapshot } from "../src/source-snapshot.ts";
import { identityTemplate } from "../src/template.ts";

void test("extracts instructions, targets, locations, and element IDs", () => {
  const root = fromHtml(
    '<span data-index="index.md?q=a%5C%40b!Apple|(#index"></span><i id="end" data-index="index.md?q=a%5C%40b!Apple|)#index"></i>',
  );

  const snapshot = collectSourceSnapshot(root, "/publication/chapter.md");

  assert.strictEqual(snapshot.messages.length, 0);
  assert.strictEqual(snapshot.attachments.length, 2);
  assert.deepStrictEqual(snapshot.attachments[0], {
    sourcePath: "/publication/chapter.md",
    sourceId: "/html/body/span",
    target: { path: "/publication/index.md", id: "index" },
    targetKey: '["/publication/index.md","index"]',
    instruction: {
      type: "range-start",
      address: {
        group: { html: "a@b", reading: "a@b" },
        entry: { html: "Apple", reading: "Apple" },
      },
      template: identityTemplate,
    },
    locationHref: "chapter.html#%2Fhtml%2Fbody%2Fspan",
  });
  assert.deepStrictEqual(snapshot.attachments[1], {
    sourcePath: "/publication/chapter.md",
    sourceId: "end",
    target: { path: "/publication/index.md", id: "index" },
    targetKey: '["/publication/index.md","index"]',
    instruction: {
      type: "range-end",
      address: {
        group: { html: "a@b", reading: "a@b" },
        entry: { html: "Apple", reading: "Apple" },
      },
    },
    locationHref: "chapter.html#end",
  });
  assert.deepStrictEqual(snapshot.ids, ["/html/body/span", "end"]);
  const source = select("[data-index]", root);
  assert.ok(source);
  assert.strictEqual(getAttribute(source, "id"), "/html/body/span");
});

void test("warns once for each id a document repeats", () => {
  const root = fromHtml('<i id="twice"></i><i id="twice"></i><i id="twice"></i><i id="once"></i>');

  const snapshot = collectSourceSnapshot(root, "/publication/chapter.md");

  assert.deepStrictEqual(
    snapshot.messages.map((message) => message[2]?.split(":")[1]),
    ["duplicate-id"],
  );
  assert.match(String(snapshot.messages[0]?.[0]), /"twice"/);
  assert.deepStrictEqual(snapshot.ids, ["twice", "twice", "twice", "once"]);
});

void test("reports invalid references and instructions", () => {
  const root = fromHtml(
    [
      '<span data-index="https://example.test/index.md?q=a!Apple#index"></span>',
      '<span data-index="index.md?q=%5B#index"></span>',
      '<span data-index="index.md?q=a!Apple|see{b!Banana#index"></span>',
      '<span data-index="index.md?q=a!Apple"></span>',
      '<span data-index="index.md#index"></span>',
    ].join(""),
  );

  const snapshot = collectSourceSnapshot(root, "/publication/chapter.md");

  assert.deepStrictEqual(
    snapshot.messages.map((message) => message[2]?.split(":")[1]),
    [
      "invalid-index-reference",
      "instruction-parse-error",
      "instruction-parse-error",
      "missing-target-fragment",
      "missing-instruction",
    ],
  );
  assert.strictEqual(snapshot.attachments.length, 0);
});
