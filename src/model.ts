import type * as hast from "hast";
import { fromHtml } from "hast-util-from-html";
import { toText } from "hast-util-to-text";

export type Key = [string, string];
export type HasKey = { key: Key };

type PageLocator = string;
type RangeLocator = [PageLocator, PageLocator];
type Locator = PageLocator | RangeLocator;

type MainEntryReference = [Key, Key];
type SubentryReference = [Key, Key, Key];
export type Reference = MainEntryReference | SubentryReference;

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

type HasReferences = {
  see: [SequentialId, ...Reference][];
  seeAlso: [SequentialId, ...Reference][];
};
export function insertReference(
  entry: HasReferences,
  type: "see" | "seeAlso",
  reference: Reference,
) {
  entry[type].push([getId(), ...reference]);
}

export type EntryBase = HasLocators & HasReferences;
export type Subentry = HasKey & EntryBase;
export type ParentOf<T> = { children: T[] };
export type MainEntry = HasKey & EntryBase & ParentOf<Subentry>;
export type Group = HasKey & ParentOf<MainEntry>;

export type Index = ParentOf<Group>;

export function toHastChildren(value: string) {
  const root = fromHtml(value, { fragment: true });
  function stripPosition(node: hast.Root | hast.RootContent): void {
    delete node.position;
    if ("children" in node) {
      for (const child of node.children) {
        stripPosition(child);
      }
    }
  }
  stripPosition(root);
  return JSON.stringify(root.children);
}

export function hastChildrenToText(hastJson: string) {
  return toText({
    type: "element",
    tagName: "span",
    children: JSON.parse(hastJson),
  });
}

export function getChild<TChild extends HasKey>(parent: ParentOf<TChild>, key: Key) {
  return parent.children.find((child) => child.key[0] === key[0] && child.key[1] === key[1]);
}

export function ensureChild<TChild extends HasKey>(
  parent: ParentOf<TChild>,
  key: Key,
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
