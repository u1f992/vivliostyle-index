import type * as hast from "hast";
import assert from "node:assert";
import test from "node:test";

import { run, test as testFn } from "../../src/command.ts";
import { default as insertReference } from "../../src/command/insert-reference.ts";
import { toHastChildren, type Index } from "../../src/model.ts";
import { dropSequentialId } from "../test-util.ts";

void test("test", () => {
  assert.ok(
    testFn(
      insertReference,
      "see,.,[[ち,ち],[著作権,ちょさくけん]],[[ち,ち],[知的財産権,ちてきざいさんけん]]",
    ),
  );
  assert.ok(
    testFn(
      insertReference,
      "see,.,[[ち,ち],[著作権,ちょさくけん],[――の相続,ちょさくけんのそうぞく]],[[そ,そ],[相続,そうぞく],[一身専属,いっしんせんぞく]]",
    ),
  );
  assert.ok(
    testFn(
      insertReference,
      "seeAlso,.,[[ち,ち],[著作権,ちょさくけん]],[[ち,ち],[知的財産権,ちてきざいさんけん]]",
    ),
  );
  assert.ok(
    testFn(
      insertReference,
      "seeAlso,.,[[ち,ち],[著作権,ちょさくけん],[――の相続,ちょさくけんのそうぞく]],[[そ,そ],[相続,そうぞく],[一身専属,いっしんせんぞく]]",
    ),
  );
  assert.ok(
    !testFn(
      insertReference,
      "see,.,[ち,[著作権,ちょさくけん]],[[ち,ち],[知的財産権,ちてきざいさんけん]]",
    ),
  );
});

void test("insert a main entry", () => {
  const indexes: Index[] = [];
  const targetElem: hast.Element = {
    type: "element",
    tagName: "div",
    children: [],
  };
  const tree: hast.Root = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "html",
        children: [{ type: "element", tagName: "body", children: [targetElem] }],
      },
    ],
  };
  run(
    insertReference,
    // @ts-expect-error branded
    "seeAlso,.,[[ち,ち],[著作権,ちょさくけん]],[[ち,ち],[知的財産権,ちてきざいさんけん]]",
    indexes,
    tree,
    targetElem,
    null,
  );
  assert.deepStrictEqual(dropSequentialId(indexes), [
    {
      id: ".",
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
    },
  ]);
});
