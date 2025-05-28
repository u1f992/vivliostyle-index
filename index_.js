// @ts-check

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
 * @typedef {{
 *   type: string;
 *   file: string;
 *   id: string | [string, string];
 * }} LocatorBase
 * @typedef {LocatorBase & { type: "page"; id: string }} PageLocator
 * @typedef {LocatorBase & { type: "range"; id: [string, string] }} RangeLocator
 *
 * @typedef {{
 *   type: string;
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
 * @param {any} query
 * @param {HTMLElement} elem
 */
function register(indexes, query, elem) {
  if (getRegisterPageLocatorToEntryQueryValidator()(query)) {
    const [id, [group, reading_, headword_]] = query[0];
    const reading = reading_ ?? elem.innerHTML;
    const headword = headword_ ?? elem.innerHTML;

    const targetIndex = indexes[id];
    const targetGroup =
      targetIndex.find((g) => g.group === group) ??
      targetIndex[targetIndex.push({ group, entries: [] }) - 1];
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
    targetEntry.locators.push({ type: "page", file: "", id: "" });
  } else if (getRegisterRangeLocatorToEntryQueryValidator()(query)) {
  } else if (getRegisterSeeReferenceOfEntryToEntryQueryValidator()(query)) {
  } else if (getRegisterSeeReferenceOfSubentryToEntryQueryValidator()(query)) {
  } else if (getRegisterSeeAlsoReferenceOfEntryToEntryQueryValidator()(query)) {
  } else if (
    getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator()(query)
  ) {
  } else if (getRegisterPageLocatorToSubentryQueryValidator()(query)) {
  } else if (getRegisterRangeLocatorToSubentryQueryValidator()(query)) {
  } else if (getRegisterSeeReferenceOfEntryToSubentryQueryValidator()(query)) {
  } else if (
    getRegisterSeeReferenceOfSubentryToSubentryQueryValidator()(query)
  ) {
  } else if (
    getRegisterSeeAlsoReferenceOfEntryToSubentryQueryValidator()(query)
  ) {
  } else if (
    getRegisterSeeAlsoReferenceOfSubentryToSubentryQueryValidator()(query)
  ) {
  } else {
  }
}
