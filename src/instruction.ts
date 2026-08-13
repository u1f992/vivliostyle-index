import {
  ensureEntry,
  insertLocator,
  insertReference,
  type EntryAddress,
  type Index,
  type Key,
  type ReferenceType,
  type Revocation,
} from "./model.ts";

export type ParsedInstruction =
  | Readonly<{
      type: "page";
      address: EntryAddress;
      template?: string;
    }>
  | Readonly<{
      type: "range";
      address: EntryAddress;
      endReference: string;
      template?: string;
    }>
  | Readonly<{
      type: ReferenceType;
      address: EntryAddress;
      target: EntryAddress;
      template?: string;
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
  address: EntryAddress;
  offset: number;
}>;

type MutableEntryAddress = {
  group?: Key;
  entry?: Key;
  subentry?: Key;
};

const graphemeSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
// Unicode general categories Cc (control) and Cs (surrogate)
const forbiddenCharacter = /[\p{Cc}\p{Cs}]/u;
const permittedHtmlControlCharacters = new Set(["\t", "\n", "\r", "\r\n"]);
const escapableCharacters = new Set(["\\", "@", "!", "|"]);

function containsForbiddenHtmlCharacter(value: string): boolean {
  for (const { segment } of graphemeSegmenter.segment(value)) {
    if (forbiddenCharacter.test(segment) && !permittedHtmlControlCharacters.has(segment)) {
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

function unescapeAt(input: ParserInput, offset: number): string {
  const escapedCharacter = input.graphemes[offset + 1];
  if (escapedCharacter === undefined || !escapableCharacters.has(escapedCharacter)) {
    syntaxError(input, offset, "an escape must be followed by \\, @, !, or |");
  }
  return escapedCharacter;
}

function completeAddress(
  input: ParserInput,
  address: MutableEntryAddress,
  offset: number,
): EntryAddress {
  if (address.group === undefined || address.entry === undefined) {
    return syntaxError(input, offset, "an entry must contain a group and one or two headings");
  }
  return address.subentry === undefined
    ? { group: address.group, entry: address.entry }
    : { group: address.group, entry: address.entry, subentry: address.subentry };
}

function parseHierarchy(input: ParserInput, start: number): HierarchyResult {
  const address: MutableEntryAddress = {};
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
      if (forbiddenCharacter.test(value)) {
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
    const normalizedReading = reading.normalize("NFC");
    const key = {
      html: hasHtml ? html.normalize("NFC") : normalizedReading,
      reading: normalizedReading,
    };
    if (address.group === undefined) {
      address.group = key;
    } else if (address.entry === undefined) {
      address.entry = key;
    } else if (address.subentry === undefined) {
      address.subentry = key;
    } else {
      syntaxError(input, offset, "an entry must not contain more than two headings");
    }
    reading = "";
    html = "";
    hasHtml = false;
  };

  while (offset < input.graphemes.length) {
    const character = input.graphemes[offset]!;

    if (character === "\\") {
      append(unescapeAt(input, offset));
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
      finishKey();
      return { address: completeAddress(input, address, offset), offset };
    }

    append(character);
    offset++;
  }

  finishKey();
  return { address: completeAddress(input, address, offset), offset };
}

function parseTemplate(input: ParserInput, start: number): string {
  let template = "";
  let offset = start;

  while (offset < input.graphemes.length) {
    const character = input.graphemes[offset]!;

    if (character === "\\") {
      template += unescapeAt(input, offset);
      offset += 2;
      continue;
    }

    if (containsForbiddenHtmlCharacter(character)) {
      syntaxError(input, offset, "a template contains a forbidden control character");
    }

    template += character;
    offset++;
  }

  return template;
}

type EndReferenceResult = Readonly<{
  endReference: string;
  offset: number;
}>;

function parseEndReference(input: ParserInput, start: number): EndReferenceResult {
  let endReference = "";
  let offset = start;

  while (offset < input.graphemes.length) {
    const character = input.graphemes[offset]!;

    if (character === "\\") {
      endReference += unescapeAt(input, offset);
      offset += 2;
      continue;
    }

    if (character === "|") {
      break;
    }

    if (forbiddenCharacter.test(character)) {
      syntaxError(input, offset, "a range end reference contains a control character");
    }

    endReference += character;
    offset++;
  }

  if (endReference.trim() === "") {
    syntaxError(input, start, "a range end reference must not be blank");
  }
  return { endReference, offset };
}

function parseRange(input: ParserInput, address: EntryAddress, start: number): ParsedInstruction {
  const { endReference, offset } = parseEndReference(input, start);
  return offset === input.graphemes.length
    ? { type: "range", address, endReference }
    : { type: "range", address, endReference, template: parseTemplate(input, offset + 1) };
}

function parseReference(
  input: ParserInput,
  address: EntryAddress,
  targetOffset: number,
  type: ReferenceType,
): ParsedInstruction {
  const { address: target, offset } = parseHierarchy(input, targetOffset);
  return offset === input.graphemes.length
    ? { type, address, target }
    : { type, address, target, template: parseTemplate(input, offset + 1) };
}

function startsWith(input: ParserInput, offset: number, expected: readonly string[]): boolean {
  return expected.every((character, index) => input.graphemes[offset + index] === character);
}

export function parseInstruction(source: string): ParsedInstruction {
  const input = createParserInput(source);
  const { address, offset } = parseHierarchy(input, 0);
  if (offset === input.graphemes.length) {
    return { type: "page", address };
  }

  const operatorOffset = offset + 1;
  if (startsWith(input, operatorOffset, ["|"])) {
    return { type: "page", address, template: parseTemplate(input, operatorOffset + 1) };
  }
  if (startsWith(input, operatorOffset, ["("])) {
    return parseRange(input, address, operatorOffset + 1);
  }
  if (startsWith(input, operatorOffset, ["-", ">"])) {
    return parseReference(input, address, operatorOffset + 2, "see");
  }
  if (startsWith(input, operatorOffset, ["=", ">"])) {
    return parseReference(input, address, operatorOffset + 2, "see-also");
  }
  return syntaxError(input, operatorOffset, "unknown index instruction operator");
}

type PageInstruction = Extract<ParsedInstruction, { type: "page" }>;
type RangeInstruction = Extract<ParsedInstruction, { type: "range" }>;
type ReferenceInstruction = Extract<ParsedInstruction, { type: ReferenceType }>;

export function applyPageInstruction(
  index: Index,
  instruction: PageInstruction,
  locationHref: string,
): Revocation {
  return insertLocator(ensureEntry(index, instruction.address), {
    location: { type: "page", href: locationHref },
    ...(instruction.template === undefined ? {} : { template: instruction.template }),
  });
}

export function applyRangeInstruction(
  index: Index,
  instruction: RangeInstruction,
  startHref: string,
  endHref: string,
): Revocation {
  return insertLocator(ensureEntry(index, instruction.address), {
    location: { type: "range", start: startHref, end: endHref },
    ...(instruction.template === undefined ? {} : { template: instruction.template }),
  });
}

export function applyReferenceInstruction(
  index: Index,
  instruction: ReferenceInstruction,
): Revocation {
  return insertReference(
    ensureEntry(index, instruction.address),
    instruction.type,
    instruction.target,
    instruction.template,
  );
}
