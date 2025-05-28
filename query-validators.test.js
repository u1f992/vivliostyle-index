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

test(() => {
  //
  // ToEntry
  //
  assert.ok(
    getRegisterPageLocatorToEntryQueryValidator()([
      "$",
      ["さ", "じゆうりよう", "自由利用"],
    ]),
  );
  assert.ok(
    getRegisterRangeLocatorToEntryQueryValidator()([
      "$",
      ["さ", "じゆうりよう", "自由利用"],
      "range",
    ]),
  );
  // <!--
  assert.ok(
    getRegisterSeeReferenceOfEntryToEntryQueryValidator()([
      "$",
      ["た", "ちよさくけん", "著作権"],
      "see",
      ["た", "ちてきざいさんけん", "知的財産権"],
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
  // -->
  assert.ok(
    getRegisterSeeAlsoReferenceOfEntryToEntryQueryValidator()([
      "$",
      ["た", "ちよさくけん", "著作権"],
      "seeAlso",
      ["た", "ちてきざいさんけん", "知的財産権"],
    ]),
  );
  // <!--
  assert.ok(
    getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()([
      "$",
      ["た", "ちよさくけん", "著作権"],
      "seeAlso",
      [["さ", "そうぞく", "相続"], "いつしんせんぞく", "一身専属"],
    ]),
  );
  // -->

  //
  // ToSubentry
  //
  assert.ok(
    getRegisterPageLocatorToSubentryQueryValidator()([
      "$",
      [["さ", "そうぞく", "相続"], "いつしんせんぞく", "一身専属"],
    ]),
  );
  assert.ok(
    getRegisterRangeLocatorToSubentryQueryValidator()([
      "$",
      [["さ", "そうぞく", "相続"], "そうぞくにん", "相続人"],
      "range",
    ]),
  );
  assert.ok(
    getRegisterSeeReferenceOfEntryToSubentryQueryValidator()([
      "$",
      [["た", "ちよさくけん", "著作権"], "ちよさくけんのせいげん", "――の制限"],
      "see",
      ["さ", "じゆうりよう", "自由利用"],
    ]),
  );
  assert.ok(
    getRegisterSeeReferenceOfSubentryToSubentryQueryValidator()([
      "$",
      [["た", "ちよさくけん", "著作権"], "ちよさくけんのせいげん", "――の制限"],
      "see",
      [["さ", "そうぞく", "相続"], "いつしんせんぞく", "一身専属"],
    ]),
  );
  // <!--
  assert.ok(
    getRegisterSeeAlsoReferenceOfEntryToSubentryQueryValidator()([
      "$",
      [["た", "ちよさくけん", "著作権"], "ちよさくけんのせいげん", "――の制限"],
      "seeAlso",
      ["さ", "じゆうりよう", "自由利用"],
    ]),
  );
  assert.ok(
    getRegisterSeeAlsoReferenceOfSubentryToSubentryQueryValidator()([
      "$",
      [["た", "ちよさくけん", "著作権"], "ちよさくけんのせいげん", "――の制限"],
      "seeAlso",
      [["さ", "そうぞく", "相続"], "いつしんせんぞく", "一身専属"],
    ]),
  );
  // -->
});
