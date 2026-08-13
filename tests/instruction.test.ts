import assert from "node:assert";
import test from "node:test";

import {
  applyPageInstruction,
  applyRangeInstruction,
  applyReferenceInstruction,
  InstructionSyntaxError,
  parseInstruction,
} from "../src/instruction.ts";
import type { Index } from "../src/model.ts";

const group = { html: "グループ", reading: "ぐるーぷ" };
const entry = { html: "主見出し", reading: "しゅみだし" };
const subentry = { html: "副見出し", reading: "ふくみだし" };
const address = { group, entry, subentry };

void test("parses page instructions", () => {
  assert.deepStrictEqual(
    parseInstruction("ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し"),
    { type: "page", address },
  );
  assert.deepStrictEqual(
    parseInstruction(
      "ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し||<em><slot></slot></em>",
    ),
    { type: "page", address, template: "<em><slot></slot></em>" },
  );
});

void test("parses range instructions", () => {
  assert.deepStrictEqual(
    parseInstruction("ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|(path.md#fragment"),
    {
      type: "range",
      address,
      endReference: "path.md#fragment",
    },
  );
  assert.deepStrictEqual(
    parseInstruction(
      "ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|(path.md#fragment|<em><slot></slot></em>",
    ),
    {
      type: "range",
      address,
      endReference: "path.md#fragment",
      template: "<em><slot></slot></em>",
    },
  );
  assert.deepStrictEqual(parseInstruction("group!main|(#fragment"), {
    type: "range",
    address: {
      group: { html: "group", reading: "group" },
      entry: { html: "main", reading: "main" },
    },
    endReference: "#fragment",
  });
});

void test("parses see and see-also instructions", () => {
  const target = {
    group: { html: "別グループ", reading: "べつぐるーぷ" },
    entry: { html: "見出し語", reading: "みだしご" },
  };
  assert.deepStrictEqual(
    parseInstruction(
      "ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|->べつぐるーぷ@別グループ!みだしご@見出し語",
    ),
    { type: "see", address, target },
  );
  assert.deepStrictEqual(
    parseInstruction(
      "ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|=>べつぐるーぷ@別グループ!みだしご@見出し語",
    ),
    { type: "seeAlso", address, target },
  );
  assert.deepStrictEqual(
    parseInstruction("group!main|->target-group!target-main!target-subentry"),
    {
      type: "see",
      address: {
        group: { html: "group", reading: "group" },
        entry: { html: "main", reading: "main" },
      },
      target: {
        group: { html: "target-group", reading: "target-group" },
        entry: { html: "target-main", reading: "target-main" },
        subentry: { html: "target-subentry", reading: "target-subentry" },
      },
    },
  );
});

void test("uses an omitted display value as the reading and HTML", () => {
  assert.deepStrictEqual(parseInstruction("group!main"), {
    type: "page",
    address: {
      group: { html: "group", reading: "group" },
      entry: { html: "main", reading: "main" },
    },
  });
});

void test("unescapes an omitted display value into both the reading and HTML", () => {
  assert.deepStrictEqual(parseInstruction("a\\@b\\!c\\|d\\\\e!main"), {
    type: "page",
    address: {
      group: { html: "a@b!c|d\\e", reading: "a@b!c|d\\e" },
      entry: { html: "main", reading: "main" },
    },
  });
});

void test("preserves display values as HTML fragments", () => {
  assert.deepStrictEqual(
    parseInstruction(
      'き@<span data-symbol="\\@\\!\\|">き</span>!きょうとだいがく@<em>京都大学</em>',
    ),
    {
      type: "page",
      address: {
        group: {
          html: '<span data-symbol="@!|">き</span>',
          reading: "き",
        },
        entry: {
          html: "<em>京都大学</em>",
          reading: "きょうとだいがく",
        },
      },
    },
  );
  assert.deepStrictEqual(parseInstruction("g@<em>unclosed!main"), {
    type: "page",
    address: {
      group: { html: "<em>unclosed", reading: "g" },
      entry: { html: "main", reading: "main" },
    },
  });
});

void test("preserves HTML fragments at every entry position", () => {
  assert.deepStrictEqual(
    parseInstruction(
      "g@<\\!-- group --><b>G</b>!m@M&amp;M!s@<i>S</i>|->tg@<b>TG</b>!tm@<i>TM</i>!ts@<u>TS</u>",
    ),
    {
      type: "see",
      address: {
        group: { html: "<!-- group --><b>G</b>", reading: "g" },
        entry: { html: "M&amp;M", reading: "m" },
        subentry: { html: "<i>S</i>", reading: "s" },
      },
      target: {
        group: { html: "<b>TG</b>", reading: "tg" },
        entry: { html: "<i>TM</i>", reading: "tm" },
        subentry: { html: "<u>TS</u>", reading: "ts" },
      },
    },
  );
});

void test("normalizes readings and HTML to NFC", () => {
  const nfc = "é";
  const nfd = "e\u0301";

  assert.notStrictEqual(nfc, nfd);
  assert.deepStrictEqual(parseInstruction(`${nfd}@${nfd}!main`), {
    type: "page",
    address: {
      group: { html: nfc, reading: nfc },
      entry: { html: "main", reading: "main" },
    },
  });
});

void test("preserves surrounding whitespace and HTML line breaks", () => {
  assert.deepStrictEqual(parseInstruction(" group @<span>\nG\t</span>! main "), {
    type: "page",
    address: {
      group: { html: "<span>\nG\t</span>", reading: " group " },
      entry: { html: " main ", reading: " main " },
    },
  });
});

void test("unescapes metacharacters in readings and display values", () => {
  assert.deepStrictEqual(parseInstruction("よ\\@み@表\\@示\\!分類!主\\!見出し@主\\|表示\\|値"), {
    type: "page",
    address: {
      group: { html: "表@示!分類", reading: "よ@み" },
      entry: { html: "主|表示|値", reading: "主!見出し" },
    },
  });
});

void test("distinguishes escaped metacharacters at syntax boundaries", () => {
  assert.deepStrictEqual(parseInstruction("a\\@@\\@b!main"), {
    type: "page",
    address: {
      group: { html: "@b", reading: "a@" },
      entry: { html: "main", reading: "main" },
    },
  });
  assert.deepStrictEqual(parseInstruction("a\\!!\\!main"), {
    type: "page",
    address: {
      group: { html: "a!", reading: "a!" },
      entry: { html: "!main", reading: "!main" },
    },
  });
  assert.deepStrictEqual(parseInstruction("group!main\\|||<b><slot></slot></b>"), {
    type: "page",
    address: {
      group: { html: "group", reading: "group" },
      entry: { html: "main|", reading: "main|" },
    },
    template: "<b><slot></slot></b>",
  });
});

void test("accepts a template with any number of slots", () => {
  const address = {
    group: { html: "group", reading: "group" },
    entry: { html: "main", reading: "main" },
  };

  assert.deepStrictEqual(parseInstruction("group!main||"), {
    type: "page",
    address,
    template: "",
  });
  assert.deepStrictEqual(parseInstruction("group!main||<em>掲載略</em>"), {
    type: "page",
    address,
    template: "<em>掲載略</em>",
  });
  assert.deepStrictEqual(parseInstruction("group!main||<slot></slot><slot></slot>"), {
    type: "page",
    address,
    template: "<slot></slot><slot></slot>",
  });
});

void test("keeps a template running to the end of the instruction", () => {
  assert.deepStrictEqual(parseInstruction("group!main||<em>\\@\\!\\|\\\\<slot></slot></em>|x"), {
    type: "page",
    address: {
      group: { html: "group", reading: "group" },
      entry: { html: "main", reading: "main" },
    },
    template: "<em>@!|\\<slot></slot></em>|x",
  });
});

void test("reads a range end reference up to the template", () => {
  assert.deepStrictEqual(parseInstruction("group!main|(../章 @!.md?x=1&y=2+#終点)"), {
    type: "range",
    address: {
      group: { html: "group", reading: "group" },
      entry: { html: "main", reading: "main" },
    },
    endReference: "../章 @!.md?x=1&y=2+#終点)",
  });
  assert.deepStrictEqual(parseInstruction("group!main|(a\\@b\\!c\\\\d#end"), {
    type: "range",
    address: {
      group: { html: "group", reading: "group" },
      entry: { html: "main", reading: "main" },
    },
    endReference: "a@b!c\\d#end",
  });
  assert.deepStrictEqual(
    parseInstruction("group!main|(../章 @!\\|.md#終点|<em><slot></slot></em>"),
    {
      type: "range",
      address: {
        group: { html: "group", reading: "group" },
        entry: { html: "main", reading: "main" },
      },
      endReference: "../章 @!|.md#終点",
      template: "<em><slot></slot></em>",
    },
  );
});

void test("reads a reference target up to the template", () => {
  assert.deepStrictEqual(parseInstruction("group!main|->tg!tm|<em><slot></slot></em>"), {
    type: "see",
    address: {
      group: { html: "group", reading: "group" },
      entry: { html: "main", reading: "main" },
    },
    target: {
      group: { html: "tg", reading: "tg" },
      entry: { html: "tm", reading: "tm" },
    },
    template: "<em><slot></slot></em>",
  });
  assert.deepStrictEqual(parseInstruction("group!main|=>tg!tm\\|x"), {
    type: "seeAlso",
    address: {
      group: { html: "group", reading: "group" },
      entry: { html: "main", reading: "main" },
    },
    target: {
      group: { html: "tg", reading: "tg" },
      entry: { html: "tm|x", reading: "tm|x" },
    },
  });
});

void test("reports offsets in Intl en grapheme clusters", () => {
  assert.throws(
    () => parseInstruction("👨‍👩‍👧‍👦!é@"),
    (error: unknown) =>
      error instanceof InstructionSyntaxError &&
      error.offset === 4 &&
      error.message.includes("display value"),
  );
});

void test("handles long inputs without recursion", () => {
  const reading = "あ".repeat(100_000);
  const instruction = parseInstruction(`${reading}!main`);

  assert.strictEqual(instruction.address.group.reading, reading);
});

void test("rejects incomplete and structurally invalid instructions", () => {
  const invalidInstructions = [
    "",
    "group",
    "group!",
    "group!!main",
    "@group!main",
    "group@!main",
    "group@display@again!main",
    "group!main!subentry!fourth",
    "group!main|",
    "group!main|(",
    "group!main|!unexpected",
    "group!main|->group",
    "group!main|=>group!",
    "group!main|-",
    "group!main|->",
    "group!main|=",
    "group!main|=>",
    "group!main|unknown",
    "group!main|!(",
    "group\\",
    "group\\x!main",
    "group!main||<em><slot></slot></em>\\",
    "group!main|(#end\\",
  ];

  for (const instruction of invalidInstructions) {
    assert.throws(() => parseInstruction(instruction), InstructionSyntaxError, instruction);
  }
});

void test("reports the exact grapheme offset of a forbidden reference character", () => {
  assert.throws(
    () => parseInstruction("g!m|(👨‍👩‍👧‍👦a\u0000#x"),
    (error: unknown) => error instanceof InstructionSyntaxError && error.offset === 7,
  );
});

void test("rejects blank values and forbidden control characters", () => {
  const invalidInstructions = [
    "   !main",
    "group!\t",
    "group@   !main",
    "group\nname!main",
    "group!main\u0000",
    "group!main|(path\u0000#end",
    "group!main||<em>\u0000<slot></slot></em>",
  ];

  for (const instruction of invalidInstructions) {
    assert.throws(() => parseInstruction(instruction), InstructionSyntaxError, instruction);
  }
});

void test("applies page instructions", () => {
  const index: Index = { children: [] };
  const instruction = parseInstruction("し!じゆうりよう@自由利用||<strong><slot></slot></strong>");
  assert.strictEqual(instruction.type, "page");

  applyPageInstruction(index, instruction, "chapter.html#fair-use");

  assert.deepStrictEqual(index, {
    children: [
      {
        key: { html: "し", reading: "し" },
        children: [
          {
            key: { html: "自由利用", reading: "じゆうりよう" },
            children: [],
            locators: [
              {
                location: "chapter.html#fair-use",
                template: "<strong><slot></slot></strong>",
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

void test("applies range instructions", () => {
  const index: Index = { children: [] };
  const instruction = parseInstruction("し!じゆうりよう@自由利用|(#end");
  assert.strictEqual(instruction.type, "range");

  applyRangeInstruction(index, instruction, "chapter.html#start", "chapter.html#end");

  assert.deepStrictEqual(index, {
    children: [
      {
        key: { html: "し", reading: "し" },
        children: [
          {
            key: { html: "自由利用", reading: "じゆうりよう" },
            children: [],
            locators: [
              {
                location: { start: "chapter.html#start", end: "chapter.html#end" },
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

void test("applies the template of a range instruction", () => {
  const index: Index = { children: [] };
  const instruction = parseInstruction("し!じゆうりよう@自由利用|(#end|<em><slot></slot></em>");
  assert.strictEqual(instruction.type, "range");

  applyRangeInstruction(index, instruction, "chapter.html#start", "chapter.html#end");

  assert.deepStrictEqual(index.children[0]?.children[0]?.locators, [
    {
      location: { start: "chapter.html#start", end: "chapter.html#end" },
      template: "<em><slot></slot></em>",
    },
  ]);
});

void test("applies reference instructions", () => {
  const index: Index = { children: [] };
  const instruction = parseInstruction("ち!ちょさくけん@著作権|=>ち!ちてきざいさんけん@知的財産権");
  assert.ok(instruction.type === "see" || instruction.type === "seeAlso");

  applyReferenceInstruction(index, instruction);

  assert.deepStrictEqual(index, {
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
                  entry: { html: "知的財産権", reading: "ちてきざいさんけん" },
                },
              },
            ],
          },
        ],
      },
    ],
  });
});

void test("applies the template of a reference instruction", () => {
  const index: Index = { children: [] };
  const instruction = parseInstruction(
    "ち!ちょさくけん@著作権|->ち!ちてきざいさんけん@知的財産権|<em><slot></slot></em>",
  );
  assert.ok(instruction.type === "see" || instruction.type === "seeAlso");

  applyReferenceInstruction(index, instruction);

  assert.deepStrictEqual(index.children[0]?.children[0]?.see, [
    {
      target: {
        group: { html: "ち", reading: "ち" },
        entry: { html: "知的財産権", reading: "ちてきざいさんけん" },
      },
      template: "<em><slot></slot></em>",
    },
  ]);
});
