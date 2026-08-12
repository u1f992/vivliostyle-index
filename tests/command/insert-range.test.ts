import type * as hast from "hast";
import assert from "node:assert";
import test from "node:test";

import { test as testFn, run } from "../../src/command.ts";
import {
  insertRangeStart,
  insertRangeEnd,
  deleteRangeStore,
} from "../../src/command/insert-range.ts";
import { dropSequentialId } from "../test-util.ts";
import { toHastChildren, type Index } from "../../src/model.ts";

void test("test", () => {
  assert.ok(testFn(insertRangeStart, "range,.,[[し,し],[自由利用,じゆうりよう]],r0"));
  assert.ok(testFn(insertRangeStart, "range,.,[[そ,そ],[相続,そうぞく],[相続人,そうぞくにん]],r0"));
  assert.ok(testFn(insertRangeStart, "range!,.,[[し,し],[自由利用,じゆうりよう]],r0"));
  assert.ok(
    testFn(insertRangeStart, "range!,.,[[そ,そ],[相続,そうぞく],[相続人,そうぞくにん]],r0"),
  );
  assert.ok(!testFn(insertRangeStart, "range,.,[し,[自由利用,じゆうりよう]],r0"));
  assert.ok(testFn(insertRangeEnd, "/range,r0"));
});

void test("insert a main entry", () => {
  const indexes: Index[] = [];
  const startElem: hast.Element = {
    type: "element",
    tagName: "span",
    children: [],
  };
  const endElem: hast.Element = {
    type: "element",
    tagName: "span",
    children: [],
  };
  const tree: hast.Root = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "html",
        children: [{ type: "element", tagName: "body", children: [startElem, endElem] }],
      },
    ],
  };
  run(
    insertRangeStart,
    // @ts-expect-error branded
    "range,.,[[し,し],[自由利用,じゆうりよう]],r0",
    indexes,
    tree,
    startElem,
    null,
  );
  run(
    insertRangeEnd,
    // @ts-expect-error branded
    "/range,r0",
    indexes,
    tree,
    endElem,
    null,
  );
  deleteRangeStore(indexes);
  assert.deepStrictEqual(dropSequentialId(indexes), [
    {
      id: ".",
      children: [
        {
          key: [toHastChildren("し"), "し"],
          children: [
            {
              key: [toHastChildren("自由利用"), "じゆうりよう"],
              children: [],
              locators: [
                [["#%2Fhtml%2Fbody%2Fspan%5B1%5D", "#%2Fhtml%2Fbody%2Fspan%5B2%5D"], false],
              ],
              see: [],
              seeAlso: [],
            },
          ],
        },
      ],
    },
  ]);
});

void test("insert a locator to an existing main entry", () => {
  const indexes: Index[] = [
    {
      id: ".",
      children: [
        {
          key: [toHastChildren("し"), "し"],
          children: [
            {
              key: [toHastChildren("自由利用"), "じゆうりよう"],
              children: [],
              locators: [
                [
                  // @ts-expect-error branded
                  "",
                  ["test", "test"],
                  false,
                ],
              ],
              see: [],
              seeAlso: [],
            },
          ],
        },
      ],
    },
  ];
  const startElem: hast.Element = {
    type: "element",
    tagName: "span",
    children: [],
  };
  const endElem: hast.Element = {
    type: "element",
    tagName: "span",
    children: [],
  };
  const tree: hast.Root = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "html",
        children: [{ type: "element", tagName: "body", children: [startElem, endElem] }],
      },
    ],
  };
  run(
    insertRangeStart,
    // @ts-expect-error branded
    "range,.,[[し,し],[自由利用,じゆうりよう]],r0",
    indexes,
    tree,
    startElem,
    null,
  );
  run(
    insertRangeEnd,
    // @ts-expect-error branded
    "/range,r0",
    indexes,
    tree,
    endElem,
    null,
  );
  deleteRangeStore(indexes);
  assert.deepStrictEqual(dropSequentialId(indexes), [
    {
      id: ".",
      children: [
        {
          key: [toHastChildren("し"), "し"],
          children: [
            {
              key: [toHastChildren("自由利用"), "じゆうりよう"],
              children: [],
              locators: [
                [["test", "test"], false],
                [["#%2Fhtml%2Fbody%2Fspan%5B1%5D", "#%2Fhtml%2Fbody%2Fspan%5B2%5D"], false],
              ],
              see: [],
              seeAlso: [],
            },
          ],
        },
      ],
    },
  ]);
});

void test("insert a subentry", () => {
  const indexes: Index[] = [];
  const startElem: hast.Element = {
    type: "element",
    tagName: "span",
    children: [],
  };
  const endElem: hast.Element = {
    type: "element",
    tagName: "span",
    children: [],
  };
  const tree: hast.Root = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "html",
        children: [{ type: "element", tagName: "body", children: [startElem, endElem] }],
      },
    ],
  };
  run(
    insertRangeStart,
    // @ts-expect-error branded
    "range,.,[[そ,そ],[相続,そうぞく],[一身専属,いっしんせんぞく]],r0",
    indexes,
    tree,
    startElem,
    null,
  );
  run(
    insertRangeEnd,
    // @ts-expect-error branded
    "/range,r0",
    indexes,
    tree,
    endElem,
    null,
  );
  deleteRangeStore(indexes);
  assert.deepStrictEqual(dropSequentialId(indexes), [
    {
      id: ".",
      children: [
        {
          key: [toHastChildren("そ"), "そ"],
          children: [
            {
              key: [toHastChildren("相続"), "そうぞく"],
              children: [
                {
                  key: [toHastChildren("一身専属"), "いっしんせんぞく"],
                  locators: [
                    [["#%2Fhtml%2Fbody%2Fspan%5B1%5D", "#%2Fhtml%2Fbody%2Fspan%5B2%5D"], false],
                  ],
                  see: [],
                  seeAlso: [],
                },
              ],
              locators: [],
              see: [],
              seeAlso: [],
            },
          ],
        },
      ],
    },
  ]);
});

void test("rangeStart only - no locators added", () => {
  const indexes: Index[] = [];
  const startElem: hast.Element = {
    type: "element",
    tagName: "span",
    children: [],
  };
  const tree: hast.Root = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "html",
        children: [{ type: "element", tagName: "body", children: [startElem] }],
      },
    ],
  };
  run(
    insertRangeStart,
    // @ts-expect-error branded
    "range,.,[[し,し],[自由利用,じゆうりよう]],r0",
    indexes,
    tree,
    startElem,
    null,
  );
  deleteRangeStore(indexes);
  assert.deepStrictEqual(dropSequentialId(indexes), []);
});

void test("rangeEnd only - no locators added", () => {
  const indexes: Index[] = [];
  const endElem: hast.Element = {
    type: "element",
    tagName: "span",
    children: [],
  };
  const tree: hast.Root = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "html",
        children: [{ type: "element", tagName: "body", children: [endElem] }],
      },
    ],
  };
  run(
    insertRangeEnd,
    // @ts-expect-error branded
    "/range,r0",
    indexes,
    tree,
    endElem,
    null,
  );
  assert.deepStrictEqual(dropSequentialId(indexes), []);
});
