import assert from "node:assert";
import test from "node:test";

import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { selectAll } from "hast-util-select";
import { toText } from "hast-util-to-text";
import { h } from "hastscript";

import type { Index } from "../src/model.ts";
import {
  renderIndex,
  type EntryRenderer,
  type GroupRenderer,
  type HeadingRenderer,
  type IndexCompose,
  type IndexRenderer,
  type LocatorListRenderer,
  type LocatorRenderer,
  type SubentryRenderer,
  type XrefListRenderer,
} from "../src/render.ts";
import { identityTemplate } from "../src/template.ts";

const index: Index = {
  children: [
    {
      key: { html: "ち", reading: "ち" },
      children: [
        {
          key: { html: "著作権", reading: "ちょさくけん" },
          children: [],
          locators: [
            { location: { type: "page", href: "003.html#a" }, template: identityTemplate },
          ],
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
              locators: [
                { location: { type: "page", href: "076.html#c" }, template: identityTemplate },
              ],
              xrefPreferred: [
                {
                  target: {
                    group: { html: "そ", reading: "そ" },
                    entry: { html: "相続", reading: "そうぞく" },
                  },
                  template: identityTemplate,
                },
              ],
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

const roleOf = (role: string) => `[data-index-role="${role}"]`;
const GROUP = `#index > ${roleOf("group-list")} > section`;
const ENTRY = `${GROUP} > ${roleOf("entry-list")} > li`;
const LOCATORS = `${ENTRY} > ${roleOf("locator-list")}`;
const XREF_PREFERRED = `${ENTRY} > ${roleOf("xref-preferred")}`;
const SUBENTRY = `${ENTRY} > ${roleOf("subentry-list")} > li`;

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

function childTagNames(element: hast.Element): string[] {
  return element.children.flatMap((child) => (child.type === "element" ? [child.tagName] : []));
}

void test("composes content with and without groups", () => {
  const populated = createTarget();
  const empty = createTarget();
  const compose: ReturnType<IndexCompose> = ({ groupList }) => [
    h("p", "凡例"),
    h("hr"),
    ...groupList,
  ];

  renderIndex(index, populated, "index", {}, compose);
  renderIndex({ children: [] }, empty, "index", {}, compose);

  assert.deepStrictEqual(childTagNames(populated), ["p", "hr", "div"]);
  assert.deepStrictEqual(childTagNames(empty), ["p", "hr"]);
});

void test("accepts arbitrary content and empty output from compose", () => {
  const textTarget = createTarget();
  const emptyTarget = createTarget();

  renderIndex(index, textTarget, "index", {}, ({ groupList }) => [
    { type: "text", value: String(groupList.length) },
  ]);
  renderIndex(index, emptyTarget, "index", {}, () => []);

  assert.deepStrictEqual(textTarget.children, [{ type: "text", value: "1" }]);
  assert.deepStrictEqual(emptyTarget.children, []);
});

void test("calls group list self for an index without groups", () => {
  const target = createTarget();
  const renderer: IndexRenderer = {
    groupList: ({ properties }) => ({
      self: ({ groups }) => (groups.length === 0 ? [h("p", "該当なし")] : [h("div", properties)]),
    }),
  };

  renderIndex({ children: [] }, target, "index", renderer);

  assert.deepStrictEqual(childTagNames(target), ["p"]);
  assert.strictEqual(toText(target.children[0]!), "該当なし");
});

void test("renders headings through the leaf functions at every level", () => {
  const target = createTarget();
  const levels: string[] = [];
  const heading =
    (level: string): HeadingRenderer =>
    ({ properties, contents }) => {
      levels.push(level);
      return [h(level === "group" ? "h2" : "span", { ...properties, dataLevel: level }, contents)];
    };
  const renderer: IndexRenderer = {
    groupList: () => ({
      group: () => ({
        heading: heading("group"),
        entryList: () => ({
          entry: () => ({
            heading: heading("entry"),
            subentryList: () => ({
              subentry: () => ({ heading: heading("subentry") }),
            }),
          }),
        }),
      }),
    }),
  };

  renderIndex(indexWithSubentry, target, "index", renderer);
  const root = rootOf(target);

  assert.deepStrictEqual(levels, ["group", "entry", "subentry"]);
  assert.deepStrictEqual(
    selectAll(`${GROUP} > h2`, root).map((element) => toText(element)),
    ["そ"],
  );
  assert.deepStrictEqual(
    selectAll(`${ENTRY} > span[data-level="entry"]`, root).map((element) => toText(element)),
    ["相続"],
  );
  assert.deepStrictEqual(
    selectAll(`${SUBENTRY} > span[data-level="subentry"]`, root).map((element) => toText(element)),
    ["一身専属"],
  );
});

void test("passes generated properties when each structural renderer is created", () => {
  const target = createTarget();
  const roles = new Set<string>();
  const ids = new Set<string>();
  const keys: string[] = [];
  const renderer: IndexRenderer = {
    groupList: ({ properties }) => {
      roles.add(properties.dataIndexRole);
      return {
        group: ({ group, properties }) => {
          keys.push(group.reading);
          roles.add(properties.dataIndexRole);
          return {
            entryList: ({ properties }) => {
              roles.add(properties.dataIndexRole);
              return {
                entry: ({ entry, properties }) => {
                  keys.push(entry.reading);
                  ids.add(properties.id);
                  return {
                    locatorList: ({ properties }) => {
                      roles.add(properties.dataIndexRole);
                      return {};
                    },
                    xrefPreferredList: ({ type, properties }) => {
                      assert.strictEqual(type, "preferred");
                      roles.add(properties.dataIndexRole);
                      return {};
                    },
                    xrefRelatedList: ({ type, properties }) => {
                      assert.strictEqual(type, "related");
                      roles.add(properties.dataIndexRole);
                      return {};
                    },
                    subentryList: ({ properties }) => {
                      roles.add(properties.dataIndexRole);
                      return {
                        subentry: ({ subentry, properties }) => {
                          keys.push(subentry.reading);
                          ids.add(properties.id);
                          return {
                            locatorList: ({ properties }) => {
                              roles.add(properties.dataIndexRole);
                              return {};
                            },
                            xrefPreferredList: ({ properties }) => {
                              roles.add(properties.dataIndexRole);
                              return {};
                            },
                            xrefRelatedList: ({ properties }) => {
                              roles.add(properties.dataIndexRole);
                              return {};
                            },
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  renderIndex(indexWithSubentry, target, "index", renderer);

  assert.strictEqual(getAttribute(target, "data-index-result"), JSON.stringify(indexWithSubentry));
  assert.deepStrictEqual(keys, ["そ", "そうぞく", "いっしんせんぞく"]);
  assert.deepStrictEqual(
    roles,
    new Set([
      "group-list",
      "group",
      "entry-list",
      "locator-list",
      "xref-preferred",
      "xref-related",
      "subentry-list",
    ]),
  );
  assert.strictEqual(ids.size, 2);
  assert.ok([...ids].every((id) => id.length > 0));
});

void test("keeps the receiver of entry and subentry list factory methods", () => {
  const target = createTarget();
  let entryCalls = 0;
  let subentryCalls = 0;
  const subentryRenderer: SubentryRenderer = {
    locatorList() {
      assert.strictEqual(this, subentryRenderer);
      subentryCalls += 1;
      return {};
    },
    xrefPreferredList() {
      assert.strictEqual(this, subentryRenderer);
      subentryCalls += 1;
      return {};
    },
    xrefRelatedList() {
      assert.strictEqual(this, subentryRenderer);
      subentryCalls += 1;
      return {};
    },
  };
  const entryRenderer: EntryRenderer = {
    locatorList() {
      assert.strictEqual(this, entryRenderer);
      entryCalls += 1;
      return {};
    },
    xrefPreferredList() {
      assert.strictEqual(this, entryRenderer);
      entryCalls += 1;
      return {};
    },
    xrefRelatedList() {
      assert.strictEqual(this, entryRenderer);
      entryCalls += 1;
      return {};
    },
    subentryList: () => ({ subentry: () => subentryRenderer }),
  };
  const renderer: IndexRenderer = {
    groupList: () => ({
      group: () => ({
        entryList: () => ({ entry: () => entryRenderer }),
      }),
    }),
  };

  renderIndex(indexWithSubentry, target, "index", renderer);

  assert.strictEqual(entryCalls, 3);
  assert.strictEqual(subentryCalls, 3);
});

void test("keeps the receiver of every renderer method", () => {
  const target = createTarget();
  const leafCalls: string[] = [];
  const locatorRenderer: LocatorRenderer = {
    self({ href }) {
      assert.strictEqual(this, locatorRenderer);
      assert.strictEqual(href.length > 0, true);
      leafCalls.push("locator-self");
      return [];
    },
    pageNumber({ properties, target }) {
      assert.strictEqual(this, locatorRenderer);
      assert.strictEqual(properties.dataIndexRole, "page-number");
      assert.strictEqual(properties.dataIndexPageTarget, target);
      leafCalls.push("page-number");
      return [];
    },
  };
  const locatorListRenderer: LocatorListRenderer = {
    locator({ locator, properties }) {
      assert.strictEqual(this, locatorListRenderer);
      assert.strictEqual(properties.dataIndexRole, locator.location.type);
      leafCalls.push("locator");
      return locatorRenderer;
    },
  };
  const xrefListRenderer: XrefListRenderer = {
    xref() {
      assert.strictEqual(this, xrefListRenderer);
      leafCalls.push("xref");
      return [];
    },
  };
  const subentryRenderer: SubentryRenderer = {
    heading({ contents }) {
      assert.strictEqual(this, subentryRenderer);
      leafCalls.push("subentry-heading");
      return [h("span", contents)];
    },
    locatorList: () => locatorListRenderer,
    xrefPreferredList: () => xrefListRenderer,
  };
  const entryRenderer: EntryRenderer = {
    heading({ contents }) {
      assert.strictEqual(this, entryRenderer);
      leafCalls.push("entry-heading");
      return [h("span", contents)];
    },
    locatorList: () => locatorListRenderer,
    subentryList: () => ({ subentry: () => subentryRenderer }),
  };
  const groupRenderer: GroupRenderer = {
    heading({ contents }) {
      assert.strictEqual(this, groupRenderer);
      leafCalls.push("group-heading");
      return [h("span", contents)];
    },
    entryList: () => ({ entry: () => entryRenderer }),
  };
  const renderer: IndexRenderer = {
    groupList: () => ({ group: () => groupRenderer }),
  };

  renderIndex(indexWithSubentry, target, "index", renderer);

  const root = rootOf(target);
  assert.deepStrictEqual(leafCalls, [
    "group-heading",
    "entry-heading",
    "locator",
    "page-number",
    "locator-self",
    "subentry-heading",
    "locator",
    "page-number",
    "locator-self",
    "xref",
  ]);
  assert.strictEqual(selectAll('[data-index-role="locator-list"] > li', root).length, 0);
  assert.strictEqual(selectAll('[data-index-role="xref-preferred"] > li', root).length, 0);
});

void test("renders every branch through its self function", () => {
  const target = createTarget();
  const renderer: IndexRenderer = {
    groupList: ({ properties: groupListProperties }) => ({
      self: ({ groups }) => [
        h(
          "main",
          { ...groupListProperties, dataGroups: String(groups.length) },
          groups.flatMap(({ content }) => content),
        ),
      ],
      group: ({ group, properties: groupProperties }) => ({
        self: ({ heading, entryList }) => [
          h("article", { ...groupProperties, dataReading: group.reading }, [
            ...heading,
            ...entryList,
          ]),
        ],
        entryList: ({ properties: entryListProperties }) => ({
          self: ({ entries }) => [
            h(
              "ol",
              entryListProperties,
              entries.flatMap(({ content }) => content),
            ),
          ],
          entry: ({ properties: entryProperties }) => ({
            self: ({ heading, locatorList }) => [
              h("li", { ...entryProperties, dataSelf: "entry" }, [...heading, ...locatorList]),
            ],
          }),
        }),
      }),
    }),
  };

  renderIndex(index, target, "index", renderer);
  const root = rootOf(target);

  assert.deepStrictEqual(
    selectAll("#index > main > article", root).map((group) => getAttribute(group, "data-reading")),
    ["ち", "そ"],
  );
  assert.strictEqual(
    selectAll("#index > main[data-groups='2'] > article > ol > li", root).length,
    2,
  );
  assert.ok(
    selectAll("li[data-self='entry']", root).every((entry) => getAttribute(entry, "id") !== null),
  );
});

void test("passes model keys and rendered content to list self functions", () => {
  const target = createTarget();
  const renderer: IndexRenderer = {
    groupList: ({ properties: groupListProperties }) => ({
      self: ({ groups }) => [
        h(
          "nav",
          groups.map(({ group }) => h("a", { href: `#${group.reading}` })),
        ),
        h(
          "div",
          groupListProperties,
          groups.flatMap(({ content }) => content),
        ),
      ],
      group: ({ group, properties: groupProperties }) => ({
        self: ({ heading, entryList }) => [
          h("section", { ...groupProperties, id: group.reading }, [...heading, ...entryList]),
        ],
        entryList: ({ properties: entryListProperties }) => ({
          self: ({ entries }) => [
            h(
              "ul",
              {
                ...entryListProperties,
                dataEntries: entries.map(({ entry }) => entry.reading).join(","),
              },
              entries.flatMap(({ content }) => content),
            ),
          ],
          entry: () => ({
            heading: ({ contents }) => [h("b", contents)],
          }),
        }),
      }),
    }),
  };

  renderIndex(index, target, "index", renderer);
  const root = rootOf(target);

  assert.deepStrictEqual(
    selectAll("#index > nav > a", root).map((link) => getAttribute(link, "href")),
    ["#ち", "#そ"],
  );
  assert.deepStrictEqual(
    selectAll("#index > div > section > ul", root).map((list) =>
      getAttribute(list, "data-entries"),
    ),
    ["ちょさくけん", "そうぞく"],
  );
  assert.deepStrictEqual(
    selectAll("#index > div > section > ul > li > b", root).map((element) => toText(element)),
    ["著作権", "相続"],
  );
});

void test("calls every nested list self function for an empty list", () => {
  const target = createTarget();
  const renderer: IndexRenderer = {
    groupList: () => ({
      group: () => ({
        entryList: () => ({
          entry: () => ({
            locatorList: () => ({
              self: ({ locators }) => [h("p", `locators:${locators.length}`)],
            }),
            xrefPreferredList: () => ({
              self: ({ xrefs }) => [h("p", `preferred:${xrefs.length}`)],
            }),
            xrefRelatedList: () => ({
              self: ({ xrefs }) => [h("p", `related:${xrefs.length}`)],
            }),
            subentryList: () => ({
              self: ({ subentries }) => [h("p", `subentries:${subentries.length}`)],
            }),
          }),
        }),
      }),
    }),
  };
  const emptyLists: Index = {
    children: [
      {
        key: { html: "あ", reading: "あ" },
        children: [
          {
            key: { html: "A", reading: "あ" },
            locators: [],
            xrefPreferred: [],
            xrefRelated: [],
            children: [],
          },
        ],
      },
    ],
  };

  renderIndex(emptyLists, target, "index", renderer);

  assert.deepStrictEqual(
    selectAll(`${ENTRY} > p`, rootOf(target)).map((element) => toText(element)),
    ["locators:0", "preferred:0", "related:0", "subentries:0"],
  );
});

void test("applies a locator template after the nested locator renderer", () => {
  const target = createTarget();
  const rangeIndex: Index = {
    children: [
      {
        key: { html: "し", reading: "し" },
        children: [
          {
            key: { html: "自由利用", reading: "じゆうりよう" },
            locators: [
              {
                location: { type: "range", start: "104.html#a", end: "110.html#b" },
                template: "<strong><slot></slot></strong>",
              },
            ],
            xrefPreferred: [],
            xrefRelated: [],
            children: [],
          },
        ],
      },
    ],
  };
  const renderer: IndexRenderer = {
    groupList: () => ({
      group: () => ({
        entryList: () => ({
          entry: () => ({
            locatorList: ({ properties: listProperties }) => ({
              self: ({ locators }) => [
                h(
                  "ol",
                  listProperties,
                  locators.flatMap(({ content }) => content),
                ),
              ],
              locator: ({ locator, properties: locatorProperties }) => {
                assert.strictEqual(locatorProperties.dataIndexRole, locator.location.type);
                return locator.location.type === "page"
                  ? {}
                  : {
                      self: ({ contents }) => [h("span", locatorProperties, contents)],
                      pageNumber: ({ properties, target }) => [
                        h("a", { ...properties, href: target }),
                      ],
                      rangeSeparator: ({ properties }) => [h("span", properties, "から")],
                    };
              },
            }),
          }),
        }),
      }),
    }),
  };

  renderIndex(rangeIndex, target, "index", renderer);
  const root = rootOf(target);

  assert.deepStrictEqual(
    selectAll(`${LOCATORS} > li > strong > span[data-index-role="range"] > *`, root).map(
      (element) => element.tagName,
    ),
    ["a", "span", "a"],
  );
  assert.deepStrictEqual(
    selectAll(`${LOCATORS} > li > strong > span[data-index-role="range"] > a`, root).map((link) =>
      getAttribute(link, "href"),
    ),
    ["104.html#a", "110.html#b"],
  );
  assert.deepStrictEqual(
    selectAll(`${LOCATORS} [data-index-role="page-number"]`, root).map((pageNumber) =>
      getAttribute(pageNumber, "data-index-page-target"),
    ),
    ["104.html#a", "110.html#b"],
  );
});

void test("applies an xref template after the xref leaf", () => {
  const target = createTarget();
  const xrefIndex: Index = {
    children: [
      {
        key: { html: "し", reading: "し" },
        children: [
          {
            key: { html: "自由利用", reading: "じゆうりよう" },
            locators: [],
            xrefPreferred: [
              {
                target: {
                  group: { html: "そ", reading: "そ" },
                  entry: { html: "相続", reading: "そうぞく" },
                  subentry: { html: "一身専属", reading: "いっしんせんぞく" },
                },
                template: "<em><slot></slot></em>",
              },
            ],
            xrefRelated: [],
            children: [],
          },
        ],
      },
    ],
  };
  const renderer: IndexRenderer = {
    groupList: () => ({
      group: () => ({
        entryList: () => ({
          entry: () => ({
            xrefPreferredList: ({ type: listType, properties: listProperties }) => ({
              self: ({ xrefs }) => [
                h(
                  "ul",
                  listProperties,
                  xrefs.flatMap(({ content }) => content),
                ),
              ],
              xref: ({ xref, type, href, contents }) => {
                assert.strictEqual(listType, "preferred");
                assert.strictEqual(type, "preferred");
                assert.strictEqual(xref.target.subentry?.reading, "いっしんせんぞく");
                assert.ok(href.startsWith("#"));
                assert.strictEqual(contents.length, 3);
                return [h("a", { href, dataCustom: type }, contents)];
              },
            }),
          }),
        }),
      }),
    }),
  };

  renderIndex(xrefIndex, target, "index", renderer);
  const root = rootOf(target);

  assert.strictEqual(
    selectAll(`${XREF_PREFERRED} > li > em > a[data-custom="preferred"]`, root).length,
    1,
  );
  assert.strictEqual(
    toText(selectAll(`${XREF_PREFERRED} > li > em > a`, root)[0]!),
    "相続一身専属",
  );
});

void test("uses the same leaf and list contracts for subentries", () => {
  const target = createTarget();
  const renderer: IndexRenderer = {
    groupList: () => ({
      group: () => ({
        entryList: () => ({
          entry: () => ({
            subentryList: ({ properties: subentryListProperties }) => ({
              self: ({ subentries }) => [
                h(
                  "ul",
                  subentryListProperties,
                  subentries.flatMap(({ content }) => content),
                ),
              ],
              subentry: ({ subentry, properties: subentryProperties }) => ({
                self: ({ heading, locatorList, xrefPreferredList }) => [
                  h("li", { ...subentryProperties, dataSelf: "subentry" }, [
                    ...heading,
                    ...locatorList,
                    ...xrefPreferredList,
                  ]),
                ],
                locatorList: ({ properties: locatorListProperties }) => ({
                  self: ({ locators }) => [
                    h(
                      "ol",
                      locatorListProperties,
                      locators.flatMap(({ content }) => content),
                    ),
                  ],
                  locator: ({ properties }) => ({
                    self: ({ href, contents }) => [
                      h("a", { ...properties, href, dataItem: subentry.reading }, contents),
                    ],
                  }),
                }),
                xrefPreferredList: ({ properties: xrefListProperties }) => ({
                  self: ({ xrefs }) => [
                    h(
                      "ul",
                      xrefListProperties,
                      xrefs.flatMap(({ content }) => content),
                    ),
                  ],
                  xref: ({ href, contents }) => [h("a", { href, dataSubXref: "" }, contents)],
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };

  renderIndex(indexWithSubentry, target, "index", renderer);
  const root = rootOf(target);

  assert.deepStrictEqual(
    selectAll(`${SUBENTRY} > ol > li > a[data-item]`, root).map((link) =>
      getAttribute(link, "href"),
    ),
    ["076.html#c"],
  );
  assert.deepStrictEqual(
    selectAll(`${SUBENTRY} > ul > li > a[data-sub-xref]`, root).map((element) => toText(element)),
    ["相続"],
  );
});

void test("composes target children while preserving internally managed properties", () => {
  const target = createTarget();
  target.properties = { ...target.properties, dataIndex: "kept" };
  const compose: ReturnType<IndexCompose> = ({ groupList }) => [h("main", groupList)];

  renderIndex(index, target, "index", {}, compose);

  assert.strictEqual(getAttribute(target, "data-index-result"), JSON.stringify(index));
  assert.strictEqual(getAttribute(target, "data-index"), "kept");
  assert.strictEqual(selectAll("#index > main > div", rootOf(target)).length, 1);
});

void test("accepts arbitrary content and empty output at every branch", () => {
  const target = createTarget();
  const renderer: IndexRenderer = {
    groupList: () => ({
      self: ({ groups }) => groups.flatMap(({ content }) => content),
      group: ({ group }) => ({
        self: () => (group.reading === "ち" ? [] : [{ type: "text", value: group.html }]),
      }),
    }),
  };

  renderIndex(index, target, "index", renderer);

  assert.deepStrictEqual(target.children, [{ type: "text", value: "そ" }]);
});

void test("shares one heading leaf between entries and subentries", () => {
  const target = createTarget();
  const heading: HeadingRenderer = ({ contents }) => [h("span", { dataShared: "" }, contents)];
  const renderer: IndexRenderer = {
    groupList: () => ({
      group: () => ({
        entryList: () => ({
          entry: () => ({
            heading,
            subentryList: () => ({
              subentry: () => ({ heading }),
            }),
          }),
        }),
      }),
    }),
  };

  renderIndex(indexWithSubentry, target, "index", renderer);
  const root = rootOf(target);

  assert.deepStrictEqual(
    selectAll(`${ENTRY} > span[data-shared]`, root).map((element) => toText(element)),
    ["相続"],
  );
  assert.deepStrictEqual(
    selectAll(`${SUBENTRY} > span[data-shared]`, root).map((element) => toText(element)),
    ["一身専属"],
  );
});
