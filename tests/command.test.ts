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

  assert.strictEqual(index.children[0]?.children[0]?.locators[0]?.[1], "chapter.html#RPA");
});
