import assert from "node:assert";
import test from "node:test";

import { test as testFn } from "../../src/command.ts";
import { default as insertPage } from "../../src/command/insert-page.ts";

void test("test", () => {
  assert.ok(testFn(insertPage, "[[し,し],[自由利用,じゆうりよう]]"));
  assert.ok(testFn(insertPage, "[[そ,そ],[相続,そうぞく],[一身専属,いっしんせんぞく]]"));
  assert.ok(testFn(insertPage, "page!,[[し,し],[自由利用,じゆうりよう]]"));
  assert.ok(testFn(insertPage, "page!,[[そ,そ],[相続,そうぞく],[一身専属,いっしんせんぞく]]"));

  assert.ok(!testFn(insertPage, "[し,自由利用]"));
  assert.ok(!testFn(insertPage, "[[null,し],[自由利用,じゆうりよう]]"));
  assert.ok(!testFn(insertPage, "[[し,し],[自由利用,null]]"));
});
