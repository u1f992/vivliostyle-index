import assert from "node:assert";
import test from "node:test";

import { CommandSyntaxError, parseCommand } from "../src/command-parser.ts";

const group = { html: "グループ", reading: "ぐるーぷ" };
const mainEntry = { html: "主見出し", reading: "しゅみだし" };
const subentry = { html: "副見出し", reading: "ふくみだし" };
const entry = { group, mainEntry, subentry };

void test("parses page commands", () => {
  assert.deepStrictEqual(
    parseCommand("ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し"),
    { type: "page", entry, important: false },
  );
  assert.deepStrictEqual(
    parseCommand("ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|!"),
    { type: "page", entry, important: true },
  );
});

void test("parses range commands", () => {
  assert.deepStrictEqual(
    parseCommand("ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|(path.md#fragment"),
    {
      type: "range",
      entry,
      important: false,
      endReference: "path.md#fragment",
    },
  );
  assert.deepStrictEqual(
    parseCommand("ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|!(path.md#fragment"),
    {
      type: "range",
      entry,
      important: true,
      endReference: "path.md#fragment",
    },
  );
  assert.deepStrictEqual(parseCommand("group!main|(#fragment"), {
    type: "range",
    entry: {
      group: { html: "group", reading: "group" },
      mainEntry: { html: "main", reading: "main" },
    },
    important: false,
    endReference: "#fragment",
  });
});

void test("parses see and see-also commands", () => {
  const target = {
    group: { html: "別グループ", reading: "べつぐるーぷ" },
    mainEntry: { html: "見出し語", reading: "みだしご" },
  };
  assert.deepStrictEqual(
    parseCommand(
      "ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|->べつぐるーぷ@別グループ!みだしご@見出し語",
    ),
    { type: "see", entry, target },
  );
  assert.deepStrictEqual(
    parseCommand(
      "ぐるーぷ@グループ!しゅみだし@主見出し!ふくみだし@副見出し|=>べつぐるーぷ@別グループ!みだしご@見出し語",
    ),
    { type: "seeAlso", entry, target },
  );
  assert.deepStrictEqual(parseCommand("group!main|->target-group!target-main!target-subentry"), {
    type: "see",
    entry: {
      group: { html: "group", reading: "group" },
      mainEntry: { html: "main", reading: "main" },
    },
    target: {
      group: { html: "target-group", reading: "target-group" },
      mainEntry: { html: "target-main", reading: "target-main" },
      subentry: { html: "target-subentry", reading: "target-subentry" },
    },
  });
});

void test("uses an omitted display value as the reading and HTML", () => {
  assert.deepStrictEqual(parseCommand("group!main"), {
    type: "page",
    entry: {
      group: { html: "group", reading: "group" },
      mainEntry: { html: "main", reading: "main" },
    },
    important: false,
  });
});

void test("unescapes an omitted display value into both the reading and HTML", () => {
  assert.deepStrictEqual(parseCommand("a\\@b\\!c\\|d\\\\e!main"), {
    type: "page",
    entry: {
      group: { html: "a@b!c|d\\e", reading: "a@b!c|d\\e" },
      mainEntry: { html: "main", reading: "main" },
    },
    important: false,
  });
});

void test("preserves display values as HTML fragments", () => {
  assert.deepStrictEqual(
    parseCommand('き@<span data-symbol="\\@\\!\\|">き</span>!きょうとだいがく@<em>京都大学</em>'),
    {
      type: "page",
      entry: {
        group: {
          html: '<span data-symbol="@!|">き</span>',
          reading: "き",
        },
        mainEntry: {
          html: "<em>京都大学</em>",
          reading: "きょうとだいがく",
        },
      },
      important: false,
    },
  );
  assert.deepStrictEqual(parseCommand("g@<em>unclosed!main"), {
    type: "page",
    entry: {
      group: { html: "<em>unclosed", reading: "g" },
      mainEntry: { html: "main", reading: "main" },
    },
    important: false,
  });
});

void test("preserves HTML fragments at every entry position", () => {
  assert.deepStrictEqual(
    parseCommand(
      "g@<\\!-- group --><b>G</b>!m@M&amp;M!s@<i>S</i>|->tg@<b>TG</b>!tm@<i>TM</i>!ts@<u>TS</u>",
    ),
    {
      type: "see",
      entry: {
        group: { html: "<!-- group --><b>G</b>", reading: "g" },
        mainEntry: { html: "M&amp;M", reading: "m" },
        subentry: { html: "<i>S</i>", reading: "s" },
      },
      target: {
        group: { html: "<b>TG</b>", reading: "tg" },
        mainEntry: { html: "<i>TM</i>", reading: "tm" },
        subentry: { html: "<u>TS</u>", reading: "ts" },
      },
    },
  );
});

void test("does not normalize readings or HTML", () => {
  const nfc = "é";
  const nfd = "e\u0301";

  assert.notStrictEqual(nfc, nfd);
  assert.deepStrictEqual(parseCommand(`${nfd}@${nfd}!main`), {
    type: "page",
    entry: {
      group: { html: nfd, reading: nfd },
      mainEntry: { html: "main", reading: "main" },
    },
    important: false,
  });
});

void test("preserves surrounding whitespace and HTML line breaks", () => {
  assert.deepStrictEqual(parseCommand(" group @<span>\nG\t</span>! main "), {
    type: "page",
    entry: {
      group: { html: "<span>\nG\t</span>", reading: " group " },
      mainEntry: { html: " main ", reading: " main " },
    },
    important: false,
  });
});

void test("unescapes metacharacters in readings and display values", () => {
  assert.deepStrictEqual(parseCommand("よ\\@み@表\\@示\\!分類!主\\!見出し@主\\|表示\\|値"), {
    type: "page",
    entry: {
      group: { html: "表@示!分類", reading: "よ@み" },
      mainEntry: { html: "主|表示|値", reading: "主!見出し" },
    },
    important: false,
  });
});

void test("distinguishes escaped metacharacters at syntax boundaries", () => {
  assert.deepStrictEqual(parseCommand("a\\@@\\@b!main"), {
    type: "page",
    entry: {
      group: { html: "@b", reading: "a@" },
      mainEntry: { html: "main", reading: "main" },
    },
    important: false,
  });
  assert.deepStrictEqual(parseCommand("a\\!!\\!main"), {
    type: "page",
    entry: {
      group: { html: "a!", reading: "a!" },
      mainEntry: { html: "!main", reading: "!main" },
    },
    important: false,
  });
  assert.deepStrictEqual(parseCommand("group!main\\||!"), {
    type: "page",
    entry: {
      group: { html: "group", reading: "group" },
      mainEntry: { html: "main|", reading: "main|" },
    },
    important: true,
  });
});

void test("preserves every character after a range operator", () => {
  assert.deepStrictEqual(parseCommand("group!main|!(../章 @!|.md?x=1&y=2+#終点)"), {
    type: "range",
    entry: {
      group: { html: "group", reading: "group" },
      mainEntry: { html: "main", reading: "main" },
    },
    important: true,
    endReference: "../章 @!|.md?x=1&y=2+#終点)",
  });
});

void test("reports offsets in Intl en grapheme clusters", () => {
  assert.throws(
    () => parseCommand("👨‍👩‍👧‍👦!é@"),
    (error: unknown) =>
      error instanceof CommandSyntaxError &&
      error.offset === 4 &&
      error.message.includes("display value"),
  );
});

void test("handles long inputs without recursion", () => {
  const reading = "あ".repeat(100_000);
  const command = parseCommand(`${reading}!main`);

  assert.strictEqual(command.entry.group.reading, reading);
});

void test("rejects incomplete and structurally invalid commands", () => {
  const invalidCommands = [
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
  ];

  for (const command of invalidCommands) {
    assert.throws(() => parseCommand(command), CommandSyntaxError, command);
  }
});

void test("reports the exact grapheme offset of a forbidden reference character", () => {
  assert.throws(
    () => parseCommand("g!m|(👨‍👩‍👧‍👦a\u0000#x"),
    (error: unknown) => error instanceof CommandSyntaxError && error.offset === 7,
  );
});

void test("rejects blank values and forbidden control characters", () => {
  const invalidCommands = [
    "   !main",
    "group!\t",
    "group@   !main",
    "group\nname!main",
    "group!main\u0000",
    "group!main|(path\u0000#end",
  ];

  for (const command of invalidCommands) {
    assert.throws(() => parseCommand(command), CommandSyntaxError, command);
  }
});
