import assert from "node:assert";
import test from "node:test";

import type * as hast from "hast";
import { getAttribute } from "hast-util-get-attribute";
import { select } from "hast-util-select";

import expand from "../../src/command/expand.ts";
import { toHastChildren, type Index } from "../../src/model.ts";

void test("renders an index into the target element", () => {
  const index: Index = {
    children: [
      {
        key: [toHastChildren("ち"), "ち"],
        children: [
          {
            key: [toHastChildren("著作権"), "ちょさくけん"],
            children: [],
            locators: [],
            see: [],
            seeAlso: [],
          },
        ],
      },
    ],
  };
  const target: hast.Element = {
    type: "element",
    tagName: "nav",
    properties: { id: "index" },
    children: [],
  };

  expand(index, target, "index");

  const entry = select(".index-main-entry", target);
  assert.ok(entry);
  assert.ok(getAttribute(entry, "id")?.startsWith("index--"));
});
