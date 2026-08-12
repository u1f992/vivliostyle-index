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

void test("accepts references to registered entries", (context) => {
  const warn = context.mock.method(console, "warn");

  validateReferences(createIndex("知的財産権"));

  assert.strictEqual(warn.mock.callCount(), 0);
});

void test("warns about references to unregistered entries", (context) => {
  const warn = context.mock.method(console, "warn", () => {});

  validateReferences(createIndex("工業所有権"));

  assert.strictEqual(warn.mock.callCount(), 1);
});

void test("warns when a reference uses different inner HTML", (context) => {
  const warn = context.mock.method(console, "warn", () => {});

  validateReferences(createIndex("<em>知的財産権</em>"));

  assert.strictEqual(warn.mock.callCount(), 1);
});
