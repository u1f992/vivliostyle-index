// @ts-check

import assert from "node:assert";
import test from "node:test";

import {
  getRegisterPageLocatorToEntryQueryValidator,
  getRegisterRangeLocatorToEntryQueryValidator,
  getRegisterSeeReferenceOfEntryToEntryQueryValidator,
  getRegisterSeeReferenceOfSubentryToEntryQueryValidator,
  getRegisterSeeAlsoReferenceOfEntryToEntryQueryValidator,
  getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator,
  getRegisterPageLocatorToSubentryQueryValidator,
  getRegisterRangeLocatorToSubentryQueryValidator,
  getRegisterSeeReferenceOfEntryToSubentryQueryValidator,
  getRegisterSeeReferenceOfSubentryToSubentryQueryValidator,
  getRegisterSeeAlsoReferenceOfEntryToSubentryQueryValidator,
  getRegisterSeeAlsoReferenceOfSubentryToSubentryQueryValidator,
} from "./query-validators.js";

await test("ToEntry", async (ctx) => {
  await ctx.test("RegisterPageLocatorToEntryQuery", () => {
    assert.ok(getRegisterPageLocatorToEntryQueryValidator()(["$", ["さ"]]));
    assert.ok(
      getRegisterPageLocatorToEntryQueryValidator()([
        "$",
        ["さ", "じゆうりよう"],
      ]),
    );
    assert.ok(
      getRegisterPageLocatorToEntryQueryValidator()([
        "$",
        ["さ", "じゆうりよう", "自由利用"],
      ]),
    );
  });

  await ctx.test("RegisterRangeLocatorToEntryQuery", () => {
    assert.ok(
      getRegisterRangeLocatorToEntryQueryValidator()(["$", ["さ"], "range"]),
    );
    assert.ok(
      getRegisterRangeLocatorToEntryQueryValidator()([
        "$",
        ["さ", "じゆうりよう"],
        "range",
      ]),
    );
    assert.ok(
      getRegisterRangeLocatorToEntryQueryValidator()([
        "$",
        ["さ", "じゆうりよう", "自由利用"],
        "range",
      ]),
    );
  });

  await ctx.test("RegisterSeeReferenceOfEntryToEntryQuery", () => {
    assert.ok(
      getRegisterSeeReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た"],
        "see",
        ["た"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た"],
        "see",
        ["た", "ちてきざいさんけん"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た"],
        "see",
        ["た", "ちてきざいさんけん", "知的財産権"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "see",
        ["た"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "see",
        ["た", "ちてきざいさんけん"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "see",
        ["た", "ちてきざいさんけん", "知的財産権"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "see",
        ["た"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "see",
        ["た", "ちてきざいさんけん"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "see",
        ["た", "ちてきざいさんけん", "知的財産権"],
      ]),
    );
  });

  await ctx.test("RegisterSeeReferenceOfSubentryToEntryQuery", () => {
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "see",
        [["さ"]],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "see",
        [["さ"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "see",
        [["さ"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "see",
        [["さ", "そうぞく"]],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "see",
        [["さ", "そうぞく"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "see",
        [["さ", "そうぞく"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "see",
        [["さ", "そうぞく", "相続"]],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "see",
        [["さ", "そうぞく", "相続"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "see",
        [["さ", "そうぞく", "相続"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "see",
        [["さ"]],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "see",
        [["さ"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "see",
        [["さ"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "see",
        [["さ", "そうぞく"]],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "see",
        [["さ", "そうぞく"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "see",
        [["さ", "そうぞく"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "see",
        [["さ", "そうぞく", "相続"]],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "see",
        [["さ", "そうぞく", "相続"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "see",
        [["さ", "そうぞく", "相続"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "see",
        [["さ"]],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "see",
        [["さ"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "see",
        [["さ"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "see",
        [["さ", "そうぞく"]],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "see",
        [["さ", "そうぞく"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "see",
        [["さ", "そうぞく"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "see",
        [["さ", "そうぞく", "相続"]],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "see",
        [["さ", "そうぞく", "相続"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "see",
        [["さ", "そうぞく", "相続"], "いつしんせんぞく", "一身専属"],
      ]),
    );
  });

  await ctx.test("RegisterSeeAlsoReferenceOfEntryToEntryQuery", () => {
    assert.ok(
      getRegisterSeeAlsoReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た"],
        "seeAlso",
        ["た"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た"],
        "seeAlso",
        ["た", "ちてきざいさんけん"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た"],
        "seeAlso",
        ["た", "ちてきざいさんけん", "知的財産権"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "seeAlso",
        ["た"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "seeAlso",
        ["た", "ちてきざいさんけん"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "seeAlso",
        ["た", "ちてきざいさんけん", "知的財産権"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "seeAlso",
        ["た"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "seeAlso",
        ["た", "ちてきざいさんけん"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfEntryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "seeAlso",
        ["た", "ちてきざいさんけん", "知的財産権"],
      ]),
    );
  });

  await ctx.test("RegisterSeeAlsoReferenceOfSubentryToEntryQuery", () => {
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "seeAlso",
        [["さ"]],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "seeAlso",
        [["さ"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "seeAlso",
        [["さ"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "seeAlso",
        [["さ", "そうぞく"]],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "seeAlso",
        [["さ", "そうぞく"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "seeAlso",
        [["さ", "そうぞく"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "seeAlso",
        [["さ", "そうぞく", "相続"]],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "seeAlso",
        [["さ", "そうぞく", "相続"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た"],
        "seeAlso",
        [["さ", "そうぞく", "相続"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "seeAlso",
        [["さ"]],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "seeAlso",
        [["さ"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "seeAlso",
        [["さ"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "seeAlso",
        [["さ", "そうぞく"]],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "seeAlso",
        [["さ", "そうぞく"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "seeAlso",
        [["さ", "そうぞく"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "seeAlso",
        [["さ", "そうぞく", "相続"]],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "seeAlso",
        [["さ", "そうぞく", "相続"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん"],
        "seeAlso",
        [["さ", "そうぞく", "相続"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "seeAlso",
        [["さ"]],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "seeAlso",
        [["さ"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "seeAlso",
        [["さ"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "seeAlso",
        [["さ", "そうぞく"]],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "seeAlso",
        [["さ", "そうぞく"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "seeAlso",
        [["さ", "そうぞく"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "seeAlso",
        [["さ", "そうぞく", "相続"]],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "seeAlso",
        [["さ", "そうぞく", "相続"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
        "$",
        ["た", "ちよさくけん", "著作権"],
        "seeAlso",
        [["さ", "そうぞく", "相続"], "いつしんせんぞく", "一身専属"],
      ]),
    );
  });
});

await test("ToSubentry", async (ctx) => {
  await ctx.test("RegisterPageLocatorToSubentryQuery", () => {
    assert.ok(
      getRegisterPageLocatorToSubentryQueryValidator()(["$", [["さ"]]]),
    );
    assert.ok(
      getRegisterPageLocatorToSubentryQueryValidator()([
        "$",
        [["さ", "そうぞく"]],
      ]),
    );
    assert.ok(
      getRegisterPageLocatorToSubentryQueryValidator()([
        "$",
        [["さ", "そうぞく", "相続"]],
      ]),
    );
    assert.ok(
      getRegisterPageLocatorToSubentryQueryValidator()([
        "$",
        [["さ"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterPageLocatorToSubentryQueryValidator()([
        "$",
        [["さ", "そうぞく"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterPageLocatorToSubentryQueryValidator()([
        "$",
        [["さ", "そうぞく", "相続"], "いつしんせんぞく"],
      ]),
    );
    assert.ok(
      getRegisterPageLocatorToSubentryQueryValidator()([
        "$",
        [["さ"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterPageLocatorToSubentryQueryValidator()([
        "$",
        [["さ", "そうぞく"], "いつしんせんぞく", "一身専属"],
      ]),
    );
    assert.ok(
      getRegisterPageLocatorToSubentryQueryValidator()([
        "$",
        [["さ", "そうぞく", "相続"], "いつしんせんぞく", "一身専属"],
      ]),
    );
  });

  await ctx.test("RegisterRangeLocatorToSubentryQuery", () => {
    assert.ok(
      getRegisterRangeLocatorToSubentryQueryValidator()([
        "$",
        [["さ"]],
        "range",
      ]),
    );
    assert.ok(
      getRegisterRangeLocatorToSubentryQueryValidator()([
        "$",
        [["さ", "そうぞく"]],
        "range",
      ]),
    );
    assert.ok(
      getRegisterRangeLocatorToSubentryQueryValidator()([
        "$",
        [["さ", "そうぞく", "相続"]],
        "range",
      ]),
    );
    assert.ok(
      getRegisterRangeLocatorToSubentryQueryValidator()([
        "$",
        [["さ"], "そうぞくにん"],
        "range",
      ]),
    );
    assert.ok(
      getRegisterRangeLocatorToSubentryQueryValidator()([
        "$",
        [["さ", "そうぞく"], "そうぞくにん"],
        "range",
      ]),
    );
    assert.ok(
      getRegisterRangeLocatorToSubentryQueryValidator()([
        "$",
        [["さ", "そうぞく", "相続"], "そうぞくにん"],
        "range",
      ]),
    );
    assert.ok(
      getRegisterRangeLocatorToSubentryQueryValidator()([
        "$",
        [["さ"], "そうぞくにん", "相続人"],
        "range",
      ]),
    );
    assert.ok(
      getRegisterRangeLocatorToSubentryQueryValidator()([
        "$",
        [["さ", "そうぞく"], "そうぞくにん", "相続人"],
        "range",
      ]),
    );
    assert.ok(
      getRegisterRangeLocatorToSubentryQueryValidator()([
        "$",
        [["さ", "そうぞく", "相続"], "そうぞくにん", "相続人"],
        "range",
      ]),
    );
  });

  await ctx.test("RegisterSeeReferenceOfEntryToSubentryQuery", () => {
    assert.ok(
      getRegisterSeeReferenceOfEntryToSubentryQueryValidator()([
        "$",
        [
          ["た", "ちよさくけん", "著作権"],
          "ちよさくけんのせいげん",
          "――の制限",
        ],
        "see",
        ["さ", "じゆうりよう", "自由利用"],
      ]),
    );
  });

  await ctx.test("RegisterSeeReferenceOfSubentryToSubentryQuery", () => {
    assert.ok(
      getRegisterSeeReferenceOfSubentryToSubentryQueryValidator()([
        "$",
        [
          ["た", "ちよさくけん", "著作権"],
          "ちよさくけんのせいげん",
          "――の制限",
        ],
        "see",
        [["さ", "そうぞく", "相続"], "いつしんせんぞく", "一身専属"],
      ]),
    );
  });

  await ctx.test("RegisterSeeAlsoReferenceOfEntryToSubentryQuery", () => {
    assert.ok(
      getRegisterSeeAlsoReferenceOfEntryToSubentryQueryValidator()([
        "$",
        [
          ["た", "ちよさくけん", "著作権"],
          "ちよさくけんのせいげん",
          "――の制限",
        ],
        "seeAlso",
        ["さ", "じゆうりよう", "自由利用"],
      ]),
    );
  });

  await ctx.test("RegisterSeeAlsoReferenceOfSubentryToSubentryQuery", () => {
    assert.ok(
      getRegisterSeeAlsoReferenceOfSubentryToSubentryQueryValidator()([
        "$",
        [
          ["た", "ちよさくけん", "著作権"],
          "ちよさくけんのせいげん",
          "――の制限",
        ],
        "seeAlso",
        [["さ", "そうぞく", "相続"], "いつしんせんぞく", "一身専属"],
      ]),
    );
  });
});
