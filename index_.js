// @ts-check

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
 *   headword: string;
 *   reading: string;
 * }} ReferenceBase
 * @typedef {ReferenceBase & { type: "entry" }} EntryReference
 * @typedef {ReferenceBase & {
 *   type: "subentry";
 *   subHeadword: string;
 *   subReading: string;
 * }} SubentryReference
 *
 * @typedef {{
 *   headword: string;
 *   reading: string;
 *   locators: (PageLocator | RangeLocator)[];
 *   see: (EntryReference | SubentryReference)[];
 *   seeAlso: (EntryReference | SubentryReference)[];
 * }} EntryBase
 * @typedef {EntryBase} Subentry
 * @typedef {Subentry & { subentries: Subentry[] }} Entry
 *
 * @typedef {{ group: string; entries: Entry }} Group
 * @typedef {Group[]} Index
 * @typedef {{[key: string]: Index}} Indexes
 */

/**
 * @returns {Indexes}
 */
function create() {
  return {};
}

/**
 * @param {Indexes} indexes
 * @param {any} query
 */
function register(indexes, query) {}
