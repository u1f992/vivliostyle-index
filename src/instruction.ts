import {
  createKey,
  ensureEntry,
  insertLocator,
  insertXref,
  type EntryAddress,
  type IndexBuilder,
  type Key,
  type LocatorError,
  type XrefType,
} from "./model.ts";
import { identityTemplate } from "./template.ts";

export type ParsedInstruction =
  | Readonly<{
      type: "page";
      address: EntryAddress;
      template: string;
    }>
  | Readonly<{
      type: "range-start";
      address: EntryAddress;
      template: string;
    }>
  | Readonly<{
      type: "range-end";
      address: EntryAddress;
    }>
  | Readonly<{
      type: XrefType;
      address: EntryAddress;
      target: EntryAddress;
      template: string;
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

type MetaTokenType =
  | "display"
  | "heading"
  | "template"
  | "range-start"
  | "range-end"
  | "preferred"
  | "related"
  | "xref-end";

type MetaToken = Readonly<{
  type: MetaTokenType;
  offset: number;
}>;

type TextToken = Readonly<{
  type: "text";
  value: string;
  offset: number;
}>;

type Token = MetaToken | TextToken;

type ParserState = {
  input: ParserInput;
  tokens: readonly Token[];
  position: number;
};

type HierarchyResult = Readonly<{
  address: EntryAddress;
  terminator: MetaToken | undefined;
}>;

type MutableEntryAddress = {
  group?: Key;
  entry?: Key;
  subentry?: Key;
};

const graphemeSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
const escapableCharacters = new Set(["\\", "@", "!", "|", "(", ")", "{", "}"]);
const tokenLexemes = {
  related: ["|", "s", "e", "e", "a", "l", "s", "o", "{"],
  preferred: ["|", "s", "e", "e", "{"],
  "range-start": ["|", "("],
  "range-end": ["|", ")"],
  display: ["@"],
  heading: ["!"],
  template: ["|"],
  "xref-end": ["}"],
} as const satisfies Record<MetaTokenType, readonly string[]>;
const tokenTypes = [
  "related",
  "preferred",
  "range-start",
  "range-end",
  "display",
  "heading",
  "template",
  "xref-end",
] as const satisfies readonly MetaTokenType[];
const instructionTerminators = new Set<MetaTokenType>([
  "template",
  "range-start",
  "range-end",
  "preferred",
  "related",
]);
const xrefTerminators = new Set<MetaTokenType>(["xref-end"]);

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
    syntaxError(input, offset, "an escape must be followed by \\, @, !, |, (, ), {, or }");
  }
  return escapedCharacter;
}

function startsWith(input: ParserInput, offset: number, expected: readonly string[]): boolean {
  return expected.every((character, index) => input.graphemes[offset + index] === character);
}

function metaTokenAt(input: ParserInput, offset: number): MetaToken | undefined {
  const type = tokenTypes.find((candidate) => startsWith(input, offset, tokenLexemes[candidate]));
  return type === undefined ? undefined : { type, offset };
}

function tokenize(input: ParserInput): Token[] {
  const tokens: Token[] = [];
  let offset = 0;
  let textStart = 0;
  const emitText = (end: number) => {
    if (textStart !== end) {
      tokens.push({
        type: "text",
        value: input.graphemes.slice(textStart, end).join(""),
        offset: textStart,
      });
    }
  };

  while (offset < input.graphemes.length) {
    if (input.graphemes[offset] === "\\") {
      emitText(offset);
      tokens.push({ type: "text", value: unescapeAt(input, offset), offset });
      offset += 2;
      textStart = offset;
      continue;
    }
    const token = metaTokenAt(input, offset);
    if (token === undefined) {
      offset++;
      continue;
    }
    emitText(offset);
    tokens.push(token);
    offset += tokenLexemes[token.type].length;
    textStart = offset;
  }
  emitText(offset);
  return tokens;
}

function currentToken(state: ParserState): Token | undefined {
  return state.tokens[state.position];
}

function consumeToken(state: ParserState): Token | undefined {
  const token = currentToken(state);
  if (token !== undefined) {
    state.position++;
  }
  return token;
}

function tokenLabel(token: MetaToken): string {
  return tokenLexemes[token.type].join("");
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

function parseHierarchy(
  state: ParserState,
  terminators: ReadonlySet<MetaTokenType>,
): HierarchyResult {
  const { input } = state;
  const address: MutableEntryAddress = {};
  let reading = "";
  let html = "";
  let hasHtml = false;
  let offset = currentToken(state)?.offset ?? input.graphemes.length;

  const append = (token: TextToken) => {
    if (hasHtml) {
      html += token.value;
    } else {
      reading += token.value;
    }
  };

  const finishKey = () => {
    if (reading === "") {
      syntaxError(input, offset, "a reading must not be empty");
    }
    if (hasHtml && html === "") {
      syntaxError(input, offset, "a display value must not be empty");
    }
    const key = createKey(reading, hasHtml ? html : reading);
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

  for (;;) {
    const token = currentToken(state);
    if (token === undefined) {
      offset = input.graphemes.length;
      finishKey();
      return { address: completeAddress(input, address, offset), terminator: undefined };
    }
    offset = token.offset;
    if (token.type === "text") {
      append(token);
      consumeToken(state);
      continue;
    }
    if (token.type === "display") {
      if (hasHtml || reading === "") {
        syntaxError(input, offset, "an unescaped @ must separate a reading and display value");
      }
      hasHtml = true;
      consumeToken(state);
      continue;
    }
    if (token.type === "heading") {
      finishKey();
      consumeToken(state);
      continue;
    }
    if (terminators.has(token.type)) {
      finishKey();
      consumeToken(state);
      return { address: completeAddress(input, address, offset), terminator: token };
    }
    syntaxError(input, offset, `unexpected ${JSON.stringify(tokenLabel(token))}`);
  }
}

function parseTemplate(state: ParserState): string {
  const { input } = state;
  let template = "";
  for (;;) {
    const token = consumeToken(state);
    if (token === undefined) {
      return template;
    }
    if (token.type !== "text") {
      syntaxError(
        input,
        token.offset,
        `an unescaped ${JSON.stringify(tokenLabel(token))} is not allowed in a template`,
      );
    }
    template += token.value;
  }
}

function parseTemplateSection(state: ParserState): string {
  const token = currentToken(state);
  if (token === undefined) {
    return identityTemplate;
  }
  if (token.type !== "template") {
    syntaxError(state.input, token.offset, "a template must be introduced by |");
  }
  consumeToken(state);
  return parseTemplate(state);
}

function parseXref(state: ParserState, address: EntryAddress, type: XrefType): ParsedInstruction {
  const { address: target, terminator } = parseHierarchy(state, xrefTerminators);
  if (terminator?.type !== "xref-end") {
    syntaxError(
      state.input,
      state.input.graphemes.length,
      "a cross-reference target must end with }",
    );
  }
  return { type, address, target, template: parseTemplateSection(state) };
}

export function parseInstruction(source: string): ParsedInstruction {
  const input = createParserInput(source);
  const state: ParserState = { input, tokens: tokenize(input), position: 0 };
  const { address, terminator } = parseHierarchy(state, instructionTerminators);
  if (terminator === undefined) {
    return { type: "page", address, template: identityTemplate };
  }
  switch (terminator.type) {
    case "template":
      return { type: "page", address, template: parseTemplate(state) };
    case "range-start":
      return { type: "range-start", address, template: parseTemplateSection(state) };
    case "range-end": {
      const trailingToken = currentToken(state);
      if (trailingToken !== undefined) {
        syntaxError(input, trailingToken.offset, "a range end must end the instruction");
      }
      return { type: "range-end", address };
    }
    case "preferred":
      return parseXref(state, address, "preferred");
    case "related":
      return parseXref(state, address, "related");
    default:
      return syntaxError(
        input,
        terminator.offset,
        `unexpected ${JSON.stringify(tokenLabel(terminator))}`,
      );
  }
}

type PageInstruction = Extract<ParsedInstruction, { type: "page" }>;
type RangeInstruction = Extract<ParsedInstruction, { type: "range-start" }>;
type XrefInstruction = Extract<ParsedInstruction, { type: XrefType }>;

export function applyPageInstruction(
  builder: IndexBuilder,
  instruction: PageInstruction,
  locationHref: string,
  error?: LocatorError,
): void {
  insertLocator(ensureEntry(builder, instruction.address), {
    location: { type: "page", href: locationHref },
    template: instruction.template,
    ...(error === undefined ? {} : { error }),
  });
}

export function applyRangeInstruction(
  builder: IndexBuilder,
  instruction: RangeInstruction,
  startHref: string,
  endHref: string,
): void {
  insertLocator(ensureEntry(builder, instruction.address), {
    location: { type: "range", start: startHref, end: endHref },
    template: instruction.template,
  });
}

export function applyXrefInstruction(builder: IndexBuilder, instruction: XrefInstruction): void {
  insertXref(
    ensureEntry(builder, instruction.address),
    instruction.type,
    instruction.target,
    instruction.template,
  );
}
