// @ts-check

import getXPath from "get-xpath";
import { base16 } from "rfc4648";

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

/**
 * @typedef {{ file: string }} LocatorBase
 * @typedef {LocatorBase & { type: "page"; id: string }} PageLocator
 * @typedef {LocatorBase & { type: "range"; id: [string, string] }} RangeLocator
 *
 * @typedef {{
 *   group: string;
 *   reading: string;
 *   headword: string;
 * }} ReferenceBase
 * @typedef {ReferenceBase & { type: "entry" }} EntryReference
 * @typedef {ReferenceBase & {
 *   type: "subentry";
 *   subReading: string;
 *   subHeadword: string;
 * }} SubentryReference
 *
 * @typedef {{
 *   reading: string;
 *   headword: string;
 *   locators: (PageLocator | RangeLocator)[];
 *   see: (EntryReference | SubentryReference)[];
 *   seeAlso: (EntryReference | SubentryReference)[];
 * }} EntryBase
 * @typedef {EntryBase} Subentry
 * @typedef {Subentry & { subentries: Subentry[] }} Entry
 *
 * @typedef {{ group: string; entries: Entry[] }} Group
 * @typedef {Group[]} Index
 * @typedef {{[key: string]: Index}} Indexes
 */

/**
 * @param {Indexes} indexes
 * @param {string} indexId
 * @param {string} groupTag
 * @param {string} reading
 * @param {string} headword
 */
function ensureTargetEntry(indexes, indexId, groupTag, reading, headword) {
  const targetIndex = indexes[indexId] ?? (indexes[indexId] = []);
  const targetGroup =
    targetIndex.find((g) => g.group === groupTag) ??
    targetIndex[targetIndex.push({ group: groupTag, entries: [] }) - 1];
  const targetEntry =
    targetGroup.entries.find(
      (e) => e.reading === reading && e.headword === headword,
    ) ??
    targetGroup.entries[
      targetGroup.entries.push({
        reading,
        headword,
        locators: [],
        see: [],
        seeAlso: [],
        subentries: [],
      }) - 1
    ];
  return targetEntry;
}

/**
 * @param {Indexes} indexes
 * @param {string} indexId
 * @param {string} groupTag
 * @param {string} reading
 * @param {string} headword
 * @param {string} subReading
 * @param {string} subHeadword
 */
function ensureTargetSubentry(
  indexes,
  indexId,
  groupTag,
  reading,
  headword,
  subReading,
  subHeadword,
) {
  const targetEntry = ensureTargetEntry(
    indexes,
    indexId,
    groupTag,
    reading,
    headword,
  );
  const targetSubentry =
    targetEntry.subentries.find(
      (se) => se.reading === subReading && se.headword === subHeadword,
    ) ??
    targetEntry.subentries[
      targetEntry.subentries.push({
        reading,
        headword,
        locators: [],
        see: [],
        seeAlso: [],
      }) - 1
    ];
  return targetSubentry;
}

/**
 * @param {Element} elem
 */
function ensureId(elem) {
  const id = elem.hasAttribute("id")
    ? (elem.getAttribute("id") ?? "")
    : base16.stringify(new TextEncoder().encode(getXPath(elem)));
  if (!elem.hasAttribute("id")) {
    elem.setAttribute("id", id);
  }
  return id;
}

/**
 * @param {Element} elem
 */
function appendSpanAsLastChild(elem) {
  const span = document.createElement("span");
  elem.appendChild(span);
  return span;
}

/**
 *
 * @param {Indexes} indexes
 * @param {import("./query-validators.js").RegisterPageLocatorToEntryQuery} query
 * @param {string} file
 * @param {Element} elem
 */
function registerPageLocatorToEntry(indexes, query, file, elem) {
  const [indexId, [group, reading, headword]] = query;
  ensureTargetEntry(
    indexes,
    indexId,
    group,
    reading ?? elem.innerHTML,
    headword ?? elem.innerHTML,
  ).locators.push({
    type: "page",
    file,
    id: ensureId(elem),
  });
}

/**
 *
 * @param {Indexes} indexes
 * @param {import("./query-validators.js").RegisterRangeLocatorToEntryQuery} query
 * @param {string} file
 * @param {Element} elem
 */
function registerRangeLocatorToEntry(indexes, query, file, elem) {
  const [indexId, [group, reading, headword], _] = query;
  ensureTargetEntry(
    indexes,
    indexId,
    group,
    reading ?? elem.innerHTML,
    headword ?? elem.innerHTML,
  ).locators.push({
    type: "range",
    file,
    id: [ensureId(elem), ensureId(appendSpanAsLastChild(elem))],
  });
}

/**
 *
 * @param {Indexes} indexes
 * @param {import("./query-validators.js").RegisterSeeReferenceOfEntryToEntryQuery} query
 * @param {string} file
 * @param {Element} elem
 */
function registerSeeReferenceOfEntryToEntry(indexes, query, file, elem) {
  const [
    indexId,
    [group, reading, headword],
    _,
    [refGroup, refReading, refHeadword],
  ] = query;
  ensureTargetEntry(
    indexes,
    indexId,
    group,
    reading ?? elem.innerHTML,
    headword ?? elem.innerHTML,
  ).see.push({
    type: "entry",
    group: refGroup,
    reading: refReading ?? elem.innerHTML,
    headword: refHeadword ?? elem.innerHTML,
  });
}

/**
 *
 * @param {Indexes} indexes
 * @param {import("./query-validators.js").RegisterSeeReferenceOfSubentryToEntryQuery} query
 * @param {string} file
 * @param {Element} elem
 */
function registerSeeReferenceOfSubentryToEntry(indexes, query, file, elem) {
  const [
    indexId,
    [group, reading, headword],
    _,
    [[refGroup, refReading, refHeadword], refSubReading, refSubHeadword],
  ] = query;
  ensureTargetEntry(
    indexes,
    indexId,
    group,
    reading ?? elem.innerHTML,
    headword ?? elem.innerHTML,
  ).see.push({
    type: "subentry",
    group: refGroup,
    reading: refReading ?? elem.innerHTML,
    headword: refHeadword ?? elem.innerHTML,
    subReading: refSubReading ?? elem.innerHTML,
    subHeadword: refSubHeadword ?? elem.innerHTML,
  });
}

/**
 *
 * @param {Indexes} indexes
 * @param {import("./query-validators.js").RegisterSeeAlsoReferenceOfEntryToEntryQuery} query
 * @param {string} file
 * @param {Element} elem
 */
function registerSeeAlsoReferenceOfEntryToEntry(indexes, query, file, elem) {
  const [
    indexId,
    [group, reading, headword],
    _,
    [refGroup, refReading, refHeadword],
  ] = query;
  ensureTargetEntry(
    indexes,
    indexId,
    group,
    reading ?? elem.innerHTML,
    headword ?? elem.innerHTML,
  ).seeAlso.push({
    type: "entry",
    group: refGroup,
    reading: refReading ?? elem.innerHTML,
    headword: refHeadword ?? elem.innerHTML,
  });
}

/**
 *
 * @param {Indexes} indexes
 * @param {import("./query-validators.js").RegisterSeeAlsoReferenceOfSubentryToEntryQuery} query
 * @param {string} file
 * @param {Element} elem
 */
function registerSeeAlsoReferenceOfSubentryToEntry(indexes, query, file, elem) {
  const [
    indexId,
    [group, reading, headword],
    _,
    [[refGroup, refReading, refHeadword], refSubReading, refSubHeadword],
  ] = query;
  ensureTargetEntry(
    indexes,
    indexId,
    group,
    reading ?? elem.innerHTML,
    headword ?? elem.innerHTML,
  ).seeAlso.push({
    type: "subentry",
    group: refGroup,
    reading: refReading ?? elem.innerHTML,
    headword: refHeadword ?? elem.innerHTML,
    subReading: refSubReading ?? elem.innerHTML,
    subHeadword: refSubHeadword ?? elem.innerHTML,
  });
}

/**
 *
 * @param {Indexes} indexes
 * @param {import("./query-validators.js").RegisterPageLocatorToSubentryQuery} query
 * @param {string} file
 * @param {Element} elem
 */
function registerPageLocatorToSubentry(indexes, query, file, elem) {
  const [indexId, [[group, reading, headword], subReading, subHeadword]] =
    query;
  ensureTargetSubentry(
    indexes,
    indexId,
    group,
    reading ?? elem.innerHTML,
    headword ?? elem.innerHTML,
    subReading ?? elem.innerHTML,
    subHeadword ?? elem.innerHTML,
  ).locators.push({
    type: "page",
    file,
    id: ensureId(elem),
  });
}

/**
 *
 * @param {Indexes} indexes
 * @param {import("./query-validators.js").RegisterRangeLocatorToSubentryQuery} query
 * @param {string} file
 * @param {Element} elem
 */
function registerRangeLocatorToSubentry(indexes, query, file, elem) {
  const [indexId, [[group, reading, headword], subReading, subHeadword], _] =
    query;
  ensureTargetSubentry(
    indexes,
    indexId,
    group,
    reading ?? elem.innerHTML,
    headword ?? elem.innerHTML,
    subReading ?? elem.innerHTML,
    subHeadword ?? elem.innerHTML,
  ).locators.push({
    type: "range",
    file,
    id: [ensureId(elem), ensureId(appendSpanAsLastChild(elem))],
  });
}

/**
 *
 * @param {Indexes} indexes
 * @param {import("./query-validators.js").RegisterSeeReferenceOfEntryToSubentryQuery} query
 * @param {string} file
 * @param {Element} elem
 */
function registerSeeReferenceOfEntryToSubentry(indexes, query, file, elem) {
  const [
    indexId,
    [[group, reading, headword], subReading, subHeadword],
    _,
    [refGroup, refReading, refHeadword],
  ] = query;
  ensureTargetSubentry(
    indexes,
    indexId,
    group,
    reading ?? elem.innerHTML,
    headword ?? elem.innerHTML,
    subReading ?? elem.innerHTML,
    subHeadword ?? elem.innerHTML,
  ).see.push({
    type: "entry",
    group: refGroup,
    reading: refReading ?? elem.innerHTML,
    headword: refHeadword ?? elem.innerHTML,
  });
}

/**
 *
 * @param {Indexes} indexes
 * @param {import("./query-validators.js").RegisterSeeReferenceOfSubentryToSubentryQuery} query
 * @param {string} file
 * @param {Element} elem
 */
function registerSeeReferenceOfSubentryToSubentry(indexes, query, file, elem) {
  const [
    indexId,
    [[group, reading, headword], subReading, subHeadword],
    _,
    [[refGroup, refReading, refHeadword], refSubReading, refSubHeadword],
  ] = query;
  ensureTargetSubentry(
    indexes,
    indexId,
    group,
    reading ?? elem.innerHTML,
    headword ?? elem.innerHTML,
    subReading ?? elem.innerHTML,
    subHeadword ?? elem.innerHTML,
  ).see.push({
    type: "subentry",
    group: refGroup,
    reading: refReading ?? elem.innerHTML,
    headword: refHeadword ?? elem.innerHTML,
    subReading: refSubReading ?? elem.innerHTML,
    subHeadword: refSubHeadword ?? elem.innerHTML,
  });
}

/**
 *
 * @param {Indexes} indexes
 * @param {import("./query-validators.js").RegisterSeeAlsoReferenceOfEntryToSubentryQuery} query
 * @param {string} file
 * @param {Element} elem
 */
function registerSeeAlsoReferenceOfEntryToSubentry(indexes, query, file, elem) {
  const [
    indexId,
    [[group, reading, headword], subReading, subHeadword],
    _,
    [refGroup, refReading, refHeadword],
  ] = query;
  ensureTargetSubentry(
    indexes,
    indexId,
    group,
    reading ?? elem.innerHTML,
    headword ?? elem.innerHTML,
    subReading ?? elem.innerHTML,
    subHeadword ?? elem.innerHTML,
  ).seeAlso.push({
    type: "entry",
    group: refGroup,
    reading: refReading ?? elem.innerHTML,
    headword: refHeadword ?? elem.innerHTML,
  });
}

/**
 *
 * @param {Indexes} indexes
 * @param {import("./query-validators.js").RegisterSeeAlsoReferenceOfSubentryToSubentryQuery} query
 * @param {string} file
 * @param {Element} elem
 */
function registerSeeAlsoReferenceOfSubentryToSubentry(
  indexes,
  query,
  file,
  elem,
) {
  const [
    indexId,
    [[group, reading, headword], subReading, subHeadword],
    _,
    [[refGroup, refReading, refHeadword], refSubReading, refSubHeadword],
  ] = query;
  ensureTargetSubentry(
    indexes,
    indexId,
    group,
    reading ?? elem.innerHTML,
    headword ?? elem.innerHTML,
    subReading ?? elem.innerHTML,
    subHeadword ?? elem.innerHTML,
  ).seeAlso.push({
    type: "subentry",
    group: refGroup,
    reading: refReading ?? elem.innerHTML,
    headword: refHeadword ?? elem.innerHTML,
    subReading: refSubReading ?? elem.innerHTML,
    subHeadword: refSubHeadword ?? elem.innerHTML,
  });
}

/**
 * @typedef {(query: any) => boolean} QueryValidator
 * @typedef {(indexes: Indexes, query: any, file: string, elem: Element) => void} Register
 * @typedef {[() => QueryValidator, Register]} ValidatorRegisterPair
 * @type {ValidatorRegisterPair[]}
 */
const validatorRegisterPairs = [
  [getRegisterPageLocatorToEntryQueryValidator, registerPageLocatorToEntry],
  [getRegisterRangeLocatorToEntryQueryValidator, registerRangeLocatorToEntry],
  [
    getRegisterSeeReferenceOfEntryToEntryQueryValidator,
    registerSeeReferenceOfEntryToEntry,
  ],
  [
    getRegisterSeeReferenceOfSubentryToEntryQueryValidator,
    registerSeeReferenceOfSubentryToEntry,
  ],
  [
    getRegisterSeeAlsoReferenceOfEntryToEntryQueryValidator,
    registerSeeAlsoReferenceOfEntryToEntry,
  ],
  [
    getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator,
    registerSeeAlsoReferenceOfSubentryToEntry,
  ],
  [
    getRegisterPageLocatorToSubentryQueryValidator,
    registerPageLocatorToSubentry,
  ],
  [
    getRegisterRangeLocatorToSubentryQueryValidator,
    registerRangeLocatorToSubentry,
  ],
  [
    getRegisterSeeReferenceOfEntryToSubentryQueryValidator,
    registerSeeReferenceOfEntryToSubentry,
  ],
  [
    getRegisterSeeReferenceOfSubentryToSubentryQueryValidator,
    registerSeeReferenceOfSubentryToSubentry,
  ],
  [
    getRegisterSeeAlsoReferenceOfEntryToSubentryQueryValidator,
    registerSeeAlsoReferenceOfEntryToSubentry,
  ],
  [
    getRegisterSeeAlsoReferenceOfSubentryToSubentryQueryValidator,
    registerSeeAlsoReferenceOfSubentryToSubentry,
  ],
];

/**
 * @param {Indexes} indexes
 * @param {any} query
 * @param {string} file
 * @param {Element} elem
 */
export function register(indexes, query, file, elem) {
  for (const [validatorGetter, register] of validatorRegisterPairs) {
    if (validatorGetter()(query)) {
      register(indexes, query, file, elem);
      return;
    }
  }
  throw new Error(`incorrect query format: ${JSON.stringify(query)}`);
}
