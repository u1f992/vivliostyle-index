import assert from "node:assert";
import test from "node:test";

import { run, test as testCommand } from "../../src/command.ts";
import insertReference from "../../src/command/insert-reference.ts";
import { toHastChildren, type Index } from "../../src/model.ts";
import { dropSequentialId } from "../test-util.ts";

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
    !testCommand(
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

  assert.deepStrictEqual(dropSequentialId(index), {
    children: [
      {
        key: [toHastChildren("ち"), "ち"],
        children: [
          {
            key: [toHastChildren("著作権"), "ちょさくけん"],
            children: [],
            locators: [],
            see: [],
            seeAlso: [
              [
                [toHastChildren("ち"), "ち"],
                [toHastChildren("知的財産権"), "ちてきざいさんけん"],
              ],
            ],
          },
        ],
      },
    ],
  });
});
