import assert from "node:assert";
import test from "node:test";

import { run, test as testCommand } from "../../src/command.ts";
import {
  deleteRangeStore,
  insertRangeEnd,
  insertRangeStart,
} from "../../src/command/insert-range.ts";
import { toHastChildren, type Index } from "../../src/model.ts";
import { dropSequentialId } from "../test-util.ts";

void test("accepts range commands", () => {
  assert.ok(testCommand(insertRangeStart, "range,[[し,し],[自由利用,じゆうりよう]],r0"));
  assert.ok(
    testCommand(insertRangeStart, "range!,[[そ,そ],[相続,そうぞく],[相続人,そうぞくにん]],r0"),
  );
  assert.ok(!testCommand(insertRangeStart, "range,[し,[自由利用,じゆうりよう]],r0"));
  assert.ok(testCommand(insertRangeEnd, "/range,r0"));
});

void test("inserts a range locator", () => {
  const index: Index = { children: [] };
  const start = "range,[[し,し],[自由利用,じゆうりよう]],r0";
  const end = "/range,r0";

  assert.ok(testCommand(insertRangeStart, start));
  assert.ok(testCommand(insertRangeEnd, end));
  run(insertRangeStart, start, index, "chapter.html#start");
  run(insertRangeEnd, end, index, "chapter.html#end");
  deleteRangeStore(index);

  assert.deepStrictEqual(dropSequentialId(index), {
    children: [
      {
        key: [toHastChildren("し"), "し"],
        children: [
          {
            key: [toHastChildren("自由利用"), "じゆうりよう"],
            children: [],
            locators: [[["chapter.html#start", "chapter.html#end"], false]],
            see: [],
            seeAlso: [],
          },
        ],
      },
    ],
  });
});

void test("does not insert an unclosed range", (context) => {
  const warn = context.mock.method(console, "warn", () => {});
  const index: Index = { children: [] };
  const start = "range,[[し,し],[自由利用,じゆうりよう]],r0";

  assert.ok(testCommand(insertRangeStart, start));
  run(insertRangeStart, start, index, "chapter.html#start");
  deleteRangeStore(index);

  assert.deepStrictEqual(index.children, []);
  assert.strictEqual(warn.mock.callCount(), 1);
});

void test("does not insert a range without a start", (context) => {
  const warn = context.mock.method(console, "warn", () => {});
  const index: Index = { children: [] };
  const end = "/range,r0";

  assert.ok(testCommand(insertRangeEnd, end));
  run(insertRangeEnd, end, index, "chapter.html#end");

  assert.deepStrictEqual(index.children, []);
  assert.strictEqual(warn.mock.callCount(), 1);
});
