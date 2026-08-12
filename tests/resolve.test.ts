import assert from "node:assert";
import test from "node:test";

import { toHastChildren, type Index } from "../src/model.ts";
import { validateReferences } from "../src/resolve.ts";

function createIndex(targetWord: string): Index {
  return {
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
  };
}

void test("accepts references to registered entries", () => {
  assert.deepStrictEqual(validateReferences(createIndex("知的財産権")), []);
});

void test("reports references to unregistered entries", () => {
  assert.strictEqual(validateReferences(createIndex("工業所有権")).length, 1);
});

void test("reports a reference that uses different inner HTML", () => {
  assert.strictEqual(validateReferences(createIndex("<em>知的財産権</em>")).length, 1);
});
