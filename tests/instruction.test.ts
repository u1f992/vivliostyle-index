import assert from "node:assert";
import test from "node:test";

import {
  applyPageInstruction,
  applyRangeInstruction,
  applyXrefInstruction,
  InstructionSyntaxError,
  parseInstruction,
} from "../src/instruction.ts";
import { createIndexBuilder, finalizeIndex } from "../src/model.ts";
import { identityTemplate } from "../src/template.ts";

const group = { html: "グループ", reading: "ぐるーぷ" };
const entry = { html: "主見出し", reading: "しゅみだし" };
const subentry = { html: "副見出し", reading: "ふくみだし" };
const address = { group, entry, subentry };

void test("parses page instructions", () => {
  assert.deepStrictEqual(
    parseInstruction("ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し"),
    { type: "page", address, template: identityTemplate },
  );
  assert.deepStrictEqual(
    parseInstruction(
      "ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|<em><slot></slot></em>",
    ),
    { type: "page", address, template: "<em><slot></slot></em>" },
  );
});

void test("parses range start and end instructions", () => {
  assert.deepStrictEqual(
    parseInstruction("ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|("),
    {
      type: "range-start",
      address,
      template: identityTemplate,
    },
  );
  assert.deepStrictEqual(
    parseInstruction(
      "ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|(|<em><slot></slot></em>",
    ),
    {
      type: "range-start",
      address,
      template: "<em><slot></slot></em>",
    },
  );
  assert.deepStrictEqual(
    parseInstruction("ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|(|"),
    {
      type: "range-start",
      address,
      template: "",
    },
  );
  assert.deepStrictEqual(
    parseInstruction("ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|)"),
    {
      type: "range-end",
      address,
    },
  );
});

void test("parses preferred and related cross-reference instructions", () => {
  const target = {
    group: { html: "別グループ", reading: "べつぐるーぷ" },
    entry: { html: "見出し語", reading: "みだしご" },
  };
  assert.deepStrictEqual(
    parseInstruction(
      "ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|see{べつぐるーぷ@別グループ!みだしご@見出し語}",
    ),
    { type: "preferred", address, target, template: identityTemplate },
  );
  assert.deepStrictEqual(
    parseInstruction(
      "ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|seealso{べつぐるーぷ@別グループ!みだしご@見出し語}",
    ),
    { type: "related", address, target, template: identityTemplate },
  );
  assert.deepStrictEqual(
    parseInstruction(
      "ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|see{べつぐるーぷ@別グループ!みだしご@見出し語}|",
    ),
    { type: "preferred", address, target, template: "" },
  );
  assert.deepStrictEqual(
    parseInstruction(
      "ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|seealso{べつぐるーぷ@別グループ!みだしご@見出し語}|",
    ),
    { type: "related", address, target, template: "" },
  );
  assert.deepStrictEqual(
    parseInstruction("group!main|see{target-group!target-main!target-subentry}"),
    {
      type: "preferred",
      address: {
        group: { html: "group", reading: "group" },
        entry: { html: "main", reading: "main" },
      },
      target: {
        group: { html: "target-group", reading: "target-group" },
        entry: { html: "target-main", reading: "target-main" },
        subentry: { html: "target-subentry", reading: "target-subentry" },
      },
      template: identityTemplate,
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
    template: identityTemplate,
  });
});

void test("unescapes an omitted display value into both the reading and HTML", () => {
  assert.deepStrictEqual(parseInstruction("a\\@b\\!c\\|d\\\\e!main"), {
    type: "page",
    address: {
      group: { html: "a@b!c|d\\e", reading: "a@b!c|d\\e" },
      entry: { html: "main", reading: "main" },
    },
    template: identityTemplate,
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
      template: identityTemplate,
    },
  );
  assert.deepStrictEqual(parseInstruction("g@<em>unclosed!main"), {
    type: "page",
    address: {
      group: { html: "<em>unclosed", reading: "g" },
      entry: { html: "main", reading: "main" },
    },
    template: identityTemplate,
  });
});

void test("preserves HTML fragments at every entry position", () => {
  assert.deepStrictEqual(
    parseInstruction(
      "g@<\\!-- group --><b>G</b>!m@M&amp;M!s@<i>S</i>|see{tg@<b>TG</b>!tm@<i>TM</i>!ts@<u>TS</u>}",
    ),
    {
      type: "preferred",
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
      template: identityTemplate,
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
    template: identityTemplate,
  });
});

void test("preserves surrounding whitespace and HTML line breaks", () => {
  assert.deepStrictEqual(parseInstruction(" group @<span>\nG\t</span>! main "), {
    type: "page",
    address: {
      group: { html: "<span>\nG\t</span>", reading: " group " },
      entry: { html: " main ", reading: " main " },
    },
    template: identityTemplate,
  });
});

void test("unescapes metacharacters in readings and display values", () => {
  assert.deepStrictEqual(parseInstruction("よ\\@み@表\\@示\\!分類!主\\!見出し@主\\|表示\\|値"), {
    type: "page",
    address: {
      group: { html: "表@示!分類", reading: "よ@み" },
      entry: { html: "主|表示|値", reading: "主!見出し" },
    },
    template: identityTemplate,
  });
});

void test("distinguishes escaped metacharacters at syntax boundaries", () => {
  assert.deepStrictEqual(parseInstruction("a\\@@\\@b!main"), {
    type: "page",
    address: {
      group: { html: "@b", reading: "a@" },
      entry: { html: "main", reading: "main" },
    },
    template: identityTemplate,
  });
  assert.deepStrictEqual(parseInstruction("a\\!!\\!main"), {
    type: "page",
    address: {
      group: { html: "a!", reading: "a!" },
      entry: { html: "!main", reading: "!main" },
    },
    template: identityTemplate,
  });
  assert.deepStrictEqual(parseInstruction("group!main\\||<b><slot></slot></b>"), {
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

  assert.deepStrictEqual(parseInstruction("group!main|"), {
    type: "page",
    address,
    template: "",
  });
  assert.deepStrictEqual(parseInstruction("group!main|掲載略"), {
    type: "page",
    address,
    template: "掲載略",
  });
  assert.deepStrictEqual(parseInstruction("group!main|<slot></slot><slot></slot>"), {
    type: "page",
    address,
    template: "<slot></slot><slot></slot>",
  });
});

void test("requires metasyntax characters in templates to be escaped", () => {
  assert.deepStrictEqual(
    parseInstruction("group!main|<em>\\@\\!\\|\\(\\)\\{\\}\\\\<slot></slot></em>\\|x"),
    {
      type: "page",
      address: {
        group: { html: "group", reading: "group" },
        entry: { html: "main", reading: "main" },
      },
      template: "<em>@!|(){}\\<slot></slot></em>|x",
    },
  );
});

void test("requires metasyntax at the start of an introduced template to be escaped", () => {
  for (const lexeme of ["(", ")", "see{", "seealso{"]) {
    assert.throws(
      () => parseInstruction(`group!main|(|${lexeme}x`),
      InstructionSyntaxError,
      lexeme,
    );
    assert.throws(
      () => parseInstruction(`group!main|see{tg!tm}|${lexeme}x`),
      InstructionSyntaxError,
      lexeme,
    );
  }
  assert.deepStrictEqual(parseInstruction("group!main|(|\\(x)"), {
    type: "range-start",
    address: {
      group: { html: "group", reading: "group" },
      entry: { html: "main", reading: "main" },
    },
    template: "(x)",
  });
  assert.deepStrictEqual(parseInstruction("group!main|see{tg!tm}|see\\{x\\}"), {
    type: "preferred",
    address: {
      group: { html: "group", reading: "group" },
      entry: { html: "main", reading: "main" },
    },
    target: {
      group: { html: "tg", reading: "tg" },
      entry: { html: "tm", reading: "tm" },
    },
    template: "see{x}",
  });
});

void test("rejects unescaped metasyntax throughout an instruction", () => {
  for (const token of ["@", "!", "|", "|(", "|)", "|see{", "|seealso{", "}"]) {
    assert.throws(
      () => parseInstruction(`group!main|prefix${token}suffix`),
      InstructionSyntaxError,
      token,
    );
  }
  for (const instruction of ["group@display}value!main", "group!main|see{target!entry|template}"]) {
    assert.throws(() => parseInstruction(instruction), InstructionSyntaxError, instruction);
  }
  assert.deepStrictEqual(parseInstruction("group\\}name!main"), {
    type: "page",
    address: {
      group: { html: "group}name", reading: "group}name" },
      entry: { html: "main", reading: "main" },
    },
    template: identityTemplate,
  });
});

void test("reads a cross-reference target inside braces", () => {
  assert.deepStrictEqual(parseInstruction("group!main|see{tg!tm}|<em><slot></slot></em>"), {
    type: "preferred",
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
  assert.deepStrictEqual(parseInstruction("group!main|seealso{tg!tm\\|x}"), {
    type: "related",
    address: {
      group: { html: "group", reading: "group" },
      entry: { html: "main", reading: "main" },
    },
    target: {
      group: { html: "tg", reading: "tg" },
      entry: { html: "tm|x", reading: "tm|x" },
    },
    template: identityTemplate,
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
    "group!main|)余分",
    "group!main|see{group",
    "group!main|see{}",
    "group!main|seealso{group!}",
    "group\\",
    "group\\x!main",
    "group!main|<em><slot></slot></em>\\",
    "group!main|(|<em>\\",
    "group!main|(<em><slot></slot></em>",
    "group!main|see{tg!tm}<em><slot></slot></em>",
    "group!main|(@x",
    "group!main|see{tg!tm}!x",
  ];

  for (const instruction of invalidInstructions) {
    assert.throws(() => parseInstruction(instruction), InstructionSyntaxError, instruction);
  }
});

void test("reports the exact grapheme offset of a forbidden template character", () => {
  assert.throws(
    () => parseInstruction("g!m|(|👨‍👩‍👧‍👦a\u0000#x"),
    (error: unknown) => error instanceof InstructionSyntaxError && error.offset === 8,
  );
});

void test("rejects blank values and forbidden control characters", () => {
  const invalidInstructions = [
    "   !main",
    "group!\t",
    "group@   !main",
    "group\nname!main",
    "group!main\u0000",
    "group!main|(|<em>\u0000</em>",
    "group!main|<em>\u0000<slot></slot></em>",
  ];

  for (const instruction of invalidInstructions) {
    assert.throws(() => parseInstruction(instruction), InstructionSyntaxError, instruction);
  }
});

void test("applies page instructions", () => {
  const builder = createIndexBuilder();
  const instruction = parseInstruction("し!じゆうりよう@自由利用|<strong><slot></slot></strong>");
  assert.strictEqual(instruction.type, "page");

  applyPageInstruction(builder, instruction, "chapter.html#fair-use");

  assert.deepStrictEqual(finalizeIndex(builder), {
    groups: [
      {
        key: { html: "し", reading: "し" },
        entries: [
          {
            key: { html: "自由利用", reading: "じゆうりよう" },
            subentries: [],
            locators: [
              {
                location: { type: "page", href: "chapter.html#fair-use" },
                template: "<strong><slot></slot></strong>",
              },
            ],
            xrefPreferred: [],
            xrefRelated: [],
          },
        ],
      },
    ],
  });
});

void test("applies range instructions", () => {
  const builder = createIndexBuilder();
  const instruction = parseInstruction("し!じゆうりよう@自由利用|(");
  assert.strictEqual(instruction.type, "range-start");

  applyRangeInstruction(builder, instruction, "chapter.html#start", "chapter.html#end");

  assert.deepStrictEqual(finalizeIndex(builder), {
    groups: [
      {
        key: { html: "し", reading: "し" },
        entries: [
          {
            key: { html: "自由利用", reading: "じゆうりよう" },
            subentries: [],
            locators: [
              {
                location: { type: "range", start: "chapter.html#start", end: "chapter.html#end" },
                template: identityTemplate,
              },
            ],
            xrefPreferred: [],
            xrefRelated: [],
          },
        ],
      },
    ],
  });
});

void test("applies the template of a range instruction", () => {
  const builder = createIndexBuilder();
  const instruction = parseInstruction("し!じゆうりよう@自由利用|(|<em><slot></slot></em>");
  assert.strictEqual(instruction.type, "range-start");

  applyRangeInstruction(builder, instruction, "chapter.html#start", "chapter.html#end");

  assert.deepStrictEqual(finalizeIndex(builder).groups[0]?.entries[0]?.locators, [
    {
      location: { type: "range", start: "chapter.html#start", end: "chapter.html#end" },
      template: "<em><slot></slot></em>",
    },
  ]);
});

void test("applies cross-reference instructions", () => {
  const builder = createIndexBuilder();
  const instruction = parseInstruction(
    "ち!ちょさくけん@著作権|seealso{ち!ちてきざいさんけん@知的財産権}",
  );
  assert.ok(instruction.type === "preferred" || instruction.type === "related");

  applyXrefInstruction(builder, instruction);

  assert.deepStrictEqual(finalizeIndex(builder), {
    groups: [
      {
        key: { html: "ち", reading: "ち" },
        entries: [
          {
            key: { html: "著作権", reading: "ちょさくけん" },
            subentries: [],
            locators: [],
            xrefPreferred: [],
            xrefRelated: [
              {
                target: {
                  group: { html: "ち", reading: "ち" },
                  entry: { html: "知的財産権", reading: "ちてきざいさんけん" },
                },
                template: identityTemplate,
              },
            ],
          },
        ],
      },
    ],
  });
});

void test("applies the template of a cross-reference instruction", () => {
  const builder = createIndexBuilder();
  const instruction = parseInstruction(
    "ち!ちょさくけん@著作権|see{ち!ちてきざいさんけん@知的財産権}|<em><slot></slot></em>",
  );
  assert.ok(instruction.type === "preferred" || instruction.type === "related");

  applyXrefInstruction(builder, instruction);

  assert.deepStrictEqual(finalizeIndex(builder).groups[0]?.entries[0]?.xrefPreferred, [
    {
      target: {
        group: { html: "ち", reading: "ち" },
        entry: { html: "知的財産権", reading: "ちてきざいさんけん" },
      },
      template: "<em><slot></slot></em>",
    },
  ]);
});
