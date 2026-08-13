import { addMessage, messages, type MessageArguments } from "./messages.ts";
import { revokeVacantEntries, type Index, type Revocation } from "./model.ts";
import type { Target } from "./target.ts";

export type Revocable = Readonly<{
  reportingPath: string;
  revoke: Revocation;
  findViolation: () => MessageArguments | undefined;
}>;

export type RevocationScope = Readonly<{
  index: Index;
  target: Target;
  reportingPaths: readonly string[];
  revocables: readonly Revocable[];
}>;

export function revokeViolations(
  { index, target, reportingPaths, revocables }: RevocationScope,
  messagesByDocument: Map<string, MessageArguments[]>,
): void {
  let pending = revocables;
  for (;;) {
    for (const address of revokeVacantEntries(index)) {
      for (const reportingPath of reportingPaths) {
        addMessage(messagesByDocument, reportingPath, messages.vacantEntry(target, address));
      }
    }

    const retained: Revocable[] = [];
    for (const revocable of pending) {
      const violation = revocable.findViolation();
      if (violation === undefined) {
        retained.push(revocable);
        continue;
      }
      revocable.revoke();
      addMessage(messagesByDocument, revocable.reportingPath, violation);
    }

    if (retained.length === pending.length) {
      return;
    }
    pending = retained;
  }
}
