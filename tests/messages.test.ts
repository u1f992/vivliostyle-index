import assert from "node:assert";
import test from "node:test";

import VFile from "vfile";

import { addMessage, emitMessages, messages } from "../src/messages.ts";
import { createKey } from "../src/model.ts";

void test("groups message arguments by document and emits VFile messages", () => {
  const messagesByDocument = new Map();
  addMessage(
    messagesByDocument,
    "/publication/chapter.md",
    messages.invalidInstruction(new Error(), "invalid"),
  );
  addMessage(
    messagesByDocument,
    "/publication/chapter.md",
    messages.missingIndexTarget({
      path: "/publication/index.md",
      fragment: "index",
    }),
  );
  addMessage(
    messagesByDocument,
    "/publication/chapter.md",
    messages.invalidXref({
      target: {
        group: createKey("ち", "ち"),
        entry: createKey("こうぎょうしょゆうけん", "工業所有権"),
      },
      missing: "entry",
    }),
  );
  addMessage(
    messagesByDocument,
    "/publication/chapter.md",
    messages.invalidXref({
      target: {
        group: createKey("ち", "ち"),
        entry: createKey("ちょさくけん", "著作権"),
        subentry: createKey("ちょさくけんのそうぞく", "――の相続"),
      },
      missing: "subentry",
    }),
  );
  const file = VFile({ path: "/publication/chapter.md" });

  emitMessages(file, messagesByDocument.get("/publication/chapter.md") ?? []);

  assert.deepStrictEqual(
    file.messages.map(({ source, ruleId, reason }) => ({ source, ruleId, reason })),
    [
      {
        source: "vivliostyle-index",
        ruleId: "instruction-parse-error",
        reason: "cannot parse index instruction: invalid",
      },
      {
        source: "vivliostyle-index",
        ruleId: "missing-index-target",
        reason: "index target /publication/index.md#index does not exist",
      },
      {
        source: "vivliostyle-index",
        ruleId: "invalid-xref",
        reason:
          'index does not contain group={"reading":"ち","html":"ち"},entry={"reading":"こうぎょうしょゆうけん","html":"工業所有権"}. the cross-reference target will not resolve.',
      },
      {
        source: "vivliostyle-index",
        ruleId: "invalid-xref",
        reason:
          'index does not contain group={"reading":"ち","html":"ち"},entry={"reading":"ちょさくけん","html":"著作権"},subentry={"reading":"ちょさくけんのそうぞく","html":"――の相続"}. the cross-reference target will not resolve.',
      },
    ],
  );
});
