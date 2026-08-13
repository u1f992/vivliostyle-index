import assert from "node:assert";
import test from "node:test";

import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { select, selectAll } from "hast-util-select";
import { toText } from "hast-util-to-text";
import { h } from "hastscript";

import { fillSlot } from "../src/template.ts";

function asRoot(children: hast.ElementContent[]): hast.Root {
  return { type: "root", children };
}

void test("keeps a template without slots as it is", () => {
  const root = asRoot(fillSlot("<em>x</em>", [h("a", { href: "#a" })]));

  assert.strictEqual(select("a", root), null);
  assert.strictEqual(toText(root), "x");
});

void test("fills every slot with its own copy of the nodes", () => {
  const filled = fillSlot("<b><slot></slot></b><i><slot></slot></i>", [h("a", { href: "#a" })]);
  const root = asRoot(filled);
  const links = selectAll("a", root);

  assert.deepStrictEqual(
    links.map((link) => getAttribute(link, "href")),
    ["#a", "#a"],
  );
  assert.notStrictEqual(links[0], links[1]);
});

void test("leaves a slot inside a template element unfilled", () => {
  const root = asRoot(fillSlot("<template><slot></slot></template>", [h("a", { href: "#a" })]));

  assert.strictEqual(select("a", root), null);
});

void test("replaces a slot with every given node", () => {
  const root = asRoot(
    fillSlot("<em><slot></slot></em>", [
      h("a", { href: "#start" }),
      h("span", { className: "separator" }),
      h("a", { href: "#end" }),
    ]),
  );

  assert.deepStrictEqual(
    selectAll("em > a", root).map((link) => getAttribute(link, "href")),
    ["#start", "#end"],
  );
  assert.strictEqual(select("em > span.separator", root) !== null, true);
  assert.strictEqual(select("slot", root), null);
});

void test("leaves a slot the parser moves out of its element beside that element", () => {
  const root = asRoot(fillSlot("<table><slot></slot></table>", [h("a", { href: "#a" })]));

  assert.strictEqual(select("table > a", root), null);
  assert.deepStrictEqual(
    root.children.flatMap((child) => (child.type === "element" ? [child.tagName] : [])),
    ["a", "table"],
  );
});

void test("keeps the text and nesting of the template around the slot", () => {
  const root = asRoot(fillSlot("<b>[<i><slot></slot></i>]</b>", [h("a", { href: "#a" })]));

  assert.strictEqual(toText(root), "[]");
  assert.strictEqual(getAttribute(select("b > i > a", root)!, "href"), "#a");
});
