import assert from "node:assert";
import test from "node:test";

import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { select, selectAll } from "hast-util-select";
import { toText } from "hast-util-to-text";
import { h } from "hastscript";

import type { Index } from "../src/model.ts";
import {
  defaultHeading,
  renderIndex,
  type HeadingGenerator,
  type HeadingTier,
} from "../src/render.ts";

const index: Index = {
  children: [
    {
      key: { html: "ち", reading: "ち" },
      children: [
        {
          key: { html: "著作権", reading: "ちょさくけん" },
          children: [],
          locators: [{ location: { type: "page", href: "003.html#a" } }],
          xrefPreferred: [],
          xrefRelated: [],
        },
      ],
    },
    {
      key: { html: "そ", reading: "そ" },
      children: [
        {
          key: { html: "相続", reading: "そうぞく" },
          children: [],
          locators: [{ location: { type: "page", href: "088.html#b" } }],
          xrefPreferred: [],
          xrefRelated: [],
        },
      ],
    },
  ],
};

const roleOf = (role: string) => `[data-index-role="${role}"]`;
const GROUP = `#index > ${roleOf("group-list")} > section`;
const ENTRY = `${GROUP} > ${roleOf("entry-list")} > li`;
const LOCATORS = `${ENTRY} > ${roleOf("locator-list")}`;
const XREF_PREFERRED = `${ENTRY} > ${roleOf("xref-preferred")}`;
const XREF_RELATED = `${ENTRY} > ${roleOf("xref-related")}`;
const SUBENTRY = `${ENTRY} > ${roleOf("subentry-list")} > li`;
const SUBENTRY_LOCATORS = `${SUBENTRY} > ${roleOf("locator-list")}`;

function createTarget(): hast.Element {
  return {
    type: "element",
    tagName: "nav",
    properties: { id: "index" },
    children: [],
  };
}

function rootOf(target: hast.Element): hast.Root {
  return { type: "root", children: [target] };
}

void test("renders an index into the target element", () => {
  const target = createTarget();

  renderIndex(index, target, "index", defaultHeading({ h }));

  const entry = select(ENTRY, rootOf(target));
  assert.ok(entry);
  assert.strictEqual(
    getAttribute(entry, "id"),
    "aW5kZXg.44Gh.44Gh.44Gh44KH44GV44GP44GR44KT.6JGX5L2c5qip",
  );
});

void test("wraps every key in an element of its own", () => {
  const target = createTarget();
  const indexWithSubentry: Index = {
    children: [
      {
        key: { html: "そ", reading: "そ" },
        children: [
          {
            key: { html: "相続", reading: "そうぞく" },
            children: [
              {
                key: { html: "一身専属", reading: "いっしんせんぞく" },
                locators: [{ location: { type: "page", href: "076.html#c" } }],
                xrefPreferred: [],
                xrefRelated: [],
              },
            ],
            locators: [{ location: { type: "page", href: "088.html#b" } }],
            xrefPreferred: [],
            xrefRelated: [],
          },
        ],
      },
    ],
  };

  renderIndex(indexWithSubentry, target, "index", defaultHeading({ h }));

  assert.deepStrictEqual(
    selectAll(`${GROUP} > span`, rootOf(target)).map((key) => toText(key)),
    ["そ"],
  );
  assert.deepStrictEqual(
    selectAll(`${ENTRY} > span`, rootOf(target)).map((key) => toText(key)),
    ["相続"],
  );
  assert.deepStrictEqual(
    selectAll(`${SUBENTRY} > span`, rootOf(target)).map((key) => toText(key)),
    ["一身専属"],
  );
});

function listRoles(element: hast.Element): string[] {
  return element.children.flatMap((child) =>
    child.type === "element" && (child.tagName === "ol" || child.tagName === "ul")
      ? [`${child.tagName}:${getAttribute(child, "data-index-role")}`]
      : [],
  );
}

void test("gives every entry the same lists in the same order", () => {
  const target = createTarget();
  const indexWithEveryList: Index = {
    children: [
      {
        key: { html: "あ", reading: "あ" },
        children: [
          {
            key: { html: "A", reading: "あ" },
            locators: [{ location: { type: "page", href: "001.html#a" } }],
            xrefPreferred: [
              {
                target: {
                  group: { html: "い", reading: "い" },
                  entry: { html: "B", reading: "び" },
                },
              },
            ],
            xrefRelated: [
              {
                target: {
                  group: { html: "う", reading: "う" },
                  entry: { html: "C", reading: "し" },
                },
              },
            ],
            children: [
              {
                key: { html: "D", reading: "でぃ" },
                locators: [],
                xrefPreferred: [],
                xrefRelated: [],
              },
            ],
          },
        ],
      },
      {
        key: { html: "え", reading: "え" },
        children: [
          {
            key: { html: "E", reading: "い" },
            locators: [{ location: { type: "page", href: "002.html#b" } }],
            xrefPreferred: [],
            xrefRelated: [],
            children: [],
          },
        ],
      },
    ],
  };

  renderIndex(indexWithEveryList, target, "index", defaultHeading({ h }));
  const root = rootOf(target);

  const entryLists = [
    "ol:locator-list",
    "ul:xref-preferred",
    "ul:xref-related",
    "ul:subentry-list",
  ];
  assert.deepStrictEqual(selectAll(ENTRY, root).map(listRoles), [entryLists, entryLists]);
  assert.deepStrictEqual(selectAll(SUBENTRY, root).map(listRoles), [
    ["ol:locator-list", "ul:xref-preferred", "ul:xref-related"],
  ]);
  assert.deepStrictEqual(
    selectAll(`${LOCATORS} > li > a`, root).map((link) => getAttribute(link, "href")),
    ["001.html#a", "002.html#b"],
  );
  assert.deepStrictEqual(
    selectAll(`${XREF_PREFERRED} > li > a`, root).map((link) => toText(link)),
    ["B"],
  );
  assert.deepStrictEqual(
    selectAll(`${XREF_RELATED} > li > a`, root).map((link) => toText(link)),
    ["C"],
  );
  assert.deepStrictEqual(
    selectAll(`${SUBENTRY} > span`, root).map((key) => toText(key)),
    ["D"],
  );
});

void test("wraps a locator in the template of its instruction", () => {
  const target = createTarget();
  const indexWithTemplate: Index = {
    children: [
      {
        key: { html: "し", reading: "し" },
        children: [
          {
            key: { html: "自由利用", reading: "じゆうりよう" },
            locators: [
              {
                location: { type: "page", href: "104.html#a" },
                template: "<strong><slot></slot></strong>",
              },
              { location: { type: "page", href: "112.html#b" } },
            ],
            xrefPreferred: [],
            xrefRelated: [],
            children: [
              {
                key: { html: "私的複製", reading: "してきふくせい" },
                locators: [
                  {
                    location: { type: "page", href: "106.html#c" },
                    template: "<em><slot></slot></em>",
                  },
                ],
                xrefPreferred: [],
                xrefRelated: [],
              },
            ],
          },
        ],
      },
    ],
  };

  renderIndex(indexWithTemplate, target, "index", defaultHeading({ h }));

  assert.deepStrictEqual(
    selectAll(`${LOCATORS} > li > strong > a`, rootOf(target)).map((link) =>
      getAttribute(link, "href"),
    ),
    ["104.html#a"],
  );
  assert.deepStrictEqual(
    selectAll(`${LOCATORS} > li > a`, rootOf(target)).map((link) => getAttribute(link, "href")),
    ["112.html#b"],
  );
  assert.deepStrictEqual(
    selectAll(`${SUBENTRY_LOCATORS} > li > em > a`, rootOf(target)).map((link) =>
      getAttribute(link, "href"),
    ),
    ["106.html#c"],
  );
});

void test("wraps a cross-reference in the template of its instruction", () => {
  const target = createTarget();
  const indexWithTemplate: Index = {
    children: [
      {
        key: { html: "ち", reading: "ち" },
        children: [
          {
            key: { html: "著作権", reading: "ちょさくけん" },
            locators: [],
            xrefPreferred: [
              {
                target: {
                  group: { html: "ち", reading: "ち" },
                  entry: { html: "知的財産権", reading: "ちてきざいさんけん" },
                },
                template: "<strong>→<slot></slot></strong>",
              },
            ],
            xrefRelated: [
              {
                target: {
                  group: { html: "は", reading: "は" },
                  entry: { html: "パブリックドメイン", reading: "ぱぶりっくどめいん" },
                },
              },
            ],
            children: [],
          },
        ],
      },
    ],
  };

  renderIndex(indexWithTemplate, target, "index", defaultHeading({ h }));
  const root = rootOf(target);

  assert.deepStrictEqual(
    selectAll(`${XREF_PREFERRED} > li > strong > a`, root).map((link) => toText(link)),
    ["知的財産権"],
  );
  assert.deepStrictEqual(
    selectAll(`${XREF_RELATED} > li > a`, root).map((link) => toText(link)),
    ["パブリックドメイン"],
  );
});

function childTagNames(element: hast.Element): string[] {
  return element.children.flatMap((child) => (child.type === "element" ? [child.tagName] : []));
}

void test("puts a preamble before the list", () => {
  const target = createTarget();

  renderIndex(index, target, "index", defaultHeading({ h }), [h("p", "凡例"), h("hr")]);

  assert.deepStrictEqual(childTagNames(target), ["p", "hr", "div"]);
  assert.strictEqual(toText(target.children[0] as hast.Element), "凡例");
});

void test("keeps a preamble on an index without groups", () => {
  const target = createTarget();

  renderIndex({ children: [] }, target, "index", defaultHeading({ h }), [h("p", "凡例")]);

  assert.deepStrictEqual(childTagNames(target), ["p"]);
  assert.strictEqual(getAttribute(target, "data-index-result"), '{"children":[]}');
});

void test("exposes the rendered index as JSON on the target element", () => {
  const target = createTarget();
  const root: hast.Root = { type: "root", children: [target] };

  renderIndex(index, target, "index", defaultHeading({ h }));

  assert.deepStrictEqual(selectAll("[data-index-result]", root), [target]);
  assert.strictEqual(getAttribute(target, "data-index-result"), JSON.stringify(index));
});

void test("names the keys of the exposed index", () => {
  const target = createTarget();
  const indexWithEveryKey: Index = {
    children: [
      {
        key: { html: "あ", reading: "あ" },
        children: [
          {
            key: { html: "A", reading: "あ" },
            locators: [
              {
                location: { type: "page", href: "001.html#a" },
                template: "<em><slot></slot></em>",
              },
            ],
            xrefPreferred: [
              {
                target: {
                  group: { html: "い", reading: "い" },
                  entry: { html: "B", reading: "び" },
                  subentry: { html: "C", reading: "し" },
                },
              },
            ],
            xrefRelated: [],
            children: [],
          },
        ],
      },
    ],
  };

  renderIndex(indexWithEveryKey, target, "index", defaultHeading({ h }));
  const exposed = JSON.parse(getAttribute(target, "data-index-result") ?? "null");
  const entry = exposed.children[0].children[0];

  assert.deepStrictEqual(Object.keys(entry), [
    "key",
    "locators",
    "xrefPreferred",
    "xrefRelated",
    "children",
  ]);
  assert.deepStrictEqual(Object.keys(entry.locators[0]), ["location", "template"]);
  assert.deepStrictEqual(Object.keys(entry.xrefPreferred[0].target), [
    "group",
    "entry",
    "subentry",
  ]);
});

void test("keeps an index instruction carried by the target element itself", () => {
  const instruction = "index.md?q=さ!索引#index";
  const target = createTarget();
  target.properties = { ...target.properties, dataIndex: instruction };

  renderIndex(index, target, "index", defaultHeading({ h }));

  assert.strictEqual(getAttribute(target, "data-index"), instruction);
});

void test("exposes an emptied index on the target element", () => {
  const target = createTarget();

  renderIndex({ children: [] }, target, "index", defaultHeading({ h }));

  assert.deepStrictEqual(target.children, []);
  assert.strictEqual(getAttribute(target, "data-index-result"), '{"children":[]}');
});

void test("generates every heading through the given generator", () => {
  const target = createTarget();
  const tiers: HeadingTier[] = [];
  const heading: HeadingGenerator = (tier, props, children) => {
    tiers.push(tier);
    const key = h(tier === "group" ? "h2" : "span", { ...props, dataTier: tier }, [...children]);
    return tier === "group" ? [key, h("hr")] : [key];
  };
  const indexWithSubentry: Index = {
    children: [
      {
        key: { html: "そ", reading: "そ" },
        children: [
          {
            key: { html: "相続", reading: "そうぞく" },
            children: [
              {
                key: { html: "一身専属", reading: "いっしんせんぞく" },
                locators: [{ location: { type: "page", href: "076.html#c" } }],
                xrefPreferred: [],
                xrefRelated: [],
              },
            ],
            locators: [{ location: { type: "page", href: "088.html#b" } }],
            xrefPreferred: [],
            xrefRelated: [],
          },
        ],
      },
    ],
  };

  renderIndex(indexWithSubentry, target, "index", heading);
  const root = rootOf(target);

  assert.deepStrictEqual(tiers, ["group", "entry", "subentry"]);
  assert.deepStrictEqual(selectAll(GROUP, root).map(childTagNames), [["h2", "hr", "ul"]]);
  assert.deepStrictEqual(
    selectAll(`${GROUP} > h2`, root).map((key) => toText(key)),
    ["そ"],
  );
  assert.deepStrictEqual(
    selectAll(`${ENTRY} > span[data-tier="entry"]`, root).map((key) => toText(key)),
    ["相続"],
  );
  assert.deepStrictEqual(
    selectAll(`${SUBENTRY} > span[data-tier="subentry"]`, root).map((key) => toText(key)),
    ["一身専属"],
  );
});
