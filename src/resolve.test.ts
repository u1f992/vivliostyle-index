import assert from "node:assert";
import test from "node:test";

import { resolve } from "./resolve.js";
import { dropSequentialId } from "./test-util.js";
import { toHastChildren } from "./model.js";

test("fill group key", () => {
  assert.deepStrictEqual(
    dropSequentialId(
      resolve([
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
                      // @ts-expect-error sequentialId
                      locators: [["", "startId", false]],
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
      ]),
    ),
    [
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
                    locators: [["startId", false]],
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
    ],
  );
});

test("fill seeAlso", () => {
  assert.deepStrictEqual(
    dropSequentialId(
      resolve([
        {
          id: ".",
          children: [
            {
              key: [toHastChildren("ち"), null],
              children: [
                {
                  key: [toHastChildren("知的財産権"), "ちてきざいさんけん"],
                  children: [],
                  locators: [],
                  see: [],
                  seeAlso: [],
                },
                {
                  key: [toHastChildren("著作権"), "ちょさくけん"],
                  children: [],
                  locators: [],
                  see: [],
                  seeAlso: [
                    [
                      // @ts-expect-error sequentialId
                      "",
                      [toHastChildren("ち"), null],
                      [toHastChildren("知的財産権"), null],
                    ],
                  ],
                },
              ],
            },
          ],
        },
      ]),
    ),
    [
      {
        id: ".",
        children: [
          {
            key: [toHastChildren("ち"), "ち"],
            children: [
              {
                key: [toHastChildren("知的財産権"), "ちてきざいさんけん"],
                children: [],
                locators: [],
                see: [],
                seeAlso: [],
              },
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
    ],
  );
});
