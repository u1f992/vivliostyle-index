import type { CreateHeading, CreatePreamble } from "./render.ts";
import type { CreateIndexComparator } from "./sort.ts";
import type { Target } from "./target.ts";

export type TargetSettings = Readonly<{
  comparator?: CreateIndexComparator;
  preamble?: CreatePreamble;
  heading?: CreateHeading;
}>;

export type Settings = readonly (readonly [Target, TargetSettings])[];
