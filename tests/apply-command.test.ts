import assert from "node:assert";
import test from "node:test";

import {
  applyPageCommand,
  applyRangeCommand,
  applyReferenceCommand,
} from "../src/apply-command.ts";
import { parseCommand } from "../src/command-parser.ts";
import type { Index } from "../src/model.ts";
import { dropSequences } from "./test-util.ts";

void test("applies page commands", () => {
  const index: Index = { children: [] };
  const command = parseCommand("し!じゆうりよう@自由利用|!");
  assert.strictEqual(command.type, "page");

  applyPageCommand(index, command, "chapter.html#fair-use");

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

void test("applies range commands", () => {
  const index: Index = { children: [] };
  const command = parseCommand("し!じゆうりよう@自由利用|(#end");
  assert.strictEqual(command.type, "range");

  applyRangeCommand(index, command, "chapter.html#start", "chapter.html#end");

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

void test("applies reference commands", () => {
  const index: Index = { children: [] };
  const command = parseCommand("ち!ちょさくけん@著作権|=>ち!ちてきざいさんけん@知的財産権");
  assert.ok(command.type === "see" || command.type === "seeAlso");

  applyReferenceCommand(index, command);

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
