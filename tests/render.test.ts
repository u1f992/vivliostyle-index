import assert from "node:assert";
import test from "node:test";

import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { select, selectAll } from "hast-util-select";
import { toText } from "hast-util-to-text";

import { createKey, type Index } from "../src/model.ts";
import { renderIndex } from "../src/render.ts";
import { identityTemplate } from "../src/template.ts";

const index: Index = {
  groups: [
    {
      key: createKey("ち", "ち"),
      entries: [
        {
          key: createKey("ちょさくけん", "著作権"),
          subentries: [],
          locators: [
            { location: { type: "page", href: "003.html#a" }, template: identityTemplate },
          ],
          xrefPreferred: [],
          xrefRelated: [],
        },
      ],
    },
    {
      key: createKey("そ", "そ"),
      entries: [
        {
          key: createKey("そうぞく", "相続"),
          subentries: [],
          locators: [
            { location: { type: "page", href: "088.html#b" }, template: identityTemplate },
          ],
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

  renderIndex(index, target, "index", {});

  const entry = select(ENTRY, rootOf(target));
  assert.ok(entry);
  assert.strictEqual(
    getAttribute(entry, "id"),
    "index.entry.aW5kZXg.44Gh.44Gh.44Gh44KH44GV44GP44GR44KT.6JGX5L2c5qip",
  );
});

void test("wraps every key in an element of its own", () => {
  const target = createTarget();
  const indexWithSubentry: Index = {
    groups: [
      {
        key: createKey("そ", "そ"),
        entries: [
          {
            key: createKey("そうぞく", "相続"),
            subentries: [
              {
                key: createKey("いっしんせんぞく", "一身専属"),
                locators: [
                  { location: { type: "page", href: "076.html#c" }, template: identityTemplate },
                ],
                xrefPreferred: [],
                xrefRelated: [],
              },
            ],
            locators: [
              { location: { type: "page", href: "088.html#b" }, template: identityTemplate },
            ],
            xrefPreferred: [],
            xrefRelated: [],
          },
        ],
      },
    ],
  };

  renderIndex(indexWithSubentry, target, "index", {});

  assert.deepStrictEqual(
    selectAll(`${GROUP} > h2`, rootOf(target)).map((key) => toText(key)),
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
    groups: [
      {
        key: createKey("あ", "あ"),
        entries: [
          {
            key: createKey("あ", "A"),
            locators: [
              { location: { type: "page", href: "001.html#a" }, template: identityTemplate },
            ],
            xrefPreferred: [
              {
                target: {
                  group: createKey("い", "い"),
                  entry: createKey("び", "B"),
                },
                template: identityTemplate,
              },
            ],
            xrefRelated: [
              {
                target: {
                  group: createKey("う", "う"),
                  entry: createKey("し", "C"),
                },
                template: identityTemplate,
              },
            ],
            subentries: [
              {
                key: createKey("でぃ", "D"),
                locators: [],
                xrefPreferred: [],
                xrefRelated: [],
              },
            ],
          },
        ],
      },
      {
        key: createKey("え", "え"),
        entries: [
          {
            key: createKey("い", "E"),
            locators: [
              { location: { type: "page", href: "002.html#b" }, template: identityTemplate },
            ],
            xrefPreferred: [],
            xrefRelated: [],
            subentries: [],
          },
        ],
      },
    ],
  };

  renderIndex(indexWithEveryList, target, "index", {});
  const root = rootOf(target);

  const entryLists = [
    "ul:locator-list",
    "ul:xref-preferred",
    "ul:xref-related",
    "ul:subentry-list",
  ];
  assert.deepStrictEqual(selectAll(ENTRY, root).map(listRoles), [entryLists, entryLists]);
  assert.deepStrictEqual(selectAll(SUBENTRY, root).map(listRoles), [
    ["ul:locator-list", "ul:xref-preferred", "ul:xref-related"],
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
    selectAll(`${XREF_PREFERRED} > li > a > span`, root).map((element) =>
      getAttribute(element, "data-index-role"),
    ),
    ["xref-preferred-entry"],
  );
  assert.deepStrictEqual(
    selectAll(`${XREF_RELATED} > li > a > span`, root).map((element) =>
      getAttribute(element, "data-index-role"),
    ),
    ["xref-related-entry"],
  );
  assert.deepStrictEqual(
    selectAll(`${SUBENTRY} > span`, root).map((key) => toText(key)),
    ["D"],
  );
});

void test("wraps a locator in the template of its instruction", () => {
  const target = createTarget();
  const indexWithTemplate: Index = {
    groups: [
      {
        key: createKey("し", "し"),
        entries: [
          {
            key: createKey("じゆうりよう", "自由利用"),
            locators: [
              {
                location: { type: "page", href: "104.html#a" },
                template: "<strong><slot></slot></strong>",
              },
              { location: { type: "page", href: "112.html#b" }, template: identityTemplate },
            ],
            xrefPreferred: [],
            xrefRelated: [],
            subentries: [
              {
                key: createKey("してきふくせい", "私的複製"),
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

  renderIndex(indexWithTemplate, target, "index", {});

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
    groups: [
      {
        key: createKey("ち", "ち"),
        entries: [
          {
            key: createKey("ちょさくけん", "著作権"),
            locators: [],
            xrefPreferred: [
              {
                target: {
                  group: createKey("ち", "ち"),
                  entry: createKey("ちてきざいさんけん", "知的財産権"),
                },
                template: "<strong>→<slot></slot></strong>",
              },
            ],
            xrefRelated: [
              {
                target: {
                  group: createKey("は", "は"),
                  entry: createKey("ぱぶりっくどめいん", "パブリックドメイン"),
                },
                template: identityTemplate,
              },
            ],
            subentries: [],
          },
        ],
      },
    ],
  };

  renderIndex(indexWithTemplate, target, "index", {});
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

void test("exposes the rendered index as node data on the target element", () => {
  const target = createTarget();
  const root: hast.Root = { type: "root", children: [target] };

  renderIndex(index, target, "index", {});

  assert.deepStrictEqual(selectAll("[data-index-result]", root), []);
  assert.deepStrictEqual(target.data?.indexResult, index);
});

void test("names the keys of the exposed index", () => {
  const target = createTarget();
  const indexWithEveryKey: Index = {
    groups: [
      {
        key: createKey("あ", "あ"),
        entries: [
          {
            key: createKey("あ", "A"),
            locators: [
              {
                location: { type: "page", href: "001.html#a" },
                template: "<em><slot></slot></em>",
              },
            ],
            xrefPreferred: [
              {
                target: {
                  group: createKey("い", "い"),
                  entry: createKey("び", "B"),
                  subentry: createKey("し", "C"),
                },
                template: identityTemplate,
              },
            ],
            xrefRelated: [],
            subentries: [],
          },
        ],
      },
    ],
  };

  renderIndex(indexWithEveryKey, target, "index", {});
  const exposed = target.data?.indexResult as Index;
  const entry = exposed.groups[0]!.entries[0]!;

  assert.deepStrictEqual(Object.keys(entry), [
    "key",
    "locators",
    "xrefPreferred",
    "xrefRelated",
    "subentries",
  ]);
  assert.deepStrictEqual(Object.keys(entry.locators[0]!), ["location", "template"]);
  assert.deepStrictEqual(Object.keys(entry.xrefPreferred[0]!.target), [
    "group",
    "entry",
    "subentry",
  ]);
});

void test("keeps an index instruction carried by the target element itself", () => {
  const instruction = "index.md?q=さ!索引#index";
  const target = createTarget();
  target.properties = { ...target.properties, dataIndex: instruction };

  renderIndex(index, target, "index", {});

  assert.strictEqual(getAttribute(target, "data-index"), instruction);
});

void test("exposes an emptied index on the target element", () => {
  const target = createTarget();

  renderIndex({ groups: [] }, target, "index", {});

  assert.strictEqual(target.children.length, 1);
  const groupList = select(roleOf("group-list"), target);
  assert.ok(groupList);
  assert.strictEqual(groupList.tagName, "div");
  assert.deepStrictEqual(target.data?.indexResult, { groups: [] });
});

void test("renders a page locator as a page link containing one page number", () => {
  const target = createTarget();

  renderIndex(index, target, "index", {});
  const root = rootOf(target);

  const page = select(`${LOCATORS} > li > a[data-index-role="page"]`, root);
  assert.ok(page);
  assert.strictEqual(getAttribute(page, "href"), "003.html#a");
  assert.deepStrictEqual(
    page.children.flatMap((child) => (child.type === "element" ? [child.tagName] : [])),
    ["span"],
  );
  const pageNumber = select('[data-index-role="page-number"]', page);
  assert.ok(pageNumber);
  assert.strictEqual(getAttribute(pageNumber, "data-index-page-target"), "003.html#a");
  assert.strictEqual(toText(page), "");
});

void test("renders a range locator as one start link containing two page numbers", () => {
  const target = createTarget();
  const indexWithRange: Index = {
    groups: [
      {
        key: createKey("し", "し"),
        entries: [
          {
            key: createKey("じゆうりよう", "自由利用"),
            locators: [
              {
                location: { type: "range", start: "104.html#a", end: "110.html#b" },
                template: identityTemplate,
              },
            ],
            xrefPreferred: [],
            xrefRelated: [],
            subentries: [],
          },
        ],
      },
    ],
  };

  renderIndex(indexWithRange, target, "index", {});
  const root = rootOf(target);

  const item = select(`${LOCATORS} > li`, root);
  assert.ok(item);
  assert.deepStrictEqual(
    item.children.flatMap((child) => (child.type === "element" ? [child.tagName] : [])),
    ["a"],
  );
  const range = select(`${LOCATORS} > li > a[data-index-role="range"]`, root);
  assert.ok(range);
  assert.strictEqual(getAttribute(range, "href"), "104.html#a");
  assert.deepStrictEqual(
    range.children.flatMap((child) => (child.type === "element" ? [child.tagName] : [])),
    ["span", "span", "span"],
  );
  const pageNumbers = selectAll('[data-index-role="page-number"]', range);
  assert.deepStrictEqual(
    pageNumbers.map((pageNumber) => getAttribute(pageNumber, "data-index-page-target")),
    ["104.html#a", "110.html#b"],
  );
  assert.ok(select('[data-index-role="range-separator"]', range));
  assert.strictEqual(toText(range), "");
});
