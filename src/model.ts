import type * as hast from "hast";
import { toText } from "hast-util-to-text";

export type IndexId = string;

export type ResolvedKey = [string, string];
export type UnresolvedKey = [string, null];
export type Key = ResolvedKey | UnresolvedKey;
export type HasKey<TKey extends Key> = { key: TKey };

type PageLocator = string;
type RangeLocator = [PageLocator, PageLocator];
type Locator = PageLocator | RangeLocator;

type MainEntryReference<TKey extends Key> = [TKey, TKey];
type SubentryReference<TKey extends Key> = [TKey, TKey, TKey];
export type Reference<TKey extends Key> =
  | MainEntryReference<TKey>
  | SubentryReference<TKey>;

const sequentialIdBrand = Symbol();
type SequentialId = string & { [sequentialIdBrand]: unknown };
let counter = 0n;
function getId(): SequentialId {
  counter++;
  return counter.toString().padStart(16, "0") as SequentialId;
}

type HasLocators = { locators: [SequentialId, Locator, boolean][] };
export function insertLocator(entry: HasLocators, locator: [Locator, boolean]) {
  entry.locators.push([getId(), ...locator]);
}

type HasReferences<TKey extends Key> = {
  see: [SequentialId, ...Reference<TKey>][];
  seeAlso: [SequentialId, ...Reference<TKey>][];
};
export function insertReference<TKey extends Key>(
  entry: HasReferences<TKey>,
  type: "see" | "seeAlso",
  reference: Reference<TKey>,
) {
  entry[type].push([getId(), ...reference]);
}

export type EntryBase<TKey extends Key> = HasLocators & HasReferences<TKey>;
export type Subentry<TKey extends Key> = HasKey<TKey> & EntryBase<TKey>;
export type ParentOf<T> = { children: T[] };
export type MainEntry<TKey extends Key> = HasKey<TKey> &
  EntryBase<TKey> &
  ParentOf<Subentry<TKey>>;
export type Group<TKey extends Key> = HasKey<TKey> & ParentOf<MainEntry<TKey>>;

export type Index<TKey extends Key> = { id: IndexId } & ParentOf<Group<TKey>>;
export function ensureIndex<TKey extends Key>(
  indexes: Index<TKey>[],
  id: IndexId,
): Index<TKey> {
  return (
    indexes.find((idx) => idx.id === id) ??
    indexes[indexes.push({ id, children: [] }) - 1]!
  );
}

export function toHastChildren(value: string) {
  return JSON.stringify([{ type: "text", value } satisfies hast.Text]);
}

export function hastChildrenToText(hastJson: string) {
  return toText({
    type: "element",
    tagName: "span",
    children: JSON.parse(hastJson),
  });
}

export function getChild<TKey extends Key, TChild extends HasKey<TKey>>(
  parent: ParentOf<TChild>,
  key: TKey,
) {
  return parent.children.find(
    (child) =>
      hastChildrenToText(child.key[0]) === hastChildrenToText(key[0]) &&
      (key[1] === null || child.key[1] === key[1]),
  );
}

export function ensureChild<TKey extends Key, TChild extends HasKey<TKey>>(
  parent: ParentOf<TChild>,
  key: TKey,
  init: Omit<TChild, "key">,
) {
  return (
    getChild(parent, key) ??
    parent.children[
      parent.children.push({
        key,
        ...init,
      } as TChild) - 1
    ]!
  );
}

/* eslint-disable @typescript-eslint/no-unused-vars */
const example: Index<ResolvedKey>[] = [
  {
    id: ".",
    children: [
      {
        key: [toHastChildren("し"), "し"],
        children: [
          {
            key: [toHastChildren("自由利用"), "じゆうりよう"],
            locators: [
              [getId(), ["104", "108"], false],
              [getId(), "112", false],
            ],
            see: [],
            seeAlso: [],
            children: [],
          },
        ],
      },
      {
        key: [toHastChildren("そ"), "そ"],
        children: [
          {
            key: [toHastChildren("相続"), "そうぞく"],
            locators: [[getId(), "88", false]],
            see: [],
            seeAlso: [],
            children: [
              {
                key: [toHastChildren("一身専属"), "いっしんせんぞく"],
                locators: [[getId(), "76", false]],
                see: [],
                seeAlso: [],
              },
              {
                key: [toHastChildren("相続人"), "そうぞくにん"],
                locators: [[getId(), ["90", "91"], false]],
                see: [],
                seeAlso: [],
              },
            ],
          },
        ],
      },
      {
        key: [toHastChildren("ち"), "ち"],
        children: [
          {
            key: [toHastChildren("知的財産権"), "ちてきざいさんけん"],
            locators: [[getId(), ["56", "58"], false]],
            see: [],
            seeAlso: [],
            children: [],
          },
          {
            key: [toHastChildren("著作権"), "ちょさくけん"],
            locators: [
              [getId(), "3", false],
              [getId(), "8", false],
              [getId(), ["33", "35"], false],
            ],
            see: [],
            seeAlso: [
              [
                getId(),
                [toHastChildren("ち"), "ち"],
                [toHastChildren("知的財産権"), "ちてきざいさんけん"],
              ],
            ],
            children: [
              {
                key: [toHastChildren("――の使用"), "ちょさくけんのしよう"],
                locators: [[getId(), "150", false]],
                see: [],
                seeAlso: [],
              },
              {
                key: [toHastChildren("――の譲渡"), "ちょさくけんのじょうと"],
                locators: [
                  [getId(), "42", false],
                  [getId(), ["100", "104"], false],
                ],
                see: [],
                seeAlso: [],
              },
              {
                key: [toHastChildren("――の制限"), "ちょさくけんのせいげん"],
                locators: [],
                see: [
                  [
                    getId(),
                    [toHastChildren("し"), "し"],
                    [toHastChildren("自由利用"), "じゆうりよう"],
                  ],
                ],
                seeAlso: [],
              },
              {
                key: [toHastChildren("――の相続"), "ちょさくけんのそうぞく"],
                locators: [],
                see: [],
                seeAlso: [
                  [
                    getId(),
                    [toHastChildren("そ"), "そ"],
                    [toHastChildren("相続"), "そうぞく"],
                    [toHastChildren("一身専属"), "いっしんせんぞく"],
                  ],
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
