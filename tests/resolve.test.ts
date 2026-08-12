import assert from "node:assert";
import test from "node:test";

import { toHastChildren, type Index } from "../src/model.ts";
import { validateReferences } from "../src/resolve.ts";

function createIndexes(targetWord: string): Index[] {
  return [
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
                  "",
                  [toHastChildren("ち"), "ち"],
                  [toHastChildren(targetWord), "ちてきざいさんけん"],
                ] as never,
              ],
            },
          ],
        },
      ],
    },
  ];
}

void test("accept references to registered entries", (context) => {
  const warn = context.mock.method(console, "warn");

  validateReferences(createIndexes("知的財産権"));

  assert.strictEqual(warn.mock.callCount(), 0);
});

void test("warn about references to unregistered entries", (context) => {
  const warn = context.mock.method(console, "warn", () => {});

  validateReferences(createIndexes("工業所有権"));

  assert.strictEqual(warn.mock.callCount(), 1);
});

void test("warn when a reference uses different inner HTML", (context) => {
  const warn = context.mock.method(console, "warn", () => {});

  validateReferences(createIndexes("<em>知的財産権</em>"));

  assert.strictEqual(warn.mock.callCount(), 1);
});
