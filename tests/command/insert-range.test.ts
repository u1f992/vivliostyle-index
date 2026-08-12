import assert from "node:assert";
import test from "node:test";

import { run, test as testCommand } from "../../src/command.ts";
import { insertRange } from "../../src/command/insert-range.ts";
import type { Index } from "../../src/model.ts";
import { dropSequences } from "../test-util.ts";

void test("accepts range commands", () => {
  assert.ok(testCommand(insertRange, "range,[[し,し],[自由利用,じゆうりよう]],'#end'"));
  assert.ok(
    testCommand(insertRange, "range!,[[そ,そ],[相続,そうぞく],[相続人,そうぞくにん]],next.md#end"),
  );
  assert.ok(testCommand(insertRange, "range,[し,[自由利用,じゆうりよう]],'#end'"));
  assert.ok(!testCommand(insertRange, "/range,r0"));
});

void test("inserts a range locator", () => {
  const index: Index = { children: [] };
  const command = "range,[[し,し],[自由利用,じゆうりよう]],'#end'";

  assert.ok(testCommand(insertRange, command));
  run(insertRange, command, index, "chapter.html#start", "chapter.html#end");

  assert.deepStrictEqual(dropSequences(index), {
    children: [
      {
        key: { html: "し", reading: "し" },
        children: [
          {
            key: { html: "自由利用", reading: "じゆうりよう" },
            children: [],
            locators: [
              {
                locator: { start: "chapter.html#start", end: "chapter.html#end" },
                important: false,
              },
            ],
            see: [],
            seeAlso: [],
          },
        ],
      },
    ],
  });
});
