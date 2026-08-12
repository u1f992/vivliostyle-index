import assert from "node:assert";
import test from "node:test";

import { test as testFn } from "../../src/command.ts";
import { default as expand } from "../../src/command/expand.ts";

void test("test", () => {
  assert.ok(testFn(expand, "expand,."));
});
