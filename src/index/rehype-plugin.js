// @ts-check

import fs from "node:fs";
import path from "node:path";

import { JSDOM } from "jsdom";
import rehype from "rehype"; // "^11.0.0"
import { register } from "./index_";

/**
 * - https://nodejs.org/api/fs.html#fsutimessyncpath-atime-mtime
 * - https://qiita.com/Anders/items/b1a9f3dca3f9c3c17241
 *
 * @param {string} filePath
 */
function touchIfExists(filePath) {
  const time = new Date();
  try {
    fs.utimesSync(filePath, time, time);
  } catch {}
}

/**
 * @param {string} path_
 * @returns {`${string}.html`}
 */
const ensureHTMLExt = (path_) =>
  // @ts-ignore
  ((parsed = path.parse(path_)) =>
    path.join(parsed.dir, parsed.name + ".html"))();

/**
 * @param {import("unist").Node} tree
 * @param {string} html
 * @param {string} resolvedEntryWithIndex
 * @returns
 */
function processTargetEntry(tree, html, resolvedEntryWithIndex) {
  const jsdom = new JSDOM(rehype().stringify(tree));
  jsdom.window.document
    .querySelectorAll("[data-index]")
    .forEach((elem) =>
      register({}, elem.getAttribute("data-index") ?? "", html, elem),
    );
  touchIfExists(resolvedEntryWithIndex);
  return rehype().parse(jsdom.serialize());
}

/**
 * @param {import("unist").Node} tree
 * @param {import("unified").Processor} processor
 * @param {[`${string}.md`, `${string}.html`][]} resolvedTargetEntries
 * @returns
 */
function processEntryWithIndex(tree, processor, resolvedTargetEntries) {
  /** @type {import("./index_.js").Indexes} */
  const indexes = {};

  resolvedTargetEntries.forEach(([md, html]) =>
    new JSDOM(
      rehype().stringify(
        processor.parse(fs.readFileSync(md, { encoding: "utf-8" })),
      ),
    ).window.document
      .querySelectorAll("[data-index]")
      .forEach((elem) =>
        register(indexes, elem.getAttribute("data-index") ?? "", html, elem),
      ),
  );

  const jsdom = new JSDOM(rehype().stringify(tree));
  const { document } = jsdom.window;
  document.querySelectorAll("[data-index]").forEach((elem) => {
    if (elem.classList.contains("index")) {
      // TODO
    }
  });
  return rehype().parse(jsdom.serialize());
}

/**
 * @type {import("unified").Plugin<[{
 *   processor: import("unified").Processor;
 *   targetEntries: `${string}.md`[];
 *   entryWithIndex: `${string}.md`;
 *   entryContext?: string;
 *   workspaceDir?: string;
 * }], import("unified").Settings>}
 */
export const vivliostyleIndex = ({
  processor,
  targetEntries,
  entryWithIndex,
  entryContext: entryContext_,
  workspaceDir: workspaceDir_,
}) => {
  const entryContext = path.resolve(entryContext_ ?? ".");
  const workspaceDir = path.resolve(
    entryContext,
    workspaceDir_ ?? ".vivliostyle",
  );

  const resolvedEntryWithIndex = path.resolve(entryContext, entryWithIndex);
  const resolvedEntryWithIndexHTML = ensureHTMLExt(
    path.resolve(
      workspaceDir,
      path.relative(entryContext, resolvedEntryWithIndex),
    ),
  );
  const resolvedTargetEntries = targetEntries
    .map((entry) => path.resolve(entryContext, entry))
    .map(
      (resolvedEntry) =>
        /** @type {[`${string}.md`, `${string}.html`]} */ ([
          resolvedEntry,
          path.relative(
            resolvedEntryWithIndexHTML,
            ensureHTMLExt(
              path.resolve(
                workspaceDir,
                path.relative(entryContext, resolvedEntry),
              ),
            ),
          ),
        ]),
    );

  return (tree, file) => {
    /**
     * > The first is the original path and the last is the current path.
     *
     * https://github.com/vfile/vfile/blob/5e83917c832881569c52f1118c7beea3f12ac12f/readme.md#filehistory
     *
     * This path is unix-style and should be aligned to the platform's format with `path.resolve`.
     *
     * ```
     * > require("path").resolve("C:/Windows/explorer.exe")
     * 'C:\\Windows\\explorer.exe'
     * ```
     */
    const unixStyledOriginalMarkdown = file.history.at(0);
    if (typeof unixStyledOriginalMarkdown === "undefined") {
      return tree;
    }
    const originalMarkdown = path.resolve(unixStyledOriginalMarkdown);
    const findResult = resolvedTargetEntries.find(
      ([md, _]) => md === originalMarkdown,
    );
    const isTargetEntry = typeof findResult !== "undefined";
    const containsIndex = resolvedEntryWithIndex === originalMarkdown;

    if (containsIndex) {
      return processEntryWithIndex(tree, processor, resolvedTargetEntries);
    } else if (isTargetEntry) {
      return processTargetEntry(tree, findResult[1], resolvedEntryWithIndex);
    } else {
      return tree;
    }
  };
};
