import type { CreateRenderer } from "./render.ts";
import type { CreateIndexComparator } from "./sort.ts";
import type { Target } from "./target.ts";

export type TargetSettings = Readonly<{
  comparator?: CreateIndexComparator;
  renderer?: CreateRenderer;
}>;

export type Settings = readonly (readonly [Target, TargetSettings])[];
