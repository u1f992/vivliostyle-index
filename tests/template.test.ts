import assert from "node:assert";
import test from "node:test";

import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { select, selectAll } from "hast-util-select";
import { toText } from "hast-util-to-text";
import { h } from "hastscript";

import { fillSlot, identityTemplate } from "../src/template.ts";

function asRoot(children: hast.ElementContent[]): hast.Root {
  return { type: "root", children };
}

void test("keeps a template without slots as it is", () => {
  const root = asRoot(fillSlot("<em>x</em>", [h("a", { href: "#a" })]));

  assert.strictEqual(select("a", root), null);
  assert.strictEqual(toText(root), "x");
});

void test("uses the original nodes for the first slot and copies for the rest", () => {
  const content = [h("a", { href: "#a" })];
  const filled = fillSlot("<b><slot></slot></b><i><slot></slot></i>", content);
  const root = asRoot(filled);
  const links = selectAll("a", root);

  assert.deepStrictEqual(
    links.map((link) => getAttribute(link, "href")),
    ["#a", "#a"],
  );
  assert.strictEqual(links[0], content[0]);
  assert.notStrictEqual(links[0], links[1]);
});

void test("uses depth-first order to select the original insertion", () => {
  const content = [h("a", { href: "#a" })];
  const root = asRoot(fillSlot("<span><slot></slot></span><slot></slot>", content));
  const links = selectAll("a", root);

  assert.strictEqual(select("span > a", root), content[0]);
  assert.notStrictEqual(links[1], content[0]);
});

void test("ignores slots nested inside a slot", () => {
  const content = [h("a", { href: "#a" })];
  const root = asRoot(fillSlot("<slot><slot></slot></slot>", content));

  assert.deepStrictEqual(root.children, content);
  assert.strictEqual(select("slot", root), null);
});

void test("passes uncloneable data through the identity template", () => {
  const callback = () => {};
  const content = [h("a", { href: "#a" })];
  content[0]!.data = { metadata: { callback } };

  const filled = fillSlot(identityTemplate, content);

  assert.strictEqual(filled[0], content[0]);
  assert.strictEqual(filled[0]?.data, content[0]?.data);
  assert.strictEqual(filled[0]?.data?.metadata, content[0]?.data?.metadata);
  assert.strictEqual(
    (filled[0]?.data?.metadata as { callback: unknown } | undefined)?.callback,
    callback,
  );
});

void test("copies nodes with uncloneable data into explicit templates", () => {
  const callback = () => {};
  const metadata = { callback };
  const content = [h("a", { href: "#a" })];
  content[0]!.data = { metadata };

  const filled = fillSlot("<slot></slot><slot></slot>", content);
  const [first, second] = filled;

  assert.ok(first?.type === "element" && second?.type === "element");
  assert.strictEqual(first, content[0]);
  assert.notStrictEqual(first, second);
  assert.strictEqual(first.data, content[0]?.data);
  assert.notStrictEqual(first.data, second.data);
  assert.strictEqual(first.data?.metadata, metadata);
  assert.strictEqual(second.data?.metadata, metadata);
});

void test("copies template contents independently between slots", () => {
  const content = [h("template", [h("span", "x")])];

  const filled = fillSlot("<slot></slot><slot></slot>", content);
  const [first, second] = filled;

  assert.ok(first?.type === "element" && second?.type === "element");
  assert.strictEqual(first, content[0]);
  assert.notStrictEqual(first.content, second.content);
  assert.notStrictEqual(first.content?.children[0], second.content?.children[0]);
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
