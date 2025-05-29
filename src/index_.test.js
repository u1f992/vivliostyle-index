// @ts-check

import { register } from "./index_.js";

import test from "node:test";
import assert from "node:assert";
import { Console } from "node:console";

import { JSDOM } from "jsdom";
import { base16 } from "rfc4648";

const console = new Console(process.stderr);

test("registerPageLocatorToEntry", () => {
  const jsdom = new JSDOM("<html><body></body></html>");
  const { document } = jsdom.window;
  const span = document.createElement("span");
  document.getElementsByTagName("body")[0].appendChild(span);

  /** @type {import("./index_.js").Indexes} */
  const indexes = {};
  register(
    indexes,
    ["$", ["さ", "じゆうりよう", "自由利用"]],
    "../01/manuscript.html",
    span,
  );
  assert.deepStrictEqual(indexes, {
    $: [
      {
        group: "さ",
        entries: [
          {
            reading: "じゆうりよう",
            headword: "自由利用",
            locators: [
              {
                type: "page",
                file: "../01/manuscript.html",
                id: base16.stringify(
                  new TextEncoder().encode("/html/body/span"),
                ),
              },
            ],
            see: [],
            seeAlso: [],
            subentries: [],
          },
        ],
      },
    ],
  });
});
