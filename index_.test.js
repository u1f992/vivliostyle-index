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
  console.dir(indexes, { depth: null });
  console.log(new TextDecoder().decode(base16.parse(span.id)));
});
