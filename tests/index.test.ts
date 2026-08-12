import assert from "node:assert";
import test from "node:test";

import type * as hast from "hast";
import { fromHtml } from "hast-util-from-html";
import { getAttribute } from "hast-util-get-attribute";
import { select, selectAll } from "hast-util-select";
import { toText } from "hast-util-to-text";
import { VFM } from "@vivliostyle/vfm";
import unified from "unified";

import {
  createPlugin,
  defaultComparator,
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
  log,
}: {
  entries: readonly string[];
  files: Readonly<Record<string, string>>;
  comparators?: Comparators;
  updates?: string[];
  log?: (message: string) => void;
}) {
  const { fileSystem, reads } = createFileSystem(files, updates);
  const plugin = createPlugin({
    entries,
    entryContext: "/publication",
    ...(comparators === undefined ? {} : { comparators }),
    fileSystem,
    ...(log === undefined ? {} : { log }),
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

void test("renders a complete index before later source entries are transformed", () => {
  const files = {
    "/publication/001.md":
      '<span data-index="index.md?command=[[a,a],[Apple,Apple]]#index">Apple</span>',
    "/publication/index.md": '<nav id="index"></nav>',
    "/publication/100.md":
      '<span data-index="index.md?command=[[z,z],[Zebra,Zebra]]#index">Zebra</span>',
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
    '<span data-index="?command=[[a,a],[Apple,Apple]]#index">Apple</span>',
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
      '<span data-index="index.md?command=[[a,a],[Apple,Apple]]#subject">Apple</span>',
      '<span data-index="index.md?command=[[t,t],[Ada,Ada]]#person">Ada</span>',
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

void test("uses a comparator addressed by a URL containing a query", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="index.md?command=[[z,z],[Z,Z]]#index">Z</span>',
      '<span data-index="index.md?command=[[ä,ä],[Ä,Ä]]#index">Ä</span>',
    ].join(""),
    "/publication/index.md": '<section lang="sv"><nav id="index"></nav></section>',
  };
  const { processor } = createProcessor({
    entries: ["index.md", "chapter.md"],
    files,
    comparators: {
      "index.md?view=subject#index": defaultComparator("en"),
    },
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(groupHeadings(root), ["ä", "z"]);
});

void test("rejects comparator references that normalize to the same target", () => {
  assert.throws(
    () =>
      createPlugin({
        entries: ["index.md"],
        entryContext: "/publication",
        comparators: {
          "index.md?view=a#index": defaultComparator("en"),
          "index.md?view=b#index": defaultComparator("sv"),
        },
      }),
    /resolve to the same index target/v,
  );
});

void test("uses the closest language when no comparator is configured", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="index.md?command=[[z,z],[Z,Z]]#index">Z</span>',
      '<span data-index="index.md?command=[[ä,ä],[Ä,Ä]]#index">Ä</span>',
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

void test("parses a heading word as inner HTML", () => {
  const files = {
    "/publication/chapter.md": `<span data-index='index.md?command=[[き,き],["<em>京都大学</em>",きょうとだいがく]]#index'>京都大学</span>`,
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

void test("links a reference to a later entry", () => {
  const files = {
    "/publication/chapter.md": [
      `<span data-index='index.md?command=see,[[た,た],[大学,だいがく]],[[き,き],["<em>京都大学</em>",きょうとだいがく]]#index'>大学</span>`,
      `<span data-index='index.md?command=[[き,き],["<em>京都大学</em>",きょうとだいがく]]#index'>京都大学</span>`,
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

void test("touches an affected target after a source changes", () => {
  const updates: string[] = [];
  const files = {
    "/publication/chapter.md":
      '<span data-index="index.md?command=[[a,a],[Apple,Apple]]#index">Apple</span>',
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
  processor.runSync(
    fromHtml('<span data-index="index.md?command=[[b,b],[Banana,Banana]]#index">Banana</span>'),
    { path: "/publication/chapter.md" },
  );

  assert.deepStrictEqual(updates, ["/publication/index.md"]);
});

void test("removes the last attachment from its index", () => {
  const updates: string[] = [];
  const files = {
    "/publication/chapter.md":
      '<span data-index="index.md?command=[[a,a],[Apple,Apple]]#index">Apple</span>',
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
    "/publication/chapter.md":
      '<span data-index="old.md?command=[[a,a],[Apple,Apple]]#old">Apple</span>',
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
  processor.runSync(
    fromHtml('<span data-index="new.md?command=[[a,a],[Apple,Apple]]#new">Apple</span>'),
    { path: "/publication/chapter.md" },
  );

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
    '<span data-index="?command=[[a,a],[Apple,Apple]]#old">Apple</span>',
  ].join("");
  const { processor } = createProcessor({
    entries: ["chapter.md"],
    files: { [path]: initialContents },
  });

  processor.runSync(fromHtml(initialContents), { path });
  const currentRoot = fromHtml(
    initialContents.replace(
      "?command=[[a,a],[Apple,Apple]]#old",
      "?command=[[a,a],[Apple,Apple]]#new",
    ),
  );
  processor.runSync(currentRoot, { path });

  const oldTarget = select("#old", currentRoot);
  const newTarget = select("#new", currentRoot);
  assert.ok(oldTarget);
  assert.ok(newTarget);
  assert.deepStrictEqual(locatorLinks(oldTarget), []);
  assert.deepStrictEqual(locatorLinks(newTarget), ["#%2Fhtml%2Fbody%2Fspan"]);
});

void test("keeps equal range IDs separate between index targets", () => {
  const files = {
    "/publication/chapter.md": [
      '<span data-index="index.md?command=range,[[a,a],[Apple,Apple]],r0#first">Apple</span>',
      '<span data-index="index.md?command=range,[[b,b],[Banana,Banana]],r0#second">Banana</span>',
      '<span data-index="index.md?command=/range,r0#first"></span>',
      '<span data-index="index.md?command=/range,r0#second"></span>',
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
      '<span id="range-start" data-index="index.md?command=range,[[a,a],[Apple,Apple]],r0#index">Apple</span>',
    "/publication/index.md": '<nav id="index"></nav>',
    "/publication/100.md":
      '<span id="range-end" data-index="index.md?command=/range,r0#index"></span>',
  };
  const { processor } = createProcessor({
    entries: ["001.md", "index.md", "100.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(locatorLinks(root), ["001.html#range-start", "100.html#range-end"]);
});

void test("warns and ignores index references that cannot be normalized", (context) => {
  const warn = context.mock.method(console, "warn", () => {});
  const files = {
    "/publication/chapter.md": [
      '<span data-index="https://example.test/index.md?command=[[a,a],[Apple,Apple]]#index">Apple</span>',
      '<span data-index="index.md?command=[[b,b],[Banana,Banana]]#%zz">Banana</span>',
    ].join(""),
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "index.md"],
    files,
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(locatorLinks(root), []);
  assert.strictEqual(warn.mock.callCount(), 2);
});

void test("reports an index reference without a fragment as a missing target", (context) => {
  const warn = context.mock.method(console, "warn", () => {});
  const logs: string[] = [];
  const files = {
    "/publication/chapter.md":
      '<span data-index="index.md?command=[[a,a],[Apple,Apple]]">Apple</span>',
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { processor } = createProcessor({
    entries: ["chapter.md", "index.md"],
    files,
    log: (message) => logs.push(message),
  });
  const root = fromHtml(files["/publication/index.md"]);

  processor.runSync(root, { path: "/publication/index.md" });

  assert.deepStrictEqual(locatorLinks(root), []);
  assert.strictEqual(warn.mock.callCount(), 0);
  assert.deepStrictEqual(logs, [
    "[vivliostyle-index] index target /publication/index.md# does not exist",
  ]);
});

void test("uses the same generated locator ID during VFM discovery and transformation", () => {
  const files = {
    "/publication/chapter.md":
      '<span data-index="index.md?command=[[a,a],[Apple,Apple]]#index">Apple</span>',
    "/publication/index.md": '<nav id="index"></nav>',
  };
  const { fileSystem } = createFileSystem(files);
  const plugin = createPlugin({
    entries: ["chapter.md", "index.md"],
    entryContext: "/publication",
    fileSystem,
  });
  const processor = VFM().use(plugin, {
    createEntryProcessor: () => VFM(),
  });

  const indexRoot = fromHtml(
    processor
      .processSync({ path: "/publication/index.md", contents: files["/publication/index.md"] })
      .toString(),
  );
  const chapterRoot = fromHtml(
    processor
      .processSync({ path: "/publication/chapter.md", contents: files["/publication/chapter.md"] })
      .toString(),
  );
  const sourceElement = select("[data-index]", chapterRoot);
  assert.ok(sourceElement);
  const sourceId = getAttribute(sourceElement, "id");
  assert.ok(sourceId);

  assert.deepStrictEqual(locatorLinks(indexRoot), [`chapter.html#${encodeURIComponent(sourceId)}`]);
});

void test("encodes locator paths and fragments", () => {
  const files = {
    "/publication/章 #1.md":
      '<span id="索引語" data-index="索引/index.md?command=[[さ,さ],[索引語,さくいんご]]#index">索引語</span>',
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
      '<span data-index="../../indexes/index.md?command=[[a,a],[Apple,Apple]]#index">Apple</span>',
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
