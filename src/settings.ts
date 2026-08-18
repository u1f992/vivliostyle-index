import type { CreateRenderer, IndexCompose } from "./render.ts";
import type { CreateIndexComparator } from "./sort.ts";
import type { Target } from "./target.ts";

export type TargetSettings = Readonly<{
  comparator?: CreateIndexComparator;
  renderer?: CreateRenderer;
  compose?: IndexCompose;
}>;

export type Settings = readonly (readonly [Target, TargetSettings])[];
