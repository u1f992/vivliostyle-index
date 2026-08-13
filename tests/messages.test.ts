import assert from "node:assert";
import test from "node:test";

import VFile from "vfile";

import { addMessage, emitMessages, messages } from "../src/messages.ts";

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
      id: "index",
    }),
  );
  addMessage(
    messagesByDocument,
    "/publication/chapter.md",
    messages.invalidReference({
      target: {
        group: { html: "ち", reading: "ち" },
        mainEntry: { html: "工業所有権", reading: "こうぎょうしょゆうけん" },
      },
      missing: "mainEntry",
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
        ruleId: "invalid-reference",
        reason:
          'index does not contain group={"html":"ち","reading":"ち"},mainEntry={"html":"工業所有権","reading":"こうぎょうしょゆうけん"}. link will likely be invalid.',
      },
    ],
  );
});
