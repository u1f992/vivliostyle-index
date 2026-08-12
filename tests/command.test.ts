import assert from "node:assert";
import test from "node:test";

import { run, test as testCommand } from "../src/command.ts";
import insertPage from "../src/command/insert-page.ts";
import type { Index } from "../src/model.ts";

void test("inserts the supplied locator URL", () => {
  const input = "[[R,R],[RPA,RPA]]";
  const index: Index = { children: [] };

  assert.ok(testCommand(insertPage, input));
  run(insertPage, input, index, "chapter.html#RPA");

  assert.strictEqual(index.children[0]?.children[0]?.locators[0]?.locator, "chapter.html#RPA");
});

void test("uses a string key as both its heading and sort value", () => {
  const input = "[R,RPA]";
  const index: Index = { children: [] };

  assert.ok(testCommand(insertPage, input));
  run(insertPage, input, index, "chapter.html#RPA");

  assert.deepStrictEqual(index.children[0]?.key, { html: "R", reading: "R" });
  assert.deepStrictEqual(index.children[0]?.children[0]?.key, { html: "RPA", reading: "RPA" });
});

void test("keeps original HTML fragments as distinct keys", () => {
  const index: Index = { children: [] };
  const lowercase = "[[R,R],['<em>RPA</em>',RPA]]";
  const uppercase = "[[R,R],['<EM>RPA</EM>',RPA]]";

  assert.ok(testCommand(insertPage, lowercase));
  assert.ok(testCommand(insertPage, uppercase));
  run(insertPage, lowercase, index, "chapter.html#lowercase");
  run(insertPage, uppercase, index, "chapter.html#uppercase");

  assert.deepStrictEqual(
    index.children[0]?.children.map((entry) => entry.key),
    [
      { html: "<em>RPA</em>", reading: "RPA" },
      { html: "<EM>RPA</EM>", reading: "RPA" },
    ],
  );
});
