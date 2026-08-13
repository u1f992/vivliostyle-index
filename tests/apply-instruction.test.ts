import assert from "node:assert";
import test from "node:test";

import {
  applyPageInstruction,
  applyRangeInstruction,
  applyReferenceInstruction,
} from "../src/apply-instruction.ts";
import { parseInstruction } from "../src/instruction.ts";
import type { Index } from "../src/model.ts";
import { dropSequences } from "./test-util.ts";

void test("applies page instructions", () => {
  const index: Index = { children: [] };
  const instruction = parseInstruction("し!じゆうりよう@自由利用|!");
  assert.strictEqual(instruction.type, "page");

  applyPageInstruction(index, instruction, "chapter.html#fair-use");

  assert.deepStrictEqual(dropSequences(index), {
    children: [
      {
        key: { html: "し", reading: "し" },
        children: [
          {
            key: { html: "自由利用", reading: "じゆうりよう" },
            children: [],
            locators: [{ locator: "chapter.html#fair-use", important: true }],
            see: [],
            seeAlso: [],
          },
        ],
      },
    ],
  });
});

void test("applies range instructions", () => {
  const index: Index = { children: [] };
  const instruction = parseInstruction("し!じゆうりよう@自由利用|(#end");
  assert.strictEqual(instruction.type, "range");

  applyRangeInstruction(index, instruction, "chapter.html#start", "chapter.html#end");

  assert.deepStrictEqual(dropSequences(index), {
    children: [
      {
        key: { html: "し", reading: "し" },
        children: [
          {
            key: { html: "自由利用", reading: "じゆうりよう" },
            children: [],
            locators: [
              {
                locator: { start: "chapter.html#start", end: "chapter.html#end" },
                important: false,
              },
            ],
            see: [],
            seeAlso: [],
          },
        ],
      },
    ],
  });
});

void test("applies reference instructions", () => {
  const index: Index = { children: [] };
  const instruction = parseInstruction("ち!ちょさくけん@著作権|=>ち!ちてきざいさんけん@知的財産権");
  assert.ok(instruction.type === "see" || instruction.type === "seeAlso");

  applyReferenceInstruction(index, instruction);

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
