import assert from "node:assert";
import test from "node:test";

import type { Entry, EntryAddress, Group, Index, Key, Subentry, Xref } from "../src/model.ts";
import {
  byKeys,
  byListedOrder,
  byLocales,
  defaultComparator,
  sort,
  type CreateKeyComparator,
} from "../src/sort.ts";
import { identityTemplate } from "../src/template.ts";

const symbols = { html: "記号", reading: "記号" };
const aRow = { html: "あ行", reading: "あ" };
const kaRow = { html: "か行", reading: "か" };
const umlaut = { html: "ä", reading: "ä" };
const z = { html: "z", reading: "z" };

const plainKey = (name: string): Key => ({ html: name, reading: name });
const createXref = (target: EntryAddress): Xref => ({ target, template: identityTemplate });

function createGroups(...keys: readonly Key[]): Group[] {
  return keys.map((key) => ({ key, children: [] }));
}

function keysOf(groups: readonly Group[]): [string, string][] {
  return groups.map(({ key }) => [key.html, key.reading]);
}

function createSubentry(key: Key): Subentry {
  return { key, locators: [], xrefPreferred: [], xrefRelated: [] };
}

function createEntry(key: Key): Entry {
  return { key, children: [], locators: [], xrefPreferred: [], xrefRelated: [] };
}

void test("creates comparators for every index collection", () => {
  const comparator = defaultComparator("ja");

  assert.deepStrictEqual(Object.keys(comparator), [
    "group",
    "entry",
    "entryXrefPreferred",
    "entryXrefRelated",
    "subentry",
    "subentryXrefPreferred",
    "subentryXrefRelated",
  ]);
  assert.ok(Object.values(comparator).every((compare) => typeof compare === "function"));
});

void test("orders listed keys by their position instead of by locale", () => {
  const groups = createGroups(aRow, kaRow);

  groups.sort(byKeys(byListedOrder([kaRow, aRow])("ja")));

  assert.deepStrictEqual(keysOf(groups), [
    ["か行", "か"],
    ["あ行", "あ"],
  ]);
});

void test("reads a listed string as a key whose reading and HTML are the same", () => {
  const groups = createGroups(kaRow, symbols);

  groups.sort(byKeys(byListedOrder(["記号"])("ja")));

  assert.deepStrictEqual(keysOf(groups), [
    ["記号", "記号"],
    ["か行", "か"],
  ]);
});

void test("matches a listed key only when both the reading and the HTML agree", () => {
  const listed = { html: "か行", reading: "か" };
  const sameHtml = { html: "か行", reading: "き" };
  const sameReading = { html: "KA", reading: "か" };
  const groups = createGroups(sameHtml, sameReading, listed);

  groups.sort(byKeys(byListedOrder([listed])("ja")));

  assert.deepStrictEqual(keysOf(groups), [
    ["か行", "か"],
    ["KA", "か"],
    ["か行", "き"],
  ]);
});

void test("matches a listed key across Unicode normalization forms", () => {
  const nfd = { html: "a\u0308", reading: "a\u0308" };
  const groups = createGroups(z, nfd);

  groups.sort(byKeys(byListedOrder([umlaut, z])("en")));

  assert.deepStrictEqual(keysOf(groups), [
    ["a\u0308", "a\u0308"],
    ["z", "z"],
  ]);
});

void test("keeps the first position of a key listed more than once", () => {
  const groups = createGroups(aRow, kaRow);

  groups.sort(byKeys(byListedOrder([kaRow, aRow, kaRow])("ja")));

  assert.deepStrictEqual(keysOf(groups), [
    ["か行", "か"],
    ["あ行", "あ"],
  ]);
});

void test("sorts unlisted keys after listed ones by the given locale", () => {
  const groups = createGroups(kaRow, aRow, symbols);

  groups.sort(byKeys(byListedOrder(["記号"])("ja")));

  assert.deepStrictEqual(keysOf(groups), [
    ["記号", "記号"],
    ["あ行", "あ"],
    ["か行", "か"],
  ]);
});

void test("prefers an explicit fallback over the locale for unlisted keys", () => {
  const groups = createGroups(aRow, kaRow, symbols);

  groups.sort(byKeys(byListedOrder(["記号"], byListedOrder([kaRow, aRow]))("ja")));

  assert.deepStrictEqual(keysOf(groups), [
    ["記号", "記号"],
    ["か行", "か"],
    ["あ行", "あ"],
  ]);
});

void test("sorts unlisted keys with the locale it is created for", () => {
  const swedish = createGroups(umlaut, z, symbols);
  const english = createGroups(umlaut, z, symbols);

  swedish.sort(byKeys(byListedOrder(["記号"])("sv")));
  english.sort(byKeys(byListedOrder(["記号"])("en")));

  assert.deepStrictEqual(
    swedish.map(({ key }) => key.html),
    ["記号", "z", "ä"],
  );
  assert.deepStrictEqual(
    english.map(({ key }) => key.html),
    ["記号", "ä", "z"],
  );
});

void test("hands an explicit fallback the locale it is created for", () => {
  const requestedLocales: Intl.LocalesArgument[] = [];
  const fallback: CreateKeyComparator = (locales) => {
    requestedLocales.push(locales);
    return byLocales(locales);
  };
  const groups = createGroups(umlaut, z, symbols);

  groups.sort(byKeys(byListedOrder(["記号"], fallback)("sv")));

  assert.deepStrictEqual(requestedLocales, ["sv"]);
  assert.deepStrictEqual(
    groups.map(({ key }) => key.html),
    ["記号", "z", "ä"],
  );
});

void test("distinguishes listed keys that share the concatenation of their fields", () => {
  const listed = { html: "ab", reading: "c" };
  const shifted = { html: "a", reading: "bc" };
  const groups = createGroups(shifted, listed);

  groups.sort(byKeys(byListedOrder([listed])("en")));

  assert.deepStrictEqual(keysOf(groups), [
    ["ab", "c"],
    ["a", "bc"],
  ]);
});

void test("hands the locale to every collection of the default comparator", () => {
  const xref = (key: Key) => createXref({ group: plainKey("a"), entry: key });
  const subentry = (key: Key): Subentry => {
    const created = createSubentry(key);
    created.xrefPreferred.push(xref(umlaut), xref(z));
    created.xrefRelated.push(xref(umlaut), xref(z));
    return created;
  };
  const entry = createEntry(umlaut);
  entry.children.push(subentry(umlaut), subentry(z));
  entry.xrefPreferred.push(xref(umlaut), xref(z));
  entry.xrefRelated.push(xref(umlaut), xref(z));
  const index: Index = {
    children: [{ key: plainKey("a"), children: [entry, createEntry(z)] }],
  };

  const sorted = sort(index, defaultComparator("sv"));
  const sortedEntry = sorted.children[0]?.children[1];
  const sortedSubentry = sortedEntry?.children[0];
  const targetsOf = (xrefs: readonly { target: { entry: Key } }[]) =>
    xrefs.map(({ target }) => target.entry.html);

  assert.deepStrictEqual(
    sorted.children[0]?.children.map(({ key }) => key.html),
    ["z", "ä"],
  );
  assert.deepStrictEqual(
    sortedEntry?.children.map(({ key }) => key.html),
    ["z", "ä"],
  );
  assert.deepStrictEqual(targetsOf(sortedEntry?.xrefPreferred ?? []), ["z", "ä"]);
  assert.deepStrictEqual(targetsOf(sortedEntry?.xrefRelated ?? []), ["z", "ä"]);
  assert.deepStrictEqual(targetsOf(sortedSubentry?.xrefPreferred ?? []), ["z", "ä"]);
  assert.deepStrictEqual(targetsOf(sortedSubentry?.xrefRelated ?? []), ["z", "ä"]);
});

void test("orders cross-references by the listed order of their targets", () => {
  const entry = createEntry({ html: "著作権", reading: "ちょさくけん" });
  entry.xrefRelated.push(
    createXref({ group: aRow, entry: { html: "著作", reading: "ちょさく" } }),
    createXref({ group: kaRow, entry: { html: "権利", reading: "けんり" } }),
  );
  const index: Index = { children: [{ key: aRow, children: [entry] }] };

  const sorted = sort(index, {
    ...defaultComparator("ja"),
    entryXrefRelated: byKeys(byListedOrder([kaRow, aRow])("ja")),
  });

  assert.deepStrictEqual(
    sorted.children[0]?.children[0]?.xrefRelated.map(({ target }) => target.group.html),
    ["か行", "あ行"],
  );
});

void test("orders cross-references by their group before their entry", () => {
  const entry = createEntry(plainKey("copyright"));
  entry.xrefPreferred.push(
    createXref({ group: plainKey("z-group"), entry: plainKey("a-entry") }),
    createXref({ group: plainKey("a-group"), entry: plainKey("z-entry") }),
  );
  const index: Index = { children: [{ key: plainKey("a"), children: [entry] }] };

  const sorted = sort(index, defaultComparator("en"));

  assert.deepStrictEqual(
    sorted.children[0]?.children[0]?.xrefPreferred.map(({ target }) => target.group.html),
    ["a-group", "z-group"],
  );
});

void test("orders cross-references by their subentry when the listed headings agree", () => {
  const entry = createEntry({ html: "著作権", reading: "ちょさくけん" });
  const target = { group: aRow, entry: { html: "相続", reading: "そうぞく" } };
  const inheritor = { html: "相続人", reading: "そうぞくにん" };
  const exclusive = { html: "一身専属", reading: "いっしんせんぞく" };
  entry.xrefRelated.push(
    createXref({ ...target, subentry: exclusive }),
    createXref({ ...target, subentry: inheritor }),
  );
  const index: Index = { children: [{ key: aRow, children: [entry] }] };

  const sorted = sort(index, {
    ...defaultComparator("ja"),
    entryXrefRelated: byKeys(byListedOrder([aRow, inheritor, exclusive])("ja")),
  });

  assert.deepStrictEqual(
    sorted.children[0]?.children[0]?.xrefRelated.map(({ target: { subentry } }) => subentry?.html),
    ["相続人", "一身専属"],
  );
});

void test("orders a cross-reference to an entry before one to its subentry", () => {
  const entry = createEntry(plainKey("copyright"));
  const target = { group: plainKey("a"), entry: plainKey("inheritance") };
  entry.xrefPreferred.push(
    createXref({ ...target, subentry: plainKey("exclusive") }),
    createXref(target),
    createXref({ ...target, subentry: plainKey("heir") }),
  );
  const index: Index = { children: [{ key: plainKey("a"), children: [entry] }] };

  const sorted = sort(index, defaultComparator("en"));

  assert.deepStrictEqual(
    sorted.children[0]?.children[0]?.xrefPreferred.map(
      ({ target: { subentry } }) => subentry?.html,
    ),
    [undefined, "exclusive", "heir"],
  );
});

void test("sorts every collection of the index with its own comparator", () => {
  const subentry = (name: string): Subentry => {
    const created = createSubentry(plainKey(name));
    created.xrefPreferred.push(
      createXref({ group: plainKey("a"), entry: plainKey("z-sub-preferred") }),
      createXref({ group: plainKey("a"), entry: plainKey("a-sub-preferred") }),
    );
    created.xrefRelated.push(
      createXref({ group: plainKey("a"), entry: plainKey("z-sub-related") }),
      createXref({ group: plainKey("a"), entry: plainKey("a-sub-related") }),
    );
    return created;
  };
  const entry = createEntry(plainKey("a-entry"));
  entry.children.push(subentry("z-sub"), subentry("a-sub"));
  entry.xrefPreferred.push(
    createXref({ group: plainKey("a"), entry: plainKey("z-preferred") }),
    createXref({ group: plainKey("a"), entry: plainKey("a-preferred") }),
  );
  entry.xrefRelated.push(
    createXref({ group: plainKey("a"), entry: plainKey("z-related") }),
    createXref({ group: plainKey("a"), entry: plainKey("a-related") }),
  );
  const index: Index = {
    children: [
      { key: plainKey("z-group"), children: [] },
      { key: plainKey("a-group"), children: [createEntry(plainKey("z-entry")), entry] },
    ],
  };

  const sorted = sort(index, defaultComparator("en"));
  const group = sorted.children[0];
  const sortedEntry = group?.children[0];
  const sortedSubentry = sortedEntry?.children[0];

  assert.deepStrictEqual(
    sorted.children.map(({ key }) => key.html),
    ["a-group", "z-group"],
  );
  assert.deepStrictEqual(
    sorted.children[0]?.children.map(({ key }) => key.html),
    ["a-entry", "z-entry"],
  );
  assert.deepStrictEqual(
    sortedEntry?.xrefPreferred.map(({ target }) => target.entry.html),
    ["a-preferred", "z-preferred"],
  );
  assert.deepStrictEqual(
    sortedEntry?.xrefRelated.map(({ target }) => target.entry.html),
    ["a-related", "z-related"],
  );
  assert.deepStrictEqual(
    sortedEntry?.children.map(({ key }) => key.html),
    ["a-sub", "z-sub"],
  );
  assert.deepStrictEqual(
    sortedSubentry?.xrefPreferred.map(({ target }) => target.entry.html),
    ["a-sub-preferred", "z-sub-preferred"],
  );
  assert.deepStrictEqual(
    sortedSubentry?.xrefRelated.map(({ target }) => target.entry.html),
    ["a-sub-related", "z-sub-related"],
  );
});

void test("leaves the given index untouched", () => {
  const entry = createEntry(plainKey("z-entry"));
  entry.children.push(createSubentry(plainKey("z-sub")), createSubentry(plainKey("a-sub")));
  entry.xrefPreferred.push(
    createXref({ group: plainKey("a"), entry: plainKey("z-preferred") }),
    createXref({ group: plainKey("a"), entry: plainKey("a-preferred") }),
  );
  const index: Index = {
    children: [
      { key: plainKey("z-group"), children: [entry] },
      { key: plainKey("a-group"), children: [] },
    ],
  };
  const original = structuredClone(index);

  sort(index, defaultComparator("en"));

  assert.deepStrictEqual(index, original);
});

void test("compares keys by reading before falling back to the rendered text", () => {
  const groups = createGroups(
    { html: "<b>z</b>", reading: "same" },
    { html: "a", reading: "same" },
    { html: "c", reading: "earlier" },
  );

  groups.sort(byKeys(byLocales("en")));

  assert.deepStrictEqual(keysOf(groups), [
    ["c", "earlier"],
    ["a", "same"],
    ["<b>z</b>", "same"],
  ]);
});
