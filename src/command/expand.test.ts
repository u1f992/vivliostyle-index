import assert from "node:assert";
import test from "node:test";

import { test as testFn } from "../command.js";
import { default as expand } from "./expand.js";

void test("test", () => {
  assert.ok(testFn(expand, "expand,."));
});
