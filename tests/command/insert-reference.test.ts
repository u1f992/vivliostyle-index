import assert from "node:assert";
import test from "node:test";

import { run, test as testCommand } from "../../src/command.ts";
import insertReference from "../../src/command/insert-reference.ts";
import type { Index } from "../../src/model.ts";
import { dropSequences } from "../test-util.ts";

void test("accepts main-entry and subentry references", () => {
  assert.ok(
    testCommand(
      insertReference,
      "see,[[ち,ち],[著作権,ちょさくけん]],[[ち,ち],[知的財産権,ちてきざいさんけん]]",
    ),
  );
  assert.ok(
    testCommand(
      insertReference,
      "seeAlso,[[ち,ち],[著作権,ちょさくけん],[――の相続,ちょさくけんのそうぞく]],[[そ,そ],[相続,そうぞく],[一身専属,いっしんせんぞく]]",
    ),
  );
  assert.ok(
    testCommand(
      insertReference,
      "see,[ち,[著作権,ちょさくけん]],[[ち,ち],[知的財産権,ちてきざいさんけん]]",
    ),
  );
});

void test("inserts a reference", () => {
  const index: Index = { children: [] };
  const input = "seeAlso,[[ち,ち],[著作権,ちょさくけん]],[[ち,ち],[知的財産権,ちてきざいさんけん]]";

  assert.ok(testCommand(insertReference, input));
  run(insertReference, input, index, "");

  assert.deepStrictEqual(dropSequences(index), {
    children: [
      {
        key: { html: "ち", reading: "ち" },
        children: [
          {
            key: { html: "著作権", reading: "ちょさくけん" },
            children: [],
            locators: [],
            see: [],
            seeAlso: [
              {
                target: {
                  group: { html: "ち", reading: "ち" },
                  mainEntry: { html: "知的財産権", reading: "ちてきざいさんけん" },
                },
              },
            ],
          },
        ],
      },
    ],
  });
});
