import type {
  IndexId,
  Key,
  EntryBase,
  Index,
  ResolvedKey,
  MainEntry,
  Subentry,
} from "../model.js";
import { defineCommand } from "../command.js";

import type * as hast from "hast";

type ExpandCommand = ["expand", IndexId];
export default defineCommand<ExpandCommand>(
  {
    type: "array",
    minItems: 2,
    maxItems: 2,
    prefixItems: [{ const: "expand" }, { $ref: "#/$defs/IndexId" }],
  },
  // @ts-expect-error resolved
  (cmd, indexes: Index<ResolvedKey>[], elem) => {
    const indexId = cmd[1];
    const target = indexes.find((idx) => idx.id === indexId);
    if (!target) {
      elem.children = [];
      return;
    }

    // Create index groups container
    const indexGroups: hast.Element = {
      type: "element",
      tagName: "ol",
      properties: { className: "index-groups" },
      children: [],
    };

    // Generate groups
    for (const group of target.children) {
      const groupElement: hast.Element = {
        type: "element",
        tagName: "li",
        properties: { className: "index-group" },
        children: [
          ...JSON.parse(group.key[0]),
          {
            type: "element",
            tagName: "ol",
            properties: { className: "index-main-entries" },
            children: generateMainEntries(
              group.children,
              indexId,
              `${indexId}--${JSON.stringify(group.key)}`,
            ),
          },
        ],
      };
      indexGroups.children.push(groupElement);
    }

    elem.children = [indexGroups];
  },
);

function generateMainEntries<TKey extends Key>(
  mainEntries: MainEntry<TKey>[],
  indexId: IndexId,
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
        ...JSON.parse(mainEntry.key[0]),
        ...(mainEntry.locators.length !== 0
          ? [generateLocators(mainEntry.locators, "index-main-entry-locators")]
          : []),
        ...(mainEntry.see.length !== 0
          ? [generateReferences(mainEntry.see, "index-main-entry-see", indexId)]
          : []),
        ...(mainEntry.seeAlso.length !== 0
          ? [
              generateReferences(
                mainEntry.seeAlso,
                "index-main-entry-see-also",
                indexId,
              ),
            ]
          : []),
        ...(mainEntry.children.length !== 0
          ? [generateSubentries(mainEntry.children, indexId, currentSlag)]
          : []),
      ],
    };
    return mainElement;
  });
}

function generateSubentries<TKey extends Key>(
  subentries: Subentry<TKey>[],
  indexId: IndexId,
  slag: string,
): hast.Element {
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
        ...JSON.parse(subentry.key[0]),
        ...(subentry.locators.length !== 0
          ? [generateLocators(subentry.locators, "index-subentry-locators")]
          : []),
        ...(subentry.see.length !== 0
          ? [generateReferences(subentry.see, "index-subentry-see", indexId)]
          : []),
        ...(subentry.seeAlso.length !== 0
          ? [
              generateReferences(
                subentry.seeAlso,
                "index-subentry-see-also",
                indexId,
              ),
            ]
          : []),
      ],
    })),
  };
}

function generateLocators<TKey extends Key>(
  locators: EntryBase<TKey>["locators"],
  className: string,
): hast.Element {
  return {
    type: "element",
    tagName: "ol",
    properties: { className },
    children: locators.map(([, locator, important]) => ({
      type: "element",
      tagName: "li",
      properties: { ...(important ? { className: "important" } : {}) },
      children: Array.isArray(locator)
        ? [
            {
              type: "element",
              tagName: "a",
              properties: { href: locator[0] },
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
              properties: { href: locator[1] },
              children: [],
            },
          ]
        : [
            {
              type: "element",
              tagName: "a",
              properties: { href: locator },
              children: [],
            },
          ],
    })),
  };
}

function generateReferences<TKey extends Key>(
  references: EntryBase<TKey>["see"],
  className: string,
  indexId: IndexId,
): hast.Element {
  return {
    type: "element",
    tagName: "ol",
    properties: { className },
    children: references.map(([, ...reference]) => ({
      type: "element",
      tagName: "li",
      children:
        reference.length === 2
          ? [
              {
                type: "element",
                tagName: "a",
                properties: {
                  href: `#${indexId}--${JSON.stringify(reference[0])}--${JSON.stringify(reference[1])}`,
                },
                children: JSON.parse(reference[1][0]),
              },
            ]
          : [
              {
                type: "element",
                tagName: "a",
                properties: {
                  href: `#${indexId}--${JSON.stringify(reference[0])}--${JSON.stringify(reference[1])}--${JSON.stringify(reference[2])}`,
                },
                children: [
                  {
                    type: "element",
                    tagName: "span",
                    children: JSON.parse(reference[1][0]),
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
                    children: JSON.parse(reference[2][0]),
                  },
                ],
              },
            ],
    })),
  };
}
