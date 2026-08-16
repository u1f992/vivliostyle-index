import assert from "node:assert";
import test from "node:test";

import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { selectAll } from "hast-util-select";
import { toText } from "hast-util-to-text";
import { h } from "hastscript";

import type { Index } from "../src/model.ts";
import { indexRenderer, renderIndex, type IndexRenderer } from "../src/render.ts";

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

function createIndexWithSubentry(): Index {
  return {
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
}

void test("puts a preamble before the list", () => {
  const target = createTarget();

  renderIndex(index, target, "index", { preamble: () => [h("p", "凡例"), h("hr")] });

  assert.deepStrictEqual(childTagNames(target), ["p", "hr", "div"]);
  assert.strictEqual(toText(target.children[0] as hast.Element), "凡例");
});

void test("keeps a preamble on an index without groups", () => {
  const target = createTarget();

  renderIndex({ children: [] }, target, "index", { preamble: () => [h("p", "凡例")] });

  assert.deepStrictEqual(childTagNames(target), ["p"]);
  assert.strictEqual(getAttribute(target, "data-index-result"), '{"children":[]}');
});

void test("renders every heading through the renderer of its level", () => {
  const target = createTarget();
  const levels: string[] = [];
  const heading =
    (level: string) =>
    (contents: hast.ElementContent[]): hast.ElementContent[] => {
      levels.push(level);
      const key = h(level === "group" ? "h2" : "span", { dataLevel: level }, contents);
      return level === "group" ? [key, h("hr")] : [key];
    };
  const renderer: IndexRenderer = {
    group: () => ({
      heading: heading("group"),
      entry: () => ({
        heading: heading("entry"),
        subentry: () => ({ heading: heading("subentry") }),
      }),
    }),
  };

  renderIndex(createIndexWithSubentry(), target, "index", renderer);
  const root = rootOf(target);

  assert.deepStrictEqual(levels, ["group", "entry", "subentry"]);
  assert.deepStrictEqual(selectAll(GROUP, root).map(childTagNames), [["h2", "hr", "ul"]]);
  assert.deepStrictEqual(
    selectAll(`${GROUP} > h2`, root).map((key) => toText(key)),
    ["そ"],
  );
  assert.deepStrictEqual(
    selectAll(`${ENTRY} > span[data-level="entry"]`, root).map((key) => toText(key)),
    ["相続"],
  );
  assert.deepStrictEqual(
    selectAll(`${SUBENTRY} > span[data-level="subentry"]`, root).map((key) => toText(key)),
    ["一身専属"],
  );
});

void test("renders each element through its self renderer", () => {
  const target = createTarget();
  const renderer: IndexRenderer = {
    group: ({ group }) => ({
      entry: () => ({
        self: ({ props, heading, locatorList }) => [
          h("li", { id: props.id, dataSelf: "entry" }, [...heading, ...locatorList]),
        ],
      }),
      self: ({ heading, entryList }) => [
        h("section", { dataReading: group.key.reading }, [...heading, ...entryList]),
      ],
    }),
    groupList: ({ groups }) => [
      h(
        "div",
        { dataGroups: String(groups.length) },
        groups.flatMap(({ children }) => children),
      ),
    ],
  };

  renderIndex(index, target, "index", renderer);
  const root = rootOf(target);

  assert.deepStrictEqual(
    selectAll("#index > div[data-groups='2'] > section", root).map((group) =>
      getAttribute(group, "data-reading"),
    ),
    ["ち", "そ"],
  );
  const entries = selectAll("li[data-self='entry']", root);
  assert.strictEqual(entries.length, 2);
  assert.deepStrictEqual(entries.map(childTagNames), [
    ["span", "ol"],
    ["span", "ol"],
  ]);
  assert.ok(entries.every((entry) => getAttribute(entry, "id") !== null));
});

void test("renders a subentry through its self renderer", () => {
  const target = createTarget();
  const renderer: IndexRenderer = {
    group: () => ({
      entry: () => ({
        subentry: () => ({
          locatorAnchors: ({ locator }) =>
            locator.location.type === "page"
              ? [h("a", { href: locator.location.href, dataSub: "" })]
              : [],
          self: ({ props, heading, locatorList }) => [
            h("li", { id: props.id, dataSelf: "subentry" }, [...heading, ...locatorList]),
          ],
        }),
      }),
    }),
  };

  renderIndex(createIndexWithSubentry(), target, "index", renderer);
  const root = rootOf(target);

  const subentries = selectAll("li[data-self='subentry']", root);
  assert.strictEqual(subentries.length, 1);
  assert.deepStrictEqual(subentries.map(childTagNames), [["span", "ol"]]);
  assert.ok(getAttribute(subentries[0]!, "id") !== null);
  assert.deepStrictEqual(
    selectAll("li[data-self='subentry'] > ol > li > a[data-sub]", root).map((link) =>
      getAttribute(link, "href"),
    ),
    ["076.html#c"],
  );
});

void test("takes the target properties from the index self renderer", () => {
  const target = createTarget();
  target.properties = { ...target.properties, dataIndex: "kept?" };
  const renderer: IndexRenderer = {
    self: ({ props, preamble, groupList }) => {
      const { dataIndexResult, ...rest } = props;
      return {
        properties: { ...rest, dataResultLength: String(String(dataIndexResult).length) },
        children: [...preamble, ...groupList],
      };
    },
  };

  renderIndex(index, target, "index", renderer);

  assert.strictEqual(getAttribute(target, "data-index-result"), null);
  assert.strictEqual(getAttribute(target, "data-index"), "kept?");
  assert.strictEqual(
    getAttribute(target, "data-result-length"),
    String(JSON.stringify(index).length),
  );
  assert.deepStrictEqual(childTagNames(target), ["div"]);
});

void test("applies the instruction template to the anchors its renderer returns", () => {
  const target = createTarget();
  const indexWithTemplates: Index = {
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
            xrefPreferred: [
              {
                target: {
                  group: { html: "し", reading: "し" },
                  entry: { html: "自由利用", reading: "じゆうりよう" },
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
    group: () => ({
      entry: () => ({
        locatorAnchors: ({ locator }) =>
          locator.location.type === "range"
            ? [
                h("a", { href: locator.location.start }),
                h("span", "から"),
                h("a", { href: locator.location.end }),
              ]
            : [],
        xrefAnchor: ({ href, contents }) => [h("a", { href, dataXref: "" }, contents)],
      }),
    }),
  };

  renderIndex(indexWithTemplates, target, "index", renderer);
  const root = rootOf(target);

  assert.deepStrictEqual(
    selectAll(`${LOCATORS} > li > strong > span`, root).map((separator) => toText(separator)),
    ["から"],
  );
  assert.strictEqual(selectAll(`${XREF_PREFERRED} > li > em > a[data-xref]`, root).length, 1);
});

void test("hands the template-applied nodes to the locator and cross-reference renderers", () => {
  const target = createTarget();
  const indexWithTemplates: Index = {
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
            ],
            xrefPreferred: [
              {
                target: {
                  group: { html: "し", reading: "し" },
                  entry: { html: "自由利用", reading: "じゆうりよう" },
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
    group: () => ({
      entry: () => ({
        locator: ({ children }) => [h("li", { dataItem: "locator" }, children)],
        xref: ({ type, children }) => [h("li", { dataItem: `xref-${type}` }, children)],
      }),
    }),
  };

  renderIndex(indexWithTemplates, target, "index", renderer);
  const root = rootOf(target);

  assert.deepStrictEqual(
    selectAll(`${LOCATORS} > li[data-item="locator"] > strong > a`, root).map((link) =>
      getAttribute(link, "href"),
    ),
    ["104.html#a"],
  );
  assert.strictEqual(
    selectAll(`${XREF_PREFERRED} > li[data-item="xref-preferred"] > em > a`, root).length,
    1,
  );
});

void test("renders every list through its list renderer", () => {
  const target = createTarget();
  const indexWithEveryList: Index = {
    children: [
      {
        key: { html: "そ", reading: "そ" },
        children: [
          {
            key: { html: "相続", reading: "そうぞく" },
            locators: [{ location: { type: "page", href: "088.html#b" } }],
            xrefPreferred: [
              {
                target: {
                  group: { html: "い", reading: "い" },
                  entry: { html: "遺産", reading: "いさん" },
                },
              },
            ],
            xrefRelated: [
              {
                target: {
                  group: { html: "ほ", reading: "ほ" },
                  entry: { html: "法定相続", reading: "ほうていそうぞく" },
                },
              },
            ],
            children: [
              {
                key: { html: "一身専属", reading: "いっしんせんぞく" },
                locators: [{ location: { type: "page", href: "076.html#c" } }],
                xrefPreferred: [],
                xrefRelated: [],
              },
            ],
          },
        ],
      },
    ],
  };
  const renderer: IndexRenderer = {
    group: () => ({
      entry: () => ({
        locatorList: ({ locators }) => [
          h(
            "ol",
            { dataList: `locators:${locators.length}` },
            locators.flatMap(({ children }) => children),
          ),
        ],
        xrefPreferredList: ({ xrefs }) => [
          h(
            "ul",
            {
              dataList: `preferred:${xrefs.map(({ xref }) => xref.target.entry.reading).join(",")}`,
            },
            xrefs.flatMap(({ children }) => children),
          ),
        ],
        xrefRelatedList: ({ xrefs }) => [
          h(
            "ul",
            { dataList: `related:${xrefs.map(({ xref }) => xref.target.entry.reading).join(",")}` },
            xrefs.flatMap(({ children }) => children),
          ),
        ],
        subentryList: ({ subentries }) => [
          h(
            "ul",
            {
              dataList: `subentries:${subentries.map(({ subentry }) => subentry.key.reading).join(",")}`,
            },
            subentries.flatMap(({ children }) => children),
          ),
        ],
      }),
    }),
  };

  renderIndex(indexWithEveryList, target, "index", renderer);
  const root = rootOf(target);

  assert.deepStrictEqual(
    selectAll(`${ENTRY} > [data-list]`, root).map((list) => getAttribute(list, "data-list")),
    ["locators:1", "preferred:いさん", "related:ほうていそうぞく", "subentries:いっしんせんぞく"],
  );
  assert.strictEqual(selectAll(`${ENTRY} > [data-list] > li > a`, root).length, 3);
  assert.strictEqual(selectAll(`${ENTRY} > [data-list] > li[id] > span`, root).length, 1);
});

void test("calls the nested list renderers when their lists are empty", () => {
  const target = createTarget();
  const indexWithVacantLists: Index = {
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
  const renderer: IndexRenderer = {
    group: () => ({
      entry: () => ({
        locatorList: ({ locators }) => [h("p", `locators:${locators.length}`)],
        xrefPreferredList: ({ xrefs }) => [h("p", `preferred:${xrefs.length}`)],
        xrefRelatedList: ({ xrefs }) => [h("p", `related:${xrefs.length}`)],
        subentryList: ({ subentries }) => [h("p", `subentries:${subentries.length}`)],
      }),
    }),
  };

  renderIndex(indexWithVacantLists, target, "index", renderer);

  assert.deepStrictEqual(
    selectAll(`${ENTRY} > p`, rootOf(target)).map((list) => toText(list)),
    ["locators:0", "preferred:0", "related:0", "subentries:0"],
  );
});

void test("renders an entry list through its renderer alone", () => {
  const target = createTarget();
  const renderer: IndexRenderer = {
    group: () => ({
      entryList: ({ entries }) => [
        h(
          "ul",
          { dataIndexRole: "entry-list", dataAlone: "" },
          entries.flatMap(({ children }) => children),
        ),
      ],
    }),
  };

  renderIndex(index, target, "index", renderer);
  const root = rootOf(target);

  assert.strictEqual(selectAll(`${GROUP} > ul[data-alone]`, root).length, 2);
  assert.strictEqual(selectAll(ENTRY, root).length, 2);
});

void test("pairs rendered fragments with their model nodes in list parts", () => {
  const target = createTarget();
  const renderer: IndexRenderer = {
    groupList: ({ groups }) => [
      h(
        "nav",
        groups.map(({ group }) => h("a", { href: `#${group.key.reading}` })),
      ),
      h(
        "div",
        { dataIndexRole: "group-list" },
        groups.flatMap(({ children }) => children),
      ),
    ],
    group: ({ group }) => ({
      entryList: ({ entries }) => [
        h(
          "ul",
          { dataEntries: entries.map(({ entry }) => entry.key.reading).join(",") },
          entries.flatMap(({ children }) => children),
        ),
      ],
      self: ({ heading, entryList }) => [
        h("section", { id: group.key.reading }, [...heading, ...entryList]),
      ],
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
});

void test("calls the group list renderer on an index without groups", () => {
  const target = createTarget();
  const renderer: IndexRenderer = {
    groupList: ({ groups }) =>
      groups.length === 0 ? [h("p", "該当なし")] : [h("div", { dataIndexRole: "group-list" })],
  };

  renderIndex({ children: [] }, target, "index", renderer);

  assert.deepStrictEqual(childTagNames(target), ["p"]);
  assert.strictEqual(toText(target.children[0] as hast.Element), "該当なし");
});

void test("links every level through one renderer factory call", () => {
  const target = createTarget();
  const renderer = indexRenderer({
    group: () => ({
      entry: () => ({
        heading: (contents) => [h("b", contents)],
      }),
      entryList: ({ entries }) => {
        const tags: "li"[] = entries.flatMap(({ children }) =>
          children.map(({ tagName }) => tagName),
        );
        return [
          h(
            "ul",
            { dataIndexRole: "entry-list", dataTags: tags.join(",") },
            entries.flatMap(({ children }) => children),
          ),
        ];
      },
    }),
    groupList: ({ groups }) => {
      const tags: "section"[] = groups.flatMap(({ children }) =>
        children.map(({ tagName }) => tagName),
      );
      return [
        h(
          "div",
          { dataIndexRole: "group-list", dataTags: tags.join(",") },
          groups.flatMap(({ children }) => children),
        ),
      ];
    },
  });

  const retained: Parameters<
    NonNullable<(typeof renderer)["groupList"]>
  >[0]["groups"][number]["children"][number]["tagName"] = "section";
  assert.strictEqual(retained, "section");
  // @ts-expect-error
  void (retained satisfies "ul");

  renderIndex(index, target, "index", renderer);
  const root = rootOf(target);

  assert.strictEqual(
    getAttribute(selectAll("#index > div", root)[0]!, "data-tags"),
    "section,section",
  );
  assert.deepStrictEqual(
    selectAll(`${GROUP} > ul`, root).map((list) => getAttribute(list, "data-tags")),
    ["li", "li"],
  );
  assert.deepStrictEqual(
    selectAll(`${ENTRY} > b`, root).map((key) => toText(key)),
    ["著作権", "相続"],
  );
});

void test("links the subentry level and hands its list to the entry self", () => {
  const target = createTarget();
  const renderer = indexRenderer({
    group: () => ({
      entry: () => ({
        subentry: () => ({
          locatorList: ({ locators }) => [
            h(
              "ol",
              { dataIndexRole: "locator-list", dataSub: String(locators.length) },
              locators.flatMap(({ children }) => children),
            ),
          ],
        }),
        subentryList: ({ subentries }) => {
          const tags: "li"[] = subentries.flatMap(({ children }) =>
            children.map(({ tagName }) => tagName),
          );
          // @ts-expect-error
          void (tags satisfies "ol"[]);
          return [
            h(
              "ul",
              { dataIndexRole: "subentry-list", dataTags: tags.join(",") },
              subentries.flatMap(({ children }) => children),
            ),
          ];
        },
        self: ({ props, heading, subentryList }) => [
          h("li", { ...props, dataSelf: "entry" }, [...heading, ...subentryList]),
        ],
      }),
    }),
  });

  renderIndex(createIndexWithSubentry(), target, "index", renderer);
  const root = rootOf(target);

  const entries = selectAll("li[data-self='entry']", root);
  assert.deepStrictEqual(entries.map(childTagNames), [["span", "ul"]]);
  assert.deepStrictEqual(
    selectAll(`li[data-self='entry'] > ul${roleOf("subentry-list")}`, root).map((list) =>
      getAttribute(list, "data-tags"),
    ),
    ["li"],
  );
  assert.deepStrictEqual(
    selectAll("li[data-self='entry'] > ul > li > ol[data-sub]", root).map((list) =>
      getAttribute(list, "data-sub"),
    ),
    ["1"],
  );
});

void test("renders subentry cross-references through the subentry renderers", () => {
  const target = createTarget();
  const indexWithSubentryXref: Index = {
    children: [
      {
        key: { html: "そ", reading: "そ" },
        children: [
          {
            key: { html: "相続", reading: "そうぞく" },
            locators: [{ location: { type: "page", href: "088.html#b" } }],
            xrefPreferred: [],
            xrefRelated: [],
            children: [
              {
                key: { html: "一身専属", reading: "いっしんせんぞく" },
                locators: [],
                xrefPreferred: [
                  {
                    target: {
                      group: { html: "そ", reading: "そ" },
                      entry: { html: "相続", reading: "そうぞく" },
                    },
                  },
                ],
                xrefRelated: [],
              },
            ],
          },
        ],
      },
    ],
  };
  const renderer: IndexRenderer = {
    group: () => ({
      entry: () => ({
        subentry: () => ({
          xrefAnchor: ({ href, contents }) => [h("a", { href, dataSubXref: "" }, contents)],
          xrefPreferredList: ({ xrefs }) => [
            h(
              "ul",
              { dataIndexRole: "xref-preferred", dataCount: String(xrefs.length) },
              xrefs.flatMap(({ children }) => children),
            ),
          ],
        }),
      }),
    }),
  };

  renderIndex(indexWithSubentryXref, target, "index", renderer);
  const root = rootOf(target);

  const links = selectAll(`${SUBENTRY} > ul[data-count="1"] > li > a[data-sub-xref]`, root);
  assert.deepStrictEqual(
    links.map((link) => toText(link)),
    ["相続"],
  );
  assert.ok(links.every((link) => getAttribute(link, "href")?.startsWith("#")));
});

void test("renders subentry locators and related cross-references through the subentry renderers", () => {
  const target = createTarget();
  const indexWithSubentryLists: Index = {
    children: [
      {
        key: { html: "そ", reading: "そ" },
        children: [
          {
            key: { html: "相続", reading: "そうぞく" },
            locators: [{ location: { type: "page", href: "088.html#b" } }],
            xrefPreferred: [],
            xrefRelated: [],
            children: [
              {
                key: { html: "一身専属", reading: "いっしんせんぞく" },
                locators: [{ location: { type: "page", href: "076.html#c" } }],
                xrefPreferred: [],
                xrefRelated: [
                  {
                    target: {
                      group: { html: "そ", reading: "そ" },
                      entry: { html: "相続", reading: "そうぞく" },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const renderer: IndexRenderer = {
    group: () => ({
      entry: () => ({
        subentry: () => ({
          locator: ({ children }) => [h("li", { dataItem: "sub-locator" }, children)],
          locatorList: ({ locators }) => [
            h(
              "ol",
              { dataList: `sub-locators:${locators.length}` },
              locators.flatMap(({ children }) => children),
            ),
          ],
          xref: ({ type, children }) => [h("li", { dataItem: `sub-xref-${type}` }, children)],
          xrefRelatedList: ({ xrefs }) => [
            h(
              "ul",
              { dataList: `sub-related:${xrefs.length}` },
              xrefs.flatMap(({ children }) => children),
            ),
          ],
        }),
      }),
    }),
  };

  renderIndex(indexWithSubentryLists, target, "index", renderer);
  const root = rootOf(target);

  assert.deepStrictEqual(
    selectAll(
      `${SUBENTRY} > ol[data-list="sub-locators:1"] > li[data-item="sub-locator"] > a`,
      root,
    ).map((link) => getAttribute(link, "href")),
    ["076.html#c"],
  );
  assert.deepStrictEqual(
    selectAll(
      `${SUBENTRY} > ul[data-list="sub-related:1"] > li[data-item="sub-xref-related"] > a`,
      root,
    ).map((link) => toText(link)),
    ["相続"],
  );
});

void test("hands read-only model nodes to the renderer closures", () => {
  const target = createTarget();
  const renderer: IndexRenderer = {
    group: ({ group }) => {
      void (() => {
        // @ts-expect-error
        group.children.push(group.children[0]!);
      });
      return {
        entry: ({ entry }) => {
          void (() => {
            // @ts-expect-error
            entry.locators.push(entry.locators[0]!);
          });
          return {};
        },
      };
    },
  };

  renderIndex(index, target, "index", renderer);

  assert.strictEqual(selectAll(GROUP, rootOf(target)).length, 2);
});

void test("shares one heading renderer between entries and subentries", () => {
  const target = createTarget();
  const heading = (contents: hast.ElementContent[]): hast.ElementContent[] => [
    h("span", { dataShared: "" }, contents),
  ];
  const renderer: IndexRenderer = {
    group: () => ({
      entry: () => ({
        heading,
        subentry: () => ({ heading }),
      }),
    }),
  };

  renderIndex(createIndexWithSubentry(), target, "index", renderer);
  const root = rootOf(target);

  assert.deepStrictEqual(
    selectAll(`${ENTRY} > span[data-shared]`, root).map((key) => toText(key)),
    ["相続"],
  );
  assert.deepStrictEqual(
    selectAll(`${SUBENTRY} > span[data-shared]`, root).map((key) => toText(key)),
    ["一身専属"],
  );
});
