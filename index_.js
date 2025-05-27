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

// <span data-index='["index","さ","自由利用","じゆうりよう","page"]'>自由利用</span>
// <div data-index='["index","さ","自由利用","じゆうりよう","range"]'>
//   自由利用
// </div>
// <span data-index='["index","さ","相続","そうぞく","page"]'>相続</span>
// <span data-index='["index",["さ","相続","そうぞく"],"一身専属","いつしんせんぞく","page"]'>一身専属</span>
// <div data-index='["index",["さ","相続","そうぞく"],"相続人","そうぞくにん","range"]'>
//   相続人
// </div>
// <div data-index='["index","た","知的財産権","ちてきざいさんけん","range"]'>
//   知的財産権
// </div>
// <span data-index='["index","た","著作権","ちよさくけん","page"]'>著作権</span>
// <span data-index='["index","た","著作権","ちよさくけん","page"]'>著作権</span>
// <div data-index='["index","た","著作権","ちよさくけん","range"]'>
//   著作権
// </div>
// <span data-index='["index","た","著作権","ちよさくけん","seeAlso",["た","知的財産権","ちてきざいさんけん"]]'></span>
// <span data-index='["index",["た","著作権","ちよさくけん"],"――の使用","ちよさくけんのしよう","page"]'>著作権の使用</span>
// <span data-index='["index",["た","著作権","ちよさくけん"],"――の譲渡","ちよさくけんのじようと","page"]'>著作権の譲渡</span>
// <div data-index='["index",["た","著作権","ちよさくけん"],"――の譲渡","ちよさくけんのじようと","range"]'>
//   著作権の譲渡
// </div>
// <span data-index='["index",["た","著作権","ちよさくけん"],"――の制限","ちよさくけんのせいげん","see",["さ","自由利用","じゆうりよう"]]'></span>
// <span data-index='["index",["た","著作権","ちよさくけん"],"――の相続","ちよさくけんのそうぞく","page"]'>著作権の相続</span>
// <span data-index='["index",["た","著作権","ちよさくけん"],"――の相続","ちよさくけんのそうぞく","see",[["さ","相続","そうぞく"],"一身専属","いつしんせんぞく"]]'></span>
