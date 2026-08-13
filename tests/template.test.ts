import assert from "node:assert";
import test from "node:test";

import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { select, selectAll } from "hast-util-select";
import { toText } from "hast-util-to-text";
import { h } from "hastscript";

import { countSlots, fillSlot } from "../src/template.ts";

function asRoot(children: hast.ElementContent[]): hast.Root {
  return { type: "root", children };
}

void test("counts slot elements at any depth", () => {
  assert.strictEqual(countSlots("<em><slot></slot></em>"), 1);
  assert.strictEqual(countSlots("<b>[<i><slot></slot></i>]</b>"), 1);
  assert.strictEqual(countSlots("<em></em>"), 0);
  assert.strictEqual(countSlots("<slot></slot><slot></slot>"), 2);
  assert.strictEqual(countSlots('<a title="<slot></slot>">x</a>'), 0);
  assert.strictEqual(countSlots("<template><slot></slot></template>"), 0);
});

void test("leaves a template element unfilled, as its count reports", () => {
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
