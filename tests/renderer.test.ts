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
  type IndexRenderer,
  type LocatorListRenderer,
  type LocatorRenderer,
  type SubentryRenderer,
  type XrefPreferredListRenderer,
  type XrefPreferredRenderer,
  type XrefRelatedListRenderer,
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
const XREF_RELATED = `${ENTRY} > ${roleOf("xref-related")}`;
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
  const renderer: IndexRenderer = {
    compose: ({ groupList }) => [h("p", "凡例"), h("hr"), ...groupList],
  };

  renderIndex(index, populated, "index", renderer);
  renderIndex({ children: [] }, empty, "index", renderer);

  assert.deepStrictEqual(childTagNames(populated), ["p", "hr", "div"]);
  assert.deepStrictEqual(childTagNames(empty), ["p", "hr", "div"]);
});

void test("accepts arbitrary content and empty output from compose", () => {
  const textTarget = createTarget();
  const emptyTarget = createTarget();

  renderIndex(index, textTarget, "index", {
    compose: ({ groupList }) => [{ type: "text", value: String(groupList.length) }],
  });
  renderIndex(index, emptyTarget, "index", { compose: () => [] });

  assert.deepStrictEqual(textTarget.children, [{ type: "text", value: "1" }]);
  assert.deepStrictEqual(emptyTarget.children, []);
});

void test("calls group list compose for an index without groups", () => {
  const target = createTarget();
  const renderer: IndexRenderer = {
    groupList: {
      compose: ({ properties, groups }) =>
        groups.length === 0 ? [h("p", "該当なし")] : [h("div", properties)],
    },
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
    groupList: {
      group: () => ({
        heading: heading("group"),
        entryList: {
          entry: () => ({
            heading: heading("entry"),
            subentryList: {
              subentry: () => ({ heading: heading("subentry") }),
            },
          }),
        },
      }),
    },
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

void test("passes generated properties to structural compose functions", () => {
  const target = createTarget();
  const roles = new Set<string>();
  const ids = new Set<string>();
  const keys: string[] = [];
  const locatorList: LocatorListRenderer = {
    compose: ({ properties, locators }) => {
      roles.add(properties.dataIndexRole);
      return locators.flat();
    },
  };
  const xrefPreferredList: XrefPreferredListRenderer = {
    compose: ({ properties, xrefPreferreds }) => {
      assert.strictEqual(properties.dataIndexRole, "xref-preferred");
      roles.add(properties.dataIndexRole);
      return xrefPreferreds.flat();
    },
  };
  const xrefRelatedList: XrefRelatedListRenderer = {
    compose: ({ properties, xrefRelateds }) => {
      assert.strictEqual(properties.dataIndexRole, "xref-related");
      roles.add(properties.dataIndexRole);
      return xrefRelateds.flat();
    },
  };
  const renderer: IndexRenderer = {
    groupList: {
      compose: ({ properties, groups }) => {
        roles.add(properties.dataIndexRole);
        return groups.flat();
      },
      group: ({ group }) => {
        keys.push(group.reading);
        return {
          compose: ({ properties, heading, entryList }) => {
            roles.add(properties.dataIndexRole);
            return [h("section", properties, [...heading, ...entryList])];
          },
          entryList: {
            compose: ({ properties, entries }) => {
              roles.add(properties.dataIndexRole);
              return entries.flat();
            },
            entry: ({ entry }) => {
              keys.push(entry.reading);
              return {
                compose: ({
                  properties,
                  heading,
                  locatorList,
                  xrefPreferredList,
                  xrefRelatedList,
                  subentryList,
                }) => {
                  ids.add(properties.id);
                  return [
                    h("li", properties, [
                      ...heading,
                      ...locatorList,
                      ...xrefPreferredList,
                      ...xrefRelatedList,
                      ...subentryList,
                    ]),
                  ];
                },
                locatorList,
                xrefPreferredList,
                xrefRelatedList,
                subentryList: {
                  compose: ({ properties, subentries }) => {
                    roles.add(properties.dataIndexRole);
                    return subentries.flat();
                  },
                  subentry: ({ subentry }) => {
                    keys.push(subentry.reading);
                    return {
                      compose: ({
                        properties,
                        heading,
                        locatorList,
                        xrefPreferredList,
                        xrefRelatedList,
                      }) => {
                        ids.add(properties.id);
                        return [
                          h("li", properties, [
                            ...heading,
                            ...locatorList,
                            ...xrefPreferredList,
                            ...xrefRelatedList,
                          ]),
                        ];
                      },
                      locatorList,
                      xrefPreferredList,
                      xrefRelatedList,
                    };
                  },
                },
              };
            },
          },
        };
      },
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

void test("keeps the receiver of every renderer method", () => {
  const target = createTarget();
  const leafCalls: string[] = [];
  const locatorRenderer: LocatorRenderer = {
    compose({ properties }) {
      assert.strictEqual(this, locatorRenderer);
      assert.ok(properties.dataIndexRole === "page" || properties.dataIndexRole === "range");
      assert.strictEqual(properties.href.length > 0, true);
      leafCalls.push("locator-compose");
      return [];
    },
    pageNumber({ properties }) {
      assert.strictEqual(this, locatorRenderer);
      assert.strictEqual(properties.dataIndexRole, "page-number");
      assert.strictEqual(properties.dataIndexPageTarget.length > 0, true);
      leafCalls.push("page-number");
      return [];
    },
  };
  const locatorListRenderer: LocatorListRenderer = {
    locator({ locator }) {
      assert.strictEqual(this, locatorListRenderer);
      assert.ok(locator.location.type === "page" || locator.location.type === "range");
      leafCalls.push("locator");
      return locatorRenderer;
    },
  };
  const xrefRenderer: XrefPreferredRenderer = {
    entry({ properties, contents }) {
      assert.strictEqual(this, xrefRenderer);
      assert.strictEqual(properties.dataIndexRole, "xref-preferred-entry");
      leafCalls.push("xref-preferred-entry");
      return [h("span", properties, contents)];
    },
    compose() {
      assert.strictEqual(this, xrefRenderer);
      leafCalls.push("xref-preferred-compose");
      return [];
    },
  };
  const xrefListRenderer: XrefPreferredListRenderer = {
    xrefPreferred() {
      assert.strictEqual(this, xrefListRenderer);
      leafCalls.push("xref-preferred");
      return xrefRenderer;
    },
  };
  const subentryRenderer: SubentryRenderer = {
    heading({ contents }) {
      assert.strictEqual(this, subentryRenderer);
      leafCalls.push("subentry-heading");
      return [h("span", contents)];
    },
    locatorList: locatorListRenderer,
    xrefPreferredList: xrefListRenderer,
  };
  const entryRenderer: EntryRenderer = {
    heading({ contents }) {
      assert.strictEqual(this, entryRenderer);
      leafCalls.push("entry-heading");
      return [h("span", contents)];
    },
    locatorList: locatorListRenderer,
    subentryList: { subentry: () => subentryRenderer },
  };
  const groupRenderer: GroupRenderer = {
    heading({ contents }) {
      assert.strictEqual(this, groupRenderer);
      leafCalls.push("group-heading");
      return [h("span", contents)];
    },
    entryList: { entry: () => entryRenderer },
  };
  const renderer: IndexRenderer = {
    groupList: { group: () => groupRenderer },
  };

  renderIndex(indexWithSubentry, target, "index", renderer);

  const root = rootOf(target);
  assert.deepStrictEqual(leafCalls, [
    "group-heading",
    "entry-heading",
    "locator",
    "page-number",
    "locator-compose",
    "subentry-heading",
    "locator",
    "page-number",
    "locator-compose",
    "xref-preferred",
    "xref-preferred-entry",
    "xref-preferred-compose",
  ]);
  assert.strictEqual(selectAll('[data-index-role="locator-list"] > li', root).length, 0);
  assert.strictEqual(selectAll('[data-index-role="xref-preferred"] > li', root).length, 0);
});

void test("renders every branch through its compose function", () => {
  const target = createTarget();
  const renderer: IndexRenderer = {
    groupList: {
      compose: ({ properties, groups }) => [
        h("main", { ...properties, dataGroups: String(groups.length) }, groups.flat()),
      ],
      group: ({ group }) => ({
        compose: ({ properties, heading, entryList }) => [
          h("article", { ...properties, dataReading: group.reading }, [...heading, ...entryList]),
        ],
        entryList: {
          compose: ({ properties, entries }) => [h("ol", properties, entries.flat())],
          entry: () => ({
            compose: ({ properties, heading, locatorList }) => [
              h("li", { ...properties, dataCompose: "entry" }, [...heading, ...locatorList]),
            ],
          }),
        },
      }),
    },
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
    selectAll("li[data-compose='entry']", root).every(
      (entry) => getAttribute(entry, "id") !== null,
    ),
  );
});

void test("passes model keys to child factories and rendered content to list compose functions", () => {
  const target = createTarget();
  const groupKeys: string[] = [];
  const entryKeys: string[] = [];
  const renderer: IndexRenderer = {
    groupList: {
      compose: ({ properties, groups }) => {
        assert.ok(groups.every(Array.isArray));
        return [h("div", properties, groups.flat())];
      },
      group: ({ group }) => {
        groupKeys.push(group.reading);
        return {
          compose: ({ properties, heading, entryList }) => [
            h("section", properties, [...heading, ...entryList]),
          ],
          entryList: {
            compose: ({ properties, entries }) => {
              assert.ok(entries.every(Array.isArray));
              return [h("ul", properties, entries.flat())];
            },
            entry: ({ entry }) => {
              entryKeys.push(entry.reading);
              return { heading: ({ contents }) => [h("b", contents)] };
            },
          },
        };
      },
    },
  };

  renderIndex(index, target, "index", renderer);
  const root = rootOf(target);

  assert.deepStrictEqual(groupKeys, ["ち", "そ"]);
  assert.deepStrictEqual(entryKeys, ["ちょさくけん", "そうぞく"]);
  assert.deepStrictEqual(
    selectAll("#index > div > section > ul > li > b", root).map((element) => toText(element)),
    ["著作権", "相続"],
  );
});

void test("calls every nested list compose function for an empty list", () => {
  const target = createTarget();
  const renderer: IndexRenderer = {
    groupList: {
      group: () => ({
        entryList: {
          entry: () => ({
            locatorList: {
              compose: ({ locators }) => [h("p", `locators:${locators.length}`)],
            },
            xrefPreferredList: {
              compose: ({ xrefPreferreds }) => [h("p", `preferred:${xrefPreferreds.length}`)],
            },
            xrefRelatedList: {
              compose: ({ xrefRelateds }) => [h("p", `related:${xrefRelateds.length}`)],
            },
            subentryList: {
              compose: ({ subentries }) => [h("p", `subentries:${subentries.length}`)],
            },
          }),
        },
      }),
    },
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
    groupList: {
      group: () => ({
        entryList: {
          entry: () => ({
            locatorList: {
              compose: ({ properties, locators }) => [h("ol", properties, locators.flat())],
              locator: ({ locator }) => {
                return locator.location.type === "page"
                  ? {}
                  : {
                      compose: ({ properties: { href, ...properties }, contents }) => {
                        assert.strictEqual(href, "104.html#a");
                        return [h("span", properties, contents)];
                      },
                      pageNumber: ({ properties }) => [
                        h("a", { ...properties, href: properties.dataIndexPageTarget }),
                      ],
                      rangeSeparator: ({ properties }) => [h("span", properties, "から")],
                    };
              },
            },
          }),
        },
      }),
    },
  };

  renderIndex(rangeIndex, target, "index", renderer);
  const root = rootOf(target);

  assert.deepStrictEqual(
    selectAll(`${LOCATORS} > li > strong > span[data-index-role="range"] > *`, root).map(
      (element) => element.tagName,
    ),
    ["a", "span", "a"],
  );
  assert.strictEqual(
    getAttribute(selectAll(`${LOCATORS} > li > strong > span`, root)[0]!, "href"),
    null,
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

void test("applies xref templates after their distinct nested renderers", () => {
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
            xrefRelated: [
              {
                target: {
                  group: { html: "そ", reading: "そ" },
                  entry: { html: "相続", reading: "そうぞく" },
                  subentry: { html: "一身専属", reading: "いっしんせんぞく" },
                },
                template: "<strong><slot></slot></strong>",
              },
            ],
            children: [],
          },
        ],
      },
    ],
  };
  const renderer: IndexRenderer = {
    groupList: {
      group: () => ({
        entryList: {
          entry: () => ({
            xrefPreferredList: {
              compose: ({ properties, xrefPreferreds }) => {
                assert.strictEqual(properties.dataIndexRole, "xref-preferred");
                return [h("ul", properties, xrefPreferreds.flat())];
              },
              xrefPreferred: ({ xrefPreferred }) => {
                assert.strictEqual(xrefPreferred.target.subentry?.reading, "いっしんせんぞく");
                return {
                  compose: ({ properties, contents }) => {
                    assert.ok(properties.href.startsWith("#"));
                    assert.strictEqual(contents.length, 3);
                    return [h("a", { ...properties, dataCustom: "preferred" }, contents)];
                  },
                  entry: ({ properties, contents }) => {
                    assert.strictEqual(properties.dataIndexRole, "xref-preferred-entry");
                    return [h("span", properties, contents)];
                  },
                  subentrySeparator: ({ properties }) => {
                    assert.strictEqual(
                      properties.dataIndexRole,
                      "xref-preferred-subentry-separator",
                    );
                    return [h("span", properties)];
                  },
                  subentry: ({ properties, contents }) => {
                    assert.strictEqual(properties.dataIndexRole, "xref-preferred-subentry");
                    return [h("span", properties, contents)];
                  },
                };
              },
            },
            xrefRelatedList: {
              compose: ({ properties, xrefRelateds }) => {
                assert.strictEqual(properties.dataIndexRole, "xref-related");
                return [h("ul", properties, xrefRelateds.flat())];
              },
              xrefRelated: ({ xrefRelated }) => {
                assert.strictEqual(xrefRelated.target.subentry?.reading, "いっしんせんぞく");
                return {
                  compose: ({ properties, contents }) => {
                    assert.ok(properties.href.startsWith("#"));
                    assert.strictEqual(contents.length, 3);
                    return [h("a", { ...properties, dataCustom: "related" }, contents)];
                  },
                  entry: ({ properties, contents }) => {
                    assert.strictEqual(properties.dataIndexRole, "xref-related-entry");
                    return [h("span", properties, contents)];
                  },
                  subentrySeparator: ({ properties }) => {
                    assert.strictEqual(properties.dataIndexRole, "xref-related-subentry-separator");
                    return [h("span", properties)];
                  },
                  subentry: ({ properties, contents }) => {
                    assert.strictEqual(properties.dataIndexRole, "xref-related-subentry");
                    return [h("span", properties, contents)];
                  },
                };
              },
            },
          }),
        },
      }),
    },
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
  assert.deepStrictEqual(
    selectAll(`${XREF_PREFERRED} > li > em > a > span`, root).map((element) =>
      getAttribute(element, "data-index-role"),
    ),
    ["xref-preferred-entry", "xref-preferred-subentry-separator", "xref-preferred-subentry"],
  );
  assert.strictEqual(
    selectAll(`${XREF_RELATED} > li > strong > a[data-custom="related"]`, root).length,
    1,
  );
  assert.strictEqual(
    toText(selectAll(`${XREF_RELATED} > li > strong > a`, root)[0]!),
    "相続一身専属",
  );
  assert.deepStrictEqual(
    selectAll(`${XREF_RELATED} > li > strong > a > span`, root).map((element) =>
      getAttribute(element, "data-index-role"),
    ),
    ["xref-related-entry", "xref-related-subentry-separator", "xref-related-subentry"],
  );
});

void test("uses the same leaf and list contracts for subentries", () => {
  const target = createTarget();
  const renderer: IndexRenderer = {
    groupList: {
      group: () => ({
        entryList: {
          entry: () => ({
            subentryList: {
              compose: ({ properties, subentries }) => [h("ul", properties, subentries.flat())],
              subentry: ({ subentry }) => ({
                compose: ({ properties, heading, locatorList, xrefPreferredList }) => [
                  h("li", { ...properties, dataCompose: "subentry" }, [
                    ...heading,
                    ...locatorList,
                    ...xrefPreferredList,
                  ]),
                ],
                locatorList: {
                  compose: ({ properties, locators }) => [h("ol", properties, locators.flat())],
                  locator: () => ({
                    compose: ({ properties, contents }) => [
                      h("a", { ...properties, dataItem: subentry.reading }, contents),
                    ],
                  }),
                },
                xrefPreferredList: {
                  compose: ({ properties, xrefPreferreds }) => [
                    h("ul", properties, xrefPreferreds.flat()),
                  ],
                  xrefPreferred: () => ({
                    compose: ({ properties, contents }) => [
                      h("a", { ...properties, dataSubXref: "" }, contents),
                    ],
                  }),
                },
              }),
            },
          }),
        },
      }),
    },
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
  const renderer: IndexRenderer = {
    compose: ({ groupList }) => [h("main", groupList)],
  };

  renderIndex(index, target, "index", renderer);

  assert.strictEqual(getAttribute(target, "data-index-result"), JSON.stringify(index));
  assert.strictEqual(getAttribute(target, "data-index"), "kept");
  assert.strictEqual(selectAll("#index > main > div", rootOf(target)).length, 1);
});

void test("accepts arbitrary content and empty output at every branch", () => {
  const target = createTarget();
  const renderer: IndexRenderer = {
    groupList: {
      compose: ({ groups }) => groups.flat(),
      group: ({ group }) => ({
        compose: () => (group.reading === "ち" ? [] : [{ type: "text", value: group.html }]),
      }),
    },
  };

  renderIndex(index, target, "index", renderer);

  assert.deepStrictEqual(target.children, [{ type: "text", value: "そ" }]);
});

void test("shares one heading leaf between entries and subentries", () => {
  const target = createTarget();
  const heading: HeadingRenderer = ({ contents }) => [h("span", { dataShared: "" }, contents)];
  const renderer: IndexRenderer = {
    groupList: {
      group: () => ({
        entryList: {
          entry: () => ({
            heading,
            subentryList: {
              subentry: () => ({ heading }),
            },
          }),
        },
      }),
    },
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
