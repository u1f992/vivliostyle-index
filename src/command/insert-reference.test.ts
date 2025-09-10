import type * as hast from "hast";
import assert from "node:assert";
import test from "node:test";

import { run, test as testFn } from "../command.js";
import { default as insertReference } from "./insert-reference.js";
import { toHastChildren, type Index, type Key } from "../model.js";
import { dropSequentialId } from "../test-util.js";

test("test", () => {
  assert.ok(
    testFn(
      insertReference,
      "see,.,[ち,[著作権,ちょさくけん]],[ち,[知的財産権,ちてきざいさんけん]]",
    ),
  );
  assert.ok(
    testFn(
      insertReference,
      "see,.,[ち,著作権,[――の相続,ちょさくけんのそうぞく]],[そ,相続,一身専属]",
    ),
  );
  assert.ok(
    testFn(
      insertReference,
      "seeAlso,.,[ち,[著作権,ちょさくけん]],[ち,[知的財産権,ちてきざいさんけん]]",
    ),
  );
  assert.ok(
    testFn(
      insertReference,
      "seeAlso,.,[ち,著作権,[――の相続,ちょさくけんのそうぞく]],[そ,相続,一身専属]",
    ),
  );
});

test("insert a main entry", () => {
  const indexes: Index<Key>[] = [];
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
        children: [
          { type: "element", tagName: "body", children: [targetElem] },
        ],
      },
    ],
  };
  run(
    insertReference,
    // @ts-expect-error branded
    "seeAlso,.,[ち,[著作権,ちょさくけん]],[ち,[知的財産権,ちてきざいさんけん]]",
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
          key: [toHastChildren("ち"), null],
          children: [
            {
              key: [toHastChildren("著作権"), "ちょさくけん"],
              children: [],
              locators: [],
              see: [],
              seeAlso: [
                [
                  [toHastChildren("ち"), null],
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
