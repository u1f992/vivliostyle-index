// @ts-check

import Ajv from "ajv";
const ajv = new Ajv();

/**
 * @typedef {[string] | [string, string] | [string, string, string]} EntryQuery
 * @typedef {[EntryQuery] | [EntryQuery, string] | [EntryQuery, string, string]} SubentryQuery
 *
 * @typedef {[string, EntryQuery]} RegisterPageLocatorToEntryQuery
 * @typedef {[string, EntryQuery, "range"]} RegisterRangeLocatorToEntryQuery
 * @typedef {[string, EntryQuery, "see", EntryQuery]} RegisterSeeReferenceOfEntryToEntryQuery
 * @typedef {[string, EntryQuery, "see", SubentryQuery]} RegisterSeeReferenceOfSubentryToEntryQuery
 * @typedef {[string, EntryQuery, "seeAlso", EntryQuery]} RegisterSeeAlsoReferenceOfEntryToEntryQuery
 * @typedef {[string, EntryQuery, "seeAlso", SubentryQuery]} RegisterSeeAlsoReferenceOfSubentryToEntryQuery
 *
 * @typedef {[string, SubentryQuery]} RegisterPageLocatorToSubentryQuery
 * @typedef {[string, SubentryQuery, "range"]} RegisterRangeLocatorToSubentryQuery
 * @typedef {[string, SubentryQuery, "see", EntryQuery]} RegisterSeeReferenceOfEntryToSubentryQuery
 * @typedef {[string, SubentryQuery, "see", SubentryQuery]} RegisterSeeReferenceOfSubentryToSubentryQuery
 * @typedef {[string, SubentryQuery, "seeAlso", EntryQuery]} RegisterSeeAlsoReferenceOfEntryToSubentryQuery
 * @typedef {[string, SubentryQuery, "seeAlso", SubentryQuery]} RegisterSeeAlsoReferenceOfSubentryToSubentryQuery
 */

/** @type {{ type: "array", minItems: 1, additionalItems: false }} */
const tupleOf1 = { type: "array", minItems: 1, additionalItems: false };
/** @type {{ type: "array", minItems: 2, additionalItems: false }} */
const tupleOf2 = { type: "array", minItems: 2, additionalItems: false };
/** @type {{ type: "array", minItems: 3, additionalItems: false }} */
const tupleOf3 = { type: "array", minItems: 3, additionalItems: false };
/** @type {{ type: "array", minItems: 4, additionalItems: false }} */
const tupleOf4 = { type: "array", minItems: 4, additionalItems: false };
/** @type {{ type: "string", minLength: 1 }} */
const nonEmptyString = { type: "string", minLength: 1 };

/** @type {import("ajv").JSONSchemaType<EntryQuery>} */
const entryQuerySchema = {
  oneOf: [
    {
      ...tupleOf1,
      items: [nonEmptyString],
    },
    {
      ...tupleOf2,
      items: [nonEmptyString, nonEmptyString],
    },
    {
      ...tupleOf3,
      items: [nonEmptyString, nonEmptyString, nonEmptyString],
    },
  ],
};

/** @type {import("ajv").JSONSchemaType<SubentryQuery>} */
const subentryQuerySchema = {
  oneOf: [
    {
      ...tupleOf1,
      items: [entryQuerySchema],
    },
    {
      ...tupleOf2,
      items: [entryQuerySchema, nonEmptyString],
    },
    {
      ...tupleOf3,
      items: [entryQuerySchema, nonEmptyString, nonEmptyString],
    },
  ],
};

export const getRegisterPageLocatorToEntryQueryValidator = () =>
  ajv.compile(
    /** @type {import("ajv").JSONSchemaType<RegisterPageLocatorToEntryQuery>} */ ({
      ...tupleOf2,
      items: [nonEmptyString, entryQuerySchema],
    }),
  );

export const getRegisterRangeLocatorToEntryQueryValidator = () =>
  ajv.compile(
    /** @type {import("ajv").JSONSchemaType<RegisterRangeLocatorToEntryQuery>} */ ({
      ...tupleOf3,
      items: [
        nonEmptyString,
        entryQuerySchema,
        { type: "string", const: "range" },
      ],
    }),
  );

export const getRegisterSeeReferenceOfEntryToEntryQueryValidator = () =>
  ajv.compile(
    /** @type {import("ajv").JSONSchemaType<RegisterSeeReferenceOfEntryToEntryQuery>} */ ({
      ...tupleOf4,
      items: [
        nonEmptyString,
        entryQuerySchema,
        { type: "string", const: "see" },
        entryQuerySchema,
      ],
    }),
  );

export const getRegisterSeeReferenceOfSubentryToEntryQueryValidator = () =>
  ajv.compile(
    /** @type {import("ajv").JSONSchemaType<RegisterSeeReferenceOfSubentryToEntryQuery>} */ ({
      ...tupleOf4,
      items: [
        nonEmptyString,
        entryQuerySchema,
        { type: "string", const: "see" },
        subentryQuerySchema,
      ],
    }),
  );

export const getRegisterSeeAlsoReferenceOfEntryToEntryQueryValidator = () =>
  ajv.compile(
    /** @type {import("ajv").JSONSchemaType<RegisterSeeAlsoReferenceOfEntryToEntryQuery>} */ ({
      ...tupleOf4,
      items: [
        nonEmptyString,
        entryQuerySchema,
        { type: "string", const: "seeAlso" },
        entryQuerySchema,
      ],
    }),
  );

export const getRegisterSeeAlsoReferenceOfSubentryToEntryQueryValidator = () =>
  ajv.compile(
    /** @type {import("ajv").JSONSchemaType<RegisterSeeAlsoReferenceOfSubentryToEntryQuery>} */ ({
      ...tupleOf4,
      items: [
        nonEmptyString,
        entryQuerySchema,
        { type: "string", const: "seeAlso" },
        subentryQuerySchema,
      ],
    }),
  );

export const getRegisterPageLocatorToSubentryQueryValidator = () =>
  ajv.compile(
    /** @type {import("ajv").JSONSchemaType<RegisterPageLocatorToSubentryQuery>} */ ({
      ...tupleOf2,
      items: [nonEmptyString, subentryQuerySchema],
    }),
  );

export const getRegisterRangeLocatorToSubentryQueryValidator = () =>
  ajv.compile(
    /** @type {import("ajv").JSONSchemaType<RegisterRangeLocatorToSubentryQuery>} */ ({
      ...tupleOf3,
      items: [
        nonEmptyString,
        subentryQuerySchema,
        { type: "string", const: "range" },
      ],
    }),
  );

export const getRegisterSeeReferenceOfEntryToSubentryQueryValidator = () =>
  ajv.compile(
    /** @type {import("ajv").JSONSchemaType<RegisterSeeReferenceOfEntryToSubentryQuery>} */ ({
      ...tupleOf4,
      items: [
        nonEmptyString,
        subentryQuerySchema,
        { type: "string", const: "see" },
        entryQuerySchema,
      ],
    }),
  );

export const getRegisterSeeReferenceOfSubentryToSubentryQueryValidator = () =>
  ajv.compile(
    /** @type {import("ajv").JSONSchemaType<RegisterSeeReferenceOfSubentryToSubentryQuery>} */ ({
      ...tupleOf4,
      items: [
        nonEmptyString,
        subentryQuerySchema,
        { type: "string", const: "see" },
        subentryQuerySchema,
      ],
    }),
  );

export const getRegisterSeeAlsoReferenceOfEntryToSubentryQueryValidator = () =>
  ajv.compile(
    /** @type {import("ajv").JSONSchemaType<RegisterSeeAlsoReferenceOfEntryToSubentryQuery>} */ ({
      ...tupleOf4,
      items: [
        nonEmptyString,
        subentryQuerySchema,
        { type: "string", const: "seeAlso" },
        entryQuerySchema,
      ],
    }),
  );

export const getRegisterSeeAlsoReferenceOfSubentryToSubentryQueryValidator =
  () =>
    ajv.compile(
      /** @type {import("ajv").JSONSchemaType<RegisterSeeAlsoReferenceOfSubentryToSubentryQuery>} */ ({
        ...tupleOf4,
        items: [
          nonEmptyString,
          subentryQuerySchema,
          { type: "string", const: "seeAlso" },
          subentryQuerySchema,
        ],
      }),
    );
