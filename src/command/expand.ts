import { parseFragment } from "../html.ts";
import type { EntryBase, Index, MainEntry, Subentry } from "../model.ts";

import type * as hast from "hast";

export default function expand(index: Index, elem: hast.Element, elementId: string) {
  const indexGroups: hast.Element = {
    type: "element",
    tagName: "ol",
    properties: { className: "index-groups" },
    children: [],
  };

  for (const group of index.children) {
    const groupElement: hast.Element = {
      type: "element",
      tagName: "li",
      properties: { className: "index-group" },
      children: [
        ...parseFragment(group.key.html),
        {
          type: "element",
          tagName: "ol",
          properties: { className: "index-main-entries" },
          children: generateMainEntries(
            group.children,
            elementId,
            `${elementId}--${JSON.stringify(group.key)}`,
          ),
        },
      ],
    };
    indexGroups.children.push(groupElement);
  }

  elem.children = [indexGroups];
}

function generateMainEntries(
  mainEntries: MainEntry[],
  elementId: string,
  slag: string,
): hast.ElementContent[] {
  return mainEntries.map((mainEntry) => {
    const currentSlag = `${slag}--${JSON.stringify(mainEntry.key)}`;
    const mainElement: hast.Element = {
      type: "element",
      tagName: "li",
      properties: {
        className: "index-main-entry",
        id: currentSlag,
      },
      children: [
        ...parseFragment(mainEntry.key.html),
        ...(mainEntry.locators.length !== 0
          ? [generateLocators(mainEntry.locators, "index-main-entry-locators")]
          : []),
        ...(mainEntry.see.length !== 0
          ? [generateReferences(mainEntry.see, "index-main-entry-see", elementId)]
          : []),
        ...(mainEntry.seeAlso.length !== 0
          ? [generateReferences(mainEntry.seeAlso, "index-main-entry-see-also", elementId)]
          : []),
        ...(mainEntry.children.length !== 0
          ? [generateSubentries(mainEntry.children, elementId, currentSlag)]
          : []),
      ],
    };
    return mainElement;
  });
}

function generateSubentries(subentries: Subentry[], elementId: string, slag: string): hast.Element {
  return {
    type: "element",
    tagName: "ol",
    properties: { className: "index-subentries" },
    children: subentries.map((subentry) => ({
      type: "element",
      tagName: "li",
      properties: {
        className: "index-subentry",
        id: `${slag}--${JSON.stringify(subentry.key)}`,
      },
      children: [
        ...parseFragment(subentry.key.html),
        ...(subentry.locators.length !== 0
          ? [generateLocators(subentry.locators, "index-subentry-locators")]
          : []),
        ...(subentry.see.length !== 0
          ? [generateReferences(subentry.see, "index-subentry-see", elementId)]
          : []),
        ...(subentry.seeAlso.length !== 0
          ? [generateReferences(subentry.seeAlso, "index-subentry-see-also", elementId)]
          : []),
      ],
    })),
  };
}

function generateLocators(locators: EntryBase["locators"], className: string): hast.Element {
  return {
    type: "element",
    tagName: "ol",
    properties: { className },
    children: locators.map(({ locator, important }) => ({
      type: "element",
      tagName: "li",
      properties: important ? { className: "important" } : {},
      children:
        typeof locator === "string"
          ? [
              {
                type: "element",
                tagName: "a",
                properties: { href: locator },
                children: [],
              },
            ]
          : [
              {
                type: "element",
                tagName: "a",
                properties: { href: locator.start },
                children: [],
              },
              {
                type: "element",
                tagName: "span",
                properties: { className: className + "-separator" },
                children: [],
              },
              {
                type: "element",
                tagName: "a",
                properties: { href: locator.end },
                children: [],
              },
            ],
    })),
  };
}

function generateReferences(
  references: EntryBase["see"],
  className: string,
  elementId: string,
): hast.Element {
  return {
    type: "element",
    tagName: "ol",
    properties: { className },
    children: references.map(({ target }) => ({
      type: "element",
      tagName: "li",
      children:
        target.subentry === undefined
          ? [
              {
                type: "element",
                tagName: "a",
                properties: {
                  href: `#${elementId}--${JSON.stringify(target.group)}--${JSON.stringify(target.mainEntry)}`,
                },
                children: parseFragment(target.mainEntry.html),
              },
            ]
          : [
              {
                type: "element",
                tagName: "a",
                properties: {
                  href: `#${elementId}--${JSON.stringify(target.group)}--${JSON.stringify(target.mainEntry)}--${JSON.stringify(target.subentry)}`,
                },
                children: [
                  {
                    type: "element",
                    tagName: "span",
                    children: parseFragment(target.mainEntry.html),
                  },
                  {
                    type: "element",
                    tagName: "span",
                    properties: { className: className + "-separator" },
                    children: [],
                  },
                  {
                    type: "element",
                    tagName: "span",
                    children: parseFragment(target.subentry.html),
                  },
                ],
              },
            ],
    })),
  };
}
