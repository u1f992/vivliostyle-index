import type { EntryAddress, Key } from "./model.ts";

export type ParsedEntry = EntryAddress;

export type ParsedInstruction =
  | Readonly<{
      type: "page";
      entry: ParsedEntry;
      important: boolean;
    }>
  | Readonly<{
      type: "range";
      entry: ParsedEntry;
      important: boolean;
      endReference: string;
    }>
  | Readonly<{
      type: "see" | "seeAlso";
      entry: ParsedEntry;
      target: ParsedEntry;
    }>;

export class InstructionSyntaxError extends SyntaxError {
  readonly offset: number;

  constructor(input: string, offset: number, reason: string) {
    super(`${reason} at grapheme offset ${offset}: ${JSON.stringify(input)}`);
    this.name = "InstructionSyntaxError";
    this.offset = offset;
  }
}

type ParserInput = Readonly<{
  source: string;
  graphemes: readonly string[];
}>;

type HierarchyResult = Readonly<{
  entry: ParsedEntry;
  offset: number;
}>;

type MutableParsedEntry = {
  group?: Key;
  mainEntry?: Key;
  subentry?: Key;
};

const graphemeSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
const forbiddenReadingCharacter = /[\p{Cc}\p{Cs}]/u;
const forbiddenHtmlCharacter = /[\p{Cc}\p{Cs}]/u;
const forbiddenReferenceCharacter = /[\p{Cc}\p{Cs}]/u;
const permittedHtmlControlCharacters = new Set(["\t", "\n", "\r", "\r\n"]);
const escapableCharacters = new Set(["\\", "@", "!", "|"]);

function containsForbiddenHtmlCharacter(value: string): boolean {
  for (const { segment } of graphemeSegmenter.segment(value)) {
    if (forbiddenHtmlCharacter.test(segment) && !permittedHtmlControlCharacters.has(segment)) {
      return true;
    }
  }
  return false;
}

function createParserInput(source: string): ParserInput {
  return {
    source,
    graphemes: [...graphemeSegmenter.segment(source)].map(({ segment }) => segment),
  };
}

function syntaxError(input: ParserInput, offset: number, reason: string): never {
  throw new InstructionSyntaxError(input.source, offset, reason);
}

function completeEntry(input: ParserInput, entry: MutableParsedEntry, offset: number): ParsedEntry {
  if (entry.group === undefined || entry.mainEntry === undefined) {
    return syntaxError(input, offset, "an entry must contain a group and one or two headings");
  }
  return entry.subentry === undefined
    ? { group: entry.group, mainEntry: entry.mainEntry }
    : { group: entry.group, mainEntry: entry.mainEntry, subentry: entry.subentry };
}

function parseHierarchy(
  input: ParserInput,
  start: number,
  stopAtOperator: boolean,
): HierarchyResult {
  const entry: MutableParsedEntry = {};
  let reading = "";
  let html = "";
  let hasHtml = false;
  let offset = start;

  const append = (value: string) => {
    if (hasHtml) {
      if (containsForbiddenHtmlCharacter(value)) {
        syntaxError(input, offset, "a display value contains a forbidden control character");
      }
      html += value;
    } else {
      if (forbiddenReadingCharacter.test(value)) {
        syntaxError(input, offset, "a reading contains a forbidden control character");
      }
      reading += value;
    }
  };

  const finishKey = () => {
    if (reading.trim() === "") {
      syntaxError(input, offset, "a reading must contain a non-whitespace character");
    }
    if (hasHtml && html.trim() === "") {
      syntaxError(input, offset, "a display value must contain a non-whitespace character");
    }
    const key = { html: hasHtml ? html : reading, reading };
    if (entry.group === undefined) {
      entry.group = key;
    } else if (entry.mainEntry === undefined) {
      entry.mainEntry = key;
    } else if (entry.subentry === undefined) {
      entry.subentry = key;
    } else {
      syntaxError(input, offset, "an entry must not contain more than two headings");
    }
    reading = "";
    html = "";
    hasHtml = false;
  };

  while (offset < input.graphemes.length) {
    const character = input.graphemes[offset]!;
    const nextCharacter = input.graphemes[offset + 1];

    if (character === "\\") {
      if (nextCharacter === undefined || !escapableCharacters.has(nextCharacter)) {
        syntaxError(input, offset, "an escape must be followed by \\, @, !, or |");
      }
      append(nextCharacter);
      offset += 2;
      continue;
    }

    if (character === "@") {
      if (hasHtml || reading === "") {
        syntaxError(input, offset, "an unescaped @ must separate a reading and display value");
      }
      hasHtml = true;
      offset++;
      continue;
    }

    if (character === "!") {
      finishKey();
      offset++;
      continue;
    }

    if (character === "|") {
      if (!stopAtOperator) {
        syntaxError(input, offset, "an unescaped | is not allowed in a reference target");
      }
      finishKey();
      return { entry: completeEntry(input, entry, offset), offset };
    }

    append(character);
    offset++;
  }

  finishKey();
  return { entry: completeEntry(input, entry, offset), offset };
}

function parseRange(
  input: ParserInput,
  entry: ParsedEntry,
  referenceOffset: number,
  important: boolean,
): ParsedInstruction {
  const referenceGraphemes = input.graphemes.slice(referenceOffset);
  const endReference = referenceGraphemes.join("");
  if (endReference.trim() === "") {
    syntaxError(input, referenceOffset, "a range end reference must not be blank");
  }
  const forbiddenCharacterOffset = referenceGraphemes.findIndex((character) =>
    forbiddenReferenceCharacter.test(character),
  );
  if (forbiddenCharacterOffset !== -1) {
    syntaxError(
      input,
      referenceOffset + forbiddenCharacterOffset,
      "a range end reference contains a control character",
    );
  }
  return { type: "range", entry, important, endReference };
}

function parseReference(
  input: ParserInput,
  entry: ParsedEntry,
  targetOffset: number,
  type: "see" | "seeAlso",
): ParsedInstruction {
  const { entry: target, offset } = parseHierarchy(input, targetOffset, false);
  if (offset !== input.graphemes.length) {
    syntaxError(input, offset, "unexpected content after a reference target");
  }
  return { type, entry, target };
}

function startsWith(input: ParserInput, offset: number, expected: readonly string[]): boolean {
  return expected.every((character, index) => input.graphemes[offset + index] === character);
}

export function parseInstruction(source: string): ParsedInstruction {
  const input = createParserInput(source);
  const { entry, offset } = parseHierarchy(input, 0, true);
  if (offset === input.graphemes.length) {
    return { type: "page", entry, important: false };
  }

  const operatorOffset = offset + 1;
  if (input.graphemes.length === operatorOffset + 1 && input.graphemes[operatorOffset] === "!") {
    return { type: "page", entry, important: true };
  }
  if (startsWith(input, operatorOffset, ["!", "("])) {
    return parseRange(input, entry, operatorOffset + 2, true);
  }
  if (startsWith(input, operatorOffset, ["("])) {
    return parseRange(input, entry, operatorOffset + 1, false);
  }
  if (startsWith(input, operatorOffset, ["-", ">"])) {
    return parseReference(input, entry, operatorOffset + 2, "see");
  }
  if (startsWith(input, operatorOffset, ["=", ">"])) {
    return parseReference(input, entry, operatorOffset + 2, "seeAlso");
  }
  return syntaxError(input, operatorOffset, "unknown index instruction operator");
}
