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

void test("shares the original nodes between slots", () => {
  const content = [h("a", { href: "#a" })];
  const filled = fillSlot("<b><slot></slot></b><i><slot></slot></i>", content);
  const [bold, italic] = filled;

  assert.ok(bold?.type === "element" && italic?.type === "element");
  // The nodes are intentionally shared between slots.
  // A later transformer can turn shared nodes into clones, but cloned nodes cannot be restored to a unique shared structure.
  // Defining the general cloning requirements this plugin should satisfy is also difficult.
  assert.strictEqual(bold.children[0], content[0]);
  assert.strictEqual(italic.children[0], content[0]);
  assert.strictEqual(getAttribute(bold.children[0] as hast.Element, "href"), "#a");
  assert.strictEqual(getAttribute(italic.children[0] as hast.Element, "href"), "#a");
});

void test("shares the original nodes across nesting levels", () => {
  const content = [h("a", { href: "#a" })];
  const [span, direct] = fillSlot("<span><slot></slot></span><slot></slot>", content);

  assert.ok(span?.type === "element");
  assert.strictEqual(span.children[0], content[0]);
  assert.strictEqual(direct, content[0]);
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

void test("shares nodes with uncloneable data between explicit slots", () => {
  const callback = () => {};
  const metadata = { callback };
  const content = [h("a", { href: "#a" })];
  content[0]!.data = { metadata };

  const filled = fillSlot("<slot></slot><slot></slot>", content);
  const [first, second] = filled;

  assert.ok(first?.type === "element" && second?.type === "element");
  assert.strictEqual(first, content[0]);
  assert.strictEqual(first, second);
  assert.strictEqual(first.data, content[0]?.data);
  assert.strictEqual(first.data, second.data);
  assert.strictEqual(first.data?.metadata, metadata);
  assert.strictEqual(second.data?.metadata, metadata);
});

void test("shares template contents between slots", () => {
  const content = [h("template", [h("span", "x")])];

  const filled = fillSlot("<slot></slot><slot></slot>", content);
  const [first, second] = filled;

  assert.ok(first?.type === "element" && second?.type === "element");
  assert.strictEqual(first, content[0]);
  assert.strictEqual(first, second);
  assert.strictEqual(first.content, second.content);
  assert.strictEqual(first.content?.children[0], second.content?.children[0]);
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
