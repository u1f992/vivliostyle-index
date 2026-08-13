import assert from "node:assert";
import test from "node:test";

import type * as hast from "hast";
import { fromHtml } from "hast-util-from-html";
import { getAttribute } from "hast-util-get-attribute";
import { select, selectAll } from "hast-util-select";
import { toText } from "hast-util-to-text";
import unified from "unified";
import VFile from "vfile";

import {
  createIndexPlugin,
  defaultComparator,
  logMessages,
  type Comparators,
  type FileSystem,
} from "../src/index.ts";

const entryProcessor = {
  processSync: ({ contents }: { contents: unknown }) => ({ toString: () => String(contents) }),
};

function createFileSystem(files: Readonly<Record<string, string>>, updates: string[] = []) {
  const reads: string[] = [];
  const fileSystem: FileSystem = {
    readFileSync: (path) => {
      reads.push(path);
      const contents = files[path];
      if (contents === undefined) {
        throw new Error(`missing test file: ${path}`);
      }
      return contents;
    },
    touchSync: (path) => updates.push(path),
  };
  return { fileSystem, reads };
}

function createProcessor({
  entries,
  files,
  comparators,
  updates,
}: {
  entries: readonly string[];
  files: Readonly<Record<string, string>>;
  comparators?: Comparators;
  updates?: string[];
}) {
  const { fileSystem, reads } = createFileSystem(files, updates);
  const plugin = createIndexPlugin({
    entry: entries,
    entryContext: "/publication",
    ...(comparators === undefined ? {} : { comparators }),
    fileSystem,
  });
  const processor = unified().use(plugin, {
    createEntryProcessor: () => entryProcessor as never,
  });
  return { processor, reads };
}

function locatorLinks(root: hast.Root | hast.Element) {
  return selectAll(".index-main-entry-locators a", root).map((link) => getAttribute(link, "href"));
}

function groupHeadings(root: hast.Root | hast.Element) {
  return selectAll("li.index-group", root).map((group) => toText(group).slice(0, 1));
}

void test("logs VFile messages by severity", (context) => {
  const error = context.mock.method(console, "error", () => {});
  const warn = context.mock.method(console, "warn", () => {});
  const info = context.mock.method(console, "info", () => {});
  const file = VFile({ path: "/publication/chapter.md" });
  const fatal = file.message("fatal", undefined, "probe:fatal");
  fatal.fatal = true;
  file.message("warning", undefined, "probe:warning");
  file.info("information", undefined, "probe:information");

  unified().use(logMessages).runSync({ type: "root" }, file);

  assert.deepStrictEqual(error.mock.calls[0]?.arguments, [
    "/publication/chapter.md:1:1: fatal probe:fatal",
  ]);
  assert.deepStrictEqual(warn.mock.calls[0]?.arguments, [
    "/publication/chapter.md:1:1: warning probe:warning",
  ]);
  assert.deepStrictEqual(info.mock.calls[0]?.arguments, [
    "/publication/chapter.md:1:1: information probe:information",
  ]);
});

void test("reports anonymous files through VFile", () => {
  const { processor } = createProcessor({ entries: [], files: {} });
  const file = VFile();

  processor.runSync(fromHtml(""), file);

  assert.strictEqual(file.messages.length, 1);
  assert.strictEqual(file.messages[0]?.source, "vivliostyle-index");
  assert.strictEqual(file.messages[0]?.ruleId, "anonymous-file");
});

void test("renders a complete index before later source entries are transformed", () => {
  const files = {
    "/publication/001.md": '<span data-index="index.md?q=a!Apple#index">Apple</span>',
    "/publication/index.md": '<nav id="index"></nav>',
    "/publication/100.md": '<span data-index="index.md?q=z!Zebra#index">Zebra</span>',
  };
  const { processor, reads } = createProcessor({
    entries: ["001.md", "index.md", "100.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(reads, [
    "/publication/001.md",
    "/publication/index.md",
    "/publication/100.md",
  ]);
  assert.deepStrictEqual(locatorLinks(root), [
    "001.html#%2Fhtml%2Fbody%2Fspan",
    "100.html#%2Fhtml%2Fbody%2Fspan",
  ]);
});

void test("renders an index after source entries that follow it in the document", () => {
  const path = "/publication/chapter.md";
  const contents = [
    '<nav id="index"></nav>',
    '<span data-index="?q=a!Apple#index">Apple</span>',
  ].join("");
  const { processor } = createProcessor({
    entries: ["chapter.md"],
    files: { [path]: contents },
  });
  const root = fromHtml(contents);

  processor.runSync(root, { path });

  assert.deepStrictEqual(locatorLinks(root), ["#%2Fhtml%2Fbody%2Fspan"]);
});

void test("keeps target fragments as distinct indexes", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="index.md?q=a!Apple#subject">Apple</span>',
      '<span data-index="index.md?q=t!Ada#person">Ada</span>',
    ].join(""),
    "/publication/index.md": '<nav id="subject"></nav><nav id="person"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  const subject = select("#subject", root);
  const person = select("#person", root);
  assert.ok(subject);
  assert.ok(person);
  assert.match(toText(subject), /Apple/v);
  assert.doesNotMatch(toText(subject), /Ada/v);
  assert.match(toText(person), /Ada/v);
  assert.doesNotMatch(toText(person), /Apple/v);
});

void test("uses a comparator selected by path and element ID", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="index.md?q=z!Z#index">Z</span>',
      '<span data-index="index.md?q=ä!Ä#index">Ä</span>',
    ].join(""),
    "/publication/index.md": '<section lang="sv"><nav id="index"></nav></section>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
    comparators: [[{ path: "index.md", id: "index" }, defaultComparator("en")]],
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(groupHeadings(root), ["ä", "z"]);
});

void test("uses the last comparator configured for an index target", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="index.md?q=z!Z#index">Z</span>',
      '<span data-index="index.md?q=ä!Ä#index">Ä</span>',
    ].join(""),
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
    comparators: [
      [{ path: "index.md", id: "index" }, defaultComparator("en")],
      [{ path: "index.md", id: "index" }, defaultComparator("sv")],
    ],
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(groupHeadings(root), ["z", "ä"]);
});

void test("uses the closest language when no comparator is configured", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="index.md?q=z!Z#index">Z</span>',
      '<span data-index="index.md?q=ä!Ä#index">Ä</span>',
    ].join(""),
    "/publication/index.md":
      '<html lang="en"><section lang="sv"><nav id="index"></nav></section></html>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(groupHeadings(root), ["z", "ä"]);
});

void test("prefers the target language to ancestor languages", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="index.md?q=z!Z#index">Z</span>',
      '<span data-index="index.md?q=ä!Ä#index">Ä</span>',
    ].join(""),
    "/publication/index.md":
      '<html lang="en"><section lang="sv"><nav id="index" lang="en"></nav></section></html>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(groupHeadings(root), ["ä", "z"]);
});

void test("parses a heading word as inner HTML", () => {
  const files = {
    "/publication/chapter.md":
      '<span data-index="index.md?q=き!きょうとだいがく@%3Cem%3E京都大学%3C%2Fem%3E#index">京都大学</span>',
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  const heading = select(".index-main-entry > em", root);
  assert.ok(heading);
  assert.strictEqual(toText(heading), "京都大学");
});

void test("decodes a URL-encoded DSL query value", () => {
  const files = {
    "/publication/chapter.md":
      '<span data-index="index.md?q=a%5C%40b%2Bc!c%5C%7Cd%40%3Cem%3EC%5C%7CD%20%26amp%3B%20E%2BF%3C%2Fem%3E#index">C|D &amp; E+F</span>',
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  const groupHeading = select("li.index-group", root);
  assert.ok(groupHeading);
  assert.match(toText(groupHeading), /^a@b\+c/);
  const heading = select(".index-main-entry > em", root);
  assert.ok(heading);
  assert.strictEqual(toText(heading), "C|D & E+F");
});

void test("links a reference to a later entry", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="index.md?q=た!だいがく@大学|->き!きょうとだいがく@%3Cem%3E京都大学%3C%2Fem%3E#index">大学</span>',
      '<span data-index="index.md?q=き!きょうとだいがく@%3Cem%3E京都大学%3C%2Fem%3E#index">京都大学</span>',
    ].join(""),
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  const reference = selectAll("a", root).find((link) =>
    getAttribute(link, "href")?.startsWith("#"),
  );
  const target = selectAll("li", root).find(
    (entry) => getAttribute(entry, "class") === "index-main-entry" && select("em", entry) !== null,
  );
  assert.ok(reference);
  assert.ok(target);
  assert.strictEqual(getAttribute(reference, "href"), `#${getAttribute(target, "id")}`);
});

void test("links a reference to a later subentry", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="index.md?q=a!Alpha|->b!Beta!Gamma#index">Alpha</span>',
      '<span data-index="index.md?q=b!Beta!Gamma#index">Gamma</span>',
    ].join(""),
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  const reference = select(".index-main-entry-see a", root);
  const target = select("li.index-subentry", root);
  assert.ok(reference);
  assert.ok(target);
  assert.strictEqual(getAttribute(reference, "href"), `#${getAttribute(target, "id")}`);
  assert.deepStrictEqual(
    selectAll("span", reference).map((part) => toText(part)),
    ["Beta", "", "Gamma"],
  );
});

void test("revokes a heading left without content by an unresolved reference", () => {
  const files = {
    "/publication/chapter.md":
      '<span data-index="index.md?q=a!Apple|->b!Banana#index">Apple</span>',
    "/publication/index.md": '<nav id="index">placeholder</nav>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  const target = select("#index", root);
  assert.ok(target);
  assert.deepStrictEqual(target.children, []);
});

void test("leaves a target alone when no instruction names it", () => {
  const files = {
    "/publication/chapter.md": "<span>Apple</span>",
    "/publication/index.md": '<nav id="index">placeholder</nav>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  const target = select("#index", root);
  assert.ok(target);
  assert.strictEqual(toText(target), "placeholder");
});

void test("reports a missing target of an index whose entries are all revoked", () => {
  const files = {
    "/publication/chapter.md":
      '<span data-index="index.md?q=a!Apple|->b!Banana#index">Apple</span>',
    "/publication/index.md": "<p>no index target here</p>",
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const file = VFile({ path: "/publication/index.md" });

  processor.runSync(fromHtml(files["/publication/index.md"]), file);

  assert.deepStrictEqual(
    file.messages.map((message) => message.ruleId),
    ["invalid-reference", "vacant-entry", "missing-index-target"],
  );
});

void test("revokes a reference whose target was revoked for being vacant", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="index.md?q=a!Apple|->b!Banana#index">Apple</span>',
      '<span data-index="index.md?q=b!Banana|->c!Cherry#index">Banana</span>',
    ].join(""),
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);
  const file = VFile({ path: "/publication/index.md" });

  processor.runSync(root, file);

  assert.deepStrictEqual(selectAll("li.index-main-entry", root), []);
  assert.deepStrictEqual(
    file.messages.map((message) => message.ruleId),
    ["invalid-reference", "vacant-entry", "invalid-reference", "vacant-entry"],
  );
});

void test("keeps a heading whose locator outlives a revoked reference", () => {
  const files = {
    "/publication/chapter.md": [
      '<span id="apple" data-index="index.md?q=a!Apple#index">Apple</span>',
      '<span data-index="index.md?q=a!Apple|->b!Banana#index">Apple</span>',
    ].join(""),
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(locatorLinks(root), ["chapter.html#apple"]);
  assert.strictEqual(select(".index-main-entry-see", root), null);
});

void test("revokes a heading left without content by an invalid range", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="index.md?q=a!Apple|(%23missing#index">Apple</span>',
      '<span id="banana" data-index="index.md?q=b!Banana#index">Banana</span>',
    ].join(""),
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(groupHeadings(root), ["b"]);
  assert.deepStrictEqual(locatorLinks(root), ["chapter.html#banana"]);
});

void test("revokes a reference to a heading revoked by an invalid range", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="index.md?q=a!Apple|(%23missing#index">Apple</span>',
      '<span data-index="index.md?q=b!Banana|->a!Apple#index">Banana</span>',
    ].join(""),
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);
  const indexFile = VFile({ path: "/publication/index.md" });
  const chapterFile = VFile({ path: "/publication/chapter.md" });

  processor.runSync(root, indexFile);
  processor.runSync(fromHtml(files["/publication/chapter.md"]), chapterFile);

  assert.deepStrictEqual(groupHeadings(root), []);
  assert.deepStrictEqual(
    indexFile.messages.map((message) => message.ruleId),
    ["vacant-entry", "invalid-reference", "vacant-entry"],
  );
  assert.deepStrictEqual(
    chapterFile.messages.map((message) => message.ruleId),
    ["missing-range-end"],
  );
});

void test("revokes an unresolved see also reference while keeping a resolved one", () => {
  const files = {
    "/publication/chapter.md": [
      '<span id="banana" data-index="index.md?q=b!Banana#index">Banana</span>',
      '<span data-index="index.md?q=a!Apple|=>b!Banana#index">Apple</span>',
      '<span data-index="index.md?q=a!Apple|=>c!Cherry#index">Apple</span>',
    ].join(""),
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(groupHeadings(root), ["a", "b"]);
  assert.deepStrictEqual(
    selectAll(".index-main-entry-see-also a", root).map((link) => toText(link)),
    ["Banana"],
  );
});

void test("revokes a reference chain across several rounds", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="index.md?q=a!Apple|->b!Banana#index">Apple</span>',
      '<span data-index="index.md?q=b!Banana|->c!Cherry#index">Banana</span>',
      '<span data-index="index.md?q=c!Cherry|->d!Date#index">Cherry</span>',
    ].join(""),
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);
  const file = VFile({ path: "/publication/index.md" });

  processor.runSync(root, file);

  assert.deepStrictEqual(groupHeadings(root), []);
  assert.deepStrictEqual(
    file.messages.map((message) => message.ruleId),
    [
      "invalid-reference",
      "vacant-entry",
      "invalid-reference",
      "vacant-entry",
      "invalid-reference",
      "vacant-entry",
    ],
  );
  assert.deepStrictEqual(
    file.messages
      .filter((message) => message.ruleId === "vacant-entry")
      .map((message) =>
        ["Cherry", "Banana", "Apple"].find((name) => message.reason.includes(name)),
      ),
    ["Cherry", "Banana", "Apple"],
  );
});

void test("revokes a heading emptied by revoking its subentry", () => {
  const files = {
    "/publication/chapter.md":
      '<span data-index="index.md?q=a!Apple!Fuji|->b!Banana#index">Fuji</span>',
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);
  const file = VFile({ path: "/publication/index.md" });

  processor.runSync(root, file);

  assert.deepStrictEqual(groupHeadings(root), []);
  assert.deepStrictEqual(
    file.messages.map((message) => message.ruleId),
    ["invalid-reference", "vacant-entry", "vacant-entry"],
  );
  assert.deepStrictEqual(
    file.messages
      .filter((message) => message.ruleId === "vacant-entry")
      .map((message) => message.reason.includes("Fuji")),
    [true, false],
  );
});

void test("keeps mutually referencing headings that hold no locator", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="index.md?q=a!Apple|->b!Banana#index">Apple</span>',
      '<span data-index="index.md?q=b!Banana|->a!Apple#index">Banana</span>',
    ].join(""),
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);
  const file = VFile({ path: "/publication/index.md" });

  processor.runSync(root, file);

  assert.deepStrictEqual(groupHeadings(root), ["a", "b"]);
  assert.deepStrictEqual(file.messages, []);
});

void test("touches an affected target after a source changes", () => {
  const updates: string[] = [];
  const files = {
    "/publication/chapter.md": '<span data-index="index.md?q=a!Apple#index">Apple</span>',
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "index.md"],
    files,
    updates,
  });

  processor.runSync(fromHtml(files["/publication/chapter.md"]), {
    path: "/publication/chapter.md",
  });
  processor.runSync(fromHtml('<span data-index="index.md?q=b!Banana#index">Banana</span>'), {
    path: "/publication/chapter.md",
  });

  assert.deepStrictEqual(updates, ["/publication/index.md"]);
});

void test("removes the last attachment from its index", () => {
  const updates: string[] = [];
  const files = {
    "/publication/chapter.md": '<span data-index="index.md?q=a!Apple#index">Apple</span>',
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "index.md"],
    files,
    updates,
  });

  processor.runSync(fromHtml(files["/publication/chapter.md"]), {
    path: "/publication/chapter.md",
  });
  processor.runSync(fromHtml(""), { path: "/publication/chapter.md" });
  const root = fromHtml(files["/publication/index.md"]);
  processor.runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(updates, ["/publication/index.md"]);
  assert.deepStrictEqual(locatorLinks(root), []);
});

void test("moves an attachment from an old target document to a new one", () => {
  const updates: string[] = [];
  const files = {
    "/publication/chapter.md": '<span data-index="old.md?q=a!Apple#old">Apple</span>',
    "/publication/old.md": '<nav id="old"></nav>',
    "/publication/new.md": '<nav id="new"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "old.md", "new.md"],
    files,
    updates,
  });

  processor.runSync(fromHtml(files["/publication/chapter.md"]), {
    path: "/publication/chapter.md",
  });
  processor.runSync(fromHtml('<span data-index="new.md?q=a!Apple#new">Apple</span>'), {
    path: "/publication/chapter.md",
  });

  const oldRoot = fromHtml(files["/publication/old.md"]);
  const newRoot = fromHtml(files["/publication/new.md"]);
  processor.runSync(oldRoot, { path: "/publication/old.md" });
  processor.runSync(newRoot, { path: "/publication/new.md" });

  assert.deepStrictEqual(updates, ["/publication/old.md", "/publication/new.md"]);
  assert.deepStrictEqual(locatorLinks(oldRoot), []);
  assert.deepStrictEqual(locatorLinks(newRoot), ["chapter.html#%2Fhtml%2Fbody%2Fspan"]);
});

void test("moves an attachment between fragments in the same document", () => {
  const path = "/publication/chapter.md";
  const initialContents = [
    '<nav id="old"></nav>',
    '<nav id="new"></nav>',
    '<span data-index="?q=a!Apple#old">Apple</span>',
  ].join("");
  const { processor } = createProcessor({
    entries: ["chapter.md"],
    files: { [path]: initialContents },
  });

  processor.runSync(fromHtml(initialContents), { path });
  const currentRoot = fromHtml(initialContents.replace("?q=a!Apple#old", "?q=a!Apple#new"));
  processor.runSync(currentRoot, { path });

  const oldTarget = select("#old", currentRoot);
  const newTarget = select("#new", currentRoot);
  assert.ok(oldTarget);
  assert.ok(newTarget);
  assert.deepStrictEqual(locatorLinks(oldTarget), []);
  assert.deepStrictEqual(locatorLinks(newTarget), ["#%2Fhtml%2Fbody%2Fspan"]);
});

void test("keeps range end references separate between index targets", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="index.md?q=a!Apple|(%23apple-end#first">Apple</span>',
      '<span data-index="index.md?q=b!Banana|(%23banana-end#second">Banana</span>',
      '<span id="apple-end"></span>',
      '<span id="banana-end"></span>',
    ].join(""),
    "/publication/index.md": '<nav id="first"></nav><nav id="second"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "index.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  const first = select("#first", root);
  const second = select("#second", root);
  assert.ok(first);
  assert.ok(second);
  assert.match(toText(first), /Apple/v);
  assert.doesNotMatch(toText(first), /Banana/v);
  assert.match(toText(second), /Banana/v);
  assert.doesNotMatch(toText(second), /Apple/v);
});

void test("builds a range whose markers are in different entries", () => {
  const files = {
    "/publication/001.md":
      '<span id="range-start" data-index="index.md?q=a!Apple|(100.md%23range-end#index">Apple</span>',
    "/publication/index.md": '<nav id="index"></nav>',
    "/publication/100.md": '<span id="range-end"></span>',
  };
  const { processor } = createProcessor({
    entries: ["001.md", "index.md", "100.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(locatorLinks(root), ["001.html#range-start", "100.html#range-end"]);
});

void test("discards a range end query when resolving its document target", () => {
  const files = {
    "/publication/chapter.md":
      '<span id="range-start" data-index="index.md?q=a!Apple|(end.md%3Fq%3Dx%23range-end#index">Apple</span>',
    "/publication/end.md": '<span id="range-end"></span>',
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "end.md", "index.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(locatorLinks(root), ["chapter.html#range-start", "end.html#range-end"]);
});

void test("reports and revokes a range whose end target does not exist", () => {
  const files = {
    "/publication/chapter.md":
      '<span data-index="index.md?q=a!Apple|(%23missing#index">Apple</span>',
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "index.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });
  const file = VFile({ path: "/publication/chapter.md" });
  processor.runSync(fromHtml(files["/publication/chapter.md"]), file);

  assert.deepStrictEqual(locatorLinks(root), []);
  assert.strictEqual(file.messages.length, 1);
  assert.match(file.messages[0]?.reason ?? "", /does not exist/v);
  assert.strictEqual(file.messages[0]?.ruleId, "missing-range-end");
});

void test("reports and rejects a range end reference without a fragment", () => {
  const files = {
    "/publication/chapter.md": '<span data-index="index.md?q=a!Apple|(end.md#index">Apple</span>',
    "/publication/end.md": '<span id="range-end"></span>',
    "/publication/index.md": '<nav id="index">placeholder</nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "end.md", "index.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });
  const file = VFile({ path: "/publication/chapter.md" });
  processor.runSync(fromHtml(files["/publication/chapter.md"]), file);

  const target = select("#index", root);
  assert.ok(target);
  assert.strictEqual(toText(target), "placeholder");
  assert.strictEqual(file.messages.length, 1);
  assert.match(file.messages[0]?.reason ?? "", /invalid range end reference/v);
  assert.strictEqual(file.messages[0]?.ruleId, "invalid-range-end-reference");
});

void test("reports and revokes a range whose end precedes its start in the same entry", () => {
  const files = {
    "/publication/chapter.md": [
      '<span id="range-end"></span>',
      '<span data-index="index.md?q=a!Apple|(%23range-end#index">Apple</span>',
    ].join(""),
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "index.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });
  const file = VFile({ path: "/publication/chapter.md" });
  processor.runSync(fromHtml(files["/publication/chapter.md"]), file);

  assert.deepStrictEqual(locatorLinks(root), []);
  assert.strictEqual(file.messages.length, 1);
  assert.match(file.messages[0]?.reason ?? "", /does not follow its start/v);
  assert.strictEqual(file.messages[0]?.ruleId, "range-end-order");
});

void test("reports and revokes a range whose end is its start", () => {
  const files = {
    "/publication/chapter.md":
      '<span id="range-start" data-index="index.md?q=a!Apple|(%23range-start#index">Apple</span>',
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "index.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });
  const file = VFile({ path: "/publication/chapter.md" });
  processor.runSync(fromHtml(files["/publication/chapter.md"]), file);

  assert.deepStrictEqual(locatorLinks(root), []);
  assert.strictEqual(file.messages.length, 1);
  assert.match(file.messages[0]?.reason ?? "", /does not follow its start/v);
  assert.strictEqual(file.messages[0]?.ruleId, "range-end-order");
});

void test("reports and revokes a range whose end is in an earlier entry", () => {
  const files = {
    "/publication/001.md": '<span id="range-end"></span>',
    "/publication/100.md":
      '<span data-index="index.md?q=a!Apple|(001.md%23range-end#index">Apple</span>',
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["001.md", "100.md", "index.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });
  const file = VFile({ path: "/publication/100.md" });
  processor.runSync(fromHtml(files["/publication/100.md"]), file);

  assert.deepStrictEqual(locatorLinks(root), []);
  assert.strictEqual(file.messages.length, 1);
  assert.match(file.messages[0]?.reason ?? "", /does not follow its start/v);
  assert.strictEqual(file.messages[0]?.ruleId, "range-end-order");
});

void test("touches an index target after its range end changes", () => {
  const updates: string[] = [];
  const files = {
    "/publication/chapter.md":
      '<span data-index="index.md?q=a!Apple|(end.md%23range-end#index">Apple</span>',
    "/publication/end.md": '<span id="range-end"></span>',
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "end.md", "index.md"],
    files,
    updates,
  });

  processor.runSync(fromHtml(files["/publication/end.md"]), {
    path: "/publication/end.md",
  });
  processor.runSync(fromHtml(""), { path: "/publication/end.md" });

  assert.deepStrictEqual(updates, ["/publication/chapter.md", "/publication/index.md"]);
});

void test("reports and rejects index references that cannot be normalized", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="https://example.test/index.md?q=a!Apple#index">Apple</span>',
      '<span data-index="index.md?q=b!Banana#%zz">Banana</span>',
    ].join(""),
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "index.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });
  const file = VFile({ path: "/publication/chapter.md" });
  processor.runSync(fromHtml(files["/publication/chapter.md"]), file);

  assert.deepStrictEqual(locatorLinks(root), []);
  assert.strictEqual(file.messages.length, 2);
  assert.ok(file.messages.every((message) => message.ruleId === "invalid-index-reference"));
});

void test("reports malformed index instructions", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="index.md?q=%5B#index">Malformed</span>',
      '<span data-index="index.md?q=/range,r0#index">Unknown</span>',
    ].join(""),
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "index.md"],
    files,
  });
  processor.runSync(fromHtml(files["/publication/index.md"]), {
    path: "/publication/index.md",
  });
  const file = VFile({ path: "/publication/chapter.md" });

  processor.runSync(fromHtml(files["/publication/chapter.md"]), file);

  assert.deepStrictEqual(
    file.messages.map((message) => message.ruleId),
    ["instruction-parse-error", "instruction-parse-error"],
  );
});

void test("reports an index target outside entries on its source file", () => {
  const files = {
    "/publication/chapter.md": '<span data-index="outside.md?q=a!Apple#index">Apple</span>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md"],
    files,
  });
  const file = VFile({ path: "/publication/chapter.md" });

  processor.runSync(fromHtml(files["/publication/chapter.md"]), file);

  assert.strictEqual(file.messages.length, 1);
  assert.strictEqual(file.messages[0]?.ruleId, "target-not-in-entries");
});

void test("reports an invalid entry reference on its index file", () => {
  const files = {
    "/publication/chapter.md":
      '<span data-index="index.md?q=a!Apple|->b!Banana#index">Apple</span>',
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "index.md"],
    files,
  });
  const file = VFile({ path: "/publication/index.md" });

  processor.runSync(fromHtml(files["/publication/index.md"]), file);

  assert.deepStrictEqual(
    file.messages.map((message) => message.ruleId),
    ["invalid-reference", "vacant-entry"],
  );
});

void test("reports an index reference without a fragment as a missing target", () => {
  const files = {
    "/publication/chapter.md": '<span data-index="index.md?q=a!Apple">Apple</span>',
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "index.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);
  const file = VFile({ path: "/publication/index.md" });

  processor.runSync(root, file);

  assert.deepStrictEqual(locatorLinks(root), []);
  assert.strictEqual(file.messages.length, 1);
  assert.strictEqual(file.messages[0]?.ruleId, "missing-index-target");
});

void test("uses the same generated locator ID during discovery and transformation", () => {
  const files = {
    "/publication/chapter.md": '<span data-index="index.md?q=a!Apple#index">Apple</span>',
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "index.md"],
    files,
  });

  const indexRoot = fromHtml(files["/publication/index.md"]);
  const chapterRoot = fromHtml(files["/publication/chapter.md"]);
  processor.runSync(indexRoot, { path: "/publication/index.md" });
  processor.runSync(chapterRoot, { path: "/publication/chapter.md" });
  const sourceElement = select("[data-index]", chapterRoot);
  assert.ok(sourceElement);
  const sourceId = getAttribute(sourceElement, "id");
  assert.ok(sourceId);

  assert.deepStrictEqual(locatorLinks(indexRoot), [`chapter.html#${encodeURIComponent(sourceId)}`]);
});

void test("encodes locator paths and fragments", () => {
  const files = {
    "/publication/章 #1.md":
      '<span id="索引語" data-index="索引/index.md?q=さ!さくいんご@索引語#index">索引語</span>',
    "/publication/索引/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["章 #1.md", "索引/index.md"],
    files,
  });
  const root = fromHtml(files["/publication/索引/index.md"]);

  processor.runSync(root, { path: "/publication/索引/index.md" });

  assert.deepStrictEqual(locatorLinks(root), [
    "../%E7%AB%A0%20%231.html#%E7%B4%A2%E5%BC%95%E8%AA%9E",
  ]);
});

void test("resolves entries and index targets above the entry context", () => {
  const files = {
    "/publication/chapter.md":
      '<span data-index="../../indexes/index.md?q=a!Apple#index">Apple</span>',
    "/indexes/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "../../indexes/index.md"],
    files,
  });
  const root = fromHtml(files["/indexes/index.md"]);

  processor.runSync(root, { path: "/indexes/index.md" });

  assert.deepStrictEqual(locatorLinks(root), ["../publication/chapter.html#%2Fhtml%2Fbody%2Fspan"]);
});
