import type * as hast from "hast";
import assert from "node:assert";
import test from "node:test";

import { test as testFn, run } from "../command.js";
import {
  insertRangeStart,
  insertRangeEnd,
  deleteRangeStore,
} from "./insert-range.js";
import { dropSequentialId } from "../test-util.js";
import { toHastChildren, type Index, type Key } from "../model.js";

test("test", () => {
  assert.ok(
    testFn(insertRangeStart, "range,.,[し,[自由利用,じゆうりよう]],r0"),
  );
  assert.ok(
    testFn(insertRangeStart, "range,.,[そ,相続,[相続人,そうぞくにん]],r0"),
  );
  assert.ok(
    testFn(insertRangeStart, "range!,.,[し,[自由利用,じゆうりよう]],r0"),
  );
  assert.ok(
    testFn(insertRangeStart, "range!,.,[そ,相続,[相続人,そうぞくにん]],r0"),
  );
  assert.ok(testFn(insertRangeEnd, "/range,r0"));
});

test("insert a main entry", () => {
  const indexes: Index<Key>[] = [];
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
        children: [
          { type: "element", tagName: "body", children: [startElem, endElem] },
        ],
      },
    ],
  };
  run(
    insertRangeStart,
    // @ts-expect-error branded
    "range,.,[し,[自由利用,じゆうりよう]],r0",
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
          key: [toHastChildren("し"), null],
          children: [
            {
              key: [toHastChildren("自由利用"), "じゆうりよう"],
              children: [],
              locators: [[["/html/body/span[1]", "/html/body/span[2]"], false]],
              see: [],
              seeAlso: [],
            },
          ],
        },
      ],
    },
  ]);
});

test("insert a locator to an existing main entry", () => {
  const indexes: Index<Key>[] = [
    {
      id: ".",
      children: [
        {
          key: [toHastChildren("し"), null],
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
        children: [
          { type: "element", tagName: "body", children: [startElem, endElem] },
        ],
      },
    ],
  };
  run(
    insertRangeStart,
    // @ts-expect-error branded
    "range,.,[し,[自由利用,じゆうりよう]],r0",
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
          key: [toHastChildren("し"), null],
          children: [
            {
              key: [toHastChildren("自由利用"), "じゆうりよう"],
              children: [],
              locators: [
                [["test", "test"], false],
                [["/html/body/span[1]", "/html/body/span[2]"], false],
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

test("insert a subentry", () => {
  const indexes: Index<Key>[] = [];
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
        children: [
          { type: "element", tagName: "body", children: [startElem, endElem] },
        ],
      },
    ],
  };
  run(
    insertRangeStart,
    // @ts-expect-error branded
    "range,.,[そ,[相続,そうぞく],[一身専属,いっしんせんぞく]],r0",
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
          key: [toHastChildren("そ"), null],
          children: [
            {
              key: [toHastChildren("相続"), "そうぞく"],
              children: [
                {
                  key: [toHastChildren("一身専属"), "いっしんせんぞく"],
                  locators: [
                    [["/html/body/span[1]", "/html/body/span[2]"], false],
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

test("rangeStart only - no locators added", () => {
  const indexes: Index<Key>[] = [];
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
    "range,.,[し,[自由利用,じゆうりよう]],r0",
    indexes,
    tree,
    startElem,
    null,
  );
  deleteRangeStore(indexes);
  assert.deepStrictEqual(dropSequentialId(indexes), []);
});

test("rangeEnd only - no locators added", () => {
  const indexes: Index<Key>[] = [];
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
