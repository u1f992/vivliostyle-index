import assert from "node:assert";
import test from "node:test";

import unified from "unified";
import VFile from "vfile";

import { logMessages } from "../src/log-messages.ts";

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
