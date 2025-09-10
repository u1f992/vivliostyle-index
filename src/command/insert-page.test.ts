import assert from "node:assert";
import test from "node:test";

import { test as testFn } from "../command.js";
import { default as insertPage } from "./insert-page.js";

test("test", () => {
  assert.ok(testFn(insertPage, ".,[し,自由利用]"));
  assert.ok(
    testFn(insertPage, ".,[そ,[相続,そうぞく],[一身専属,いっしんせんぞく]]"),
  );
  assert.ok(testFn(insertPage, "page!,.,[し,自由利用]"));
  assert.ok(
    testFn(
      insertPage,
      "page!,.,[そ,[相続,そうぞく],[一身専属,いっしんせんぞく]]",
    ),
  );

  assert.ok(testFn(insertPage, ".,[null,自由利用]"));
  assert.ok(testFn(insertPage, ".,[[null,し],自由利用]"));
  assert.ok(testFn(insertPage, ".,[し,null]"));
  assert.ok(testFn(insertPage, ".,[し,[null,じゆうりよう]]"));
  assert.ok(testFn(insertPage, ".,[そ,相続,null]"));
  assert.ok(testFn(insertPage, ".,[そ,相続,[null,いっしんせんぞく]]"));
});
