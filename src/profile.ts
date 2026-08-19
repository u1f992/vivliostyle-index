import { defaultRenderer, type CreateRenderer } from "./render.ts";
import { defaultComparator, type CreateIndexComparator } from "./sort.ts";

export type IndexProfile = Readonly<{
  comparator?: CreateIndexComparator;
  renderer?: CreateRenderer;
}>;

export type Profiles = Readonly<Record<string, IndexProfile>>;

export type ResolvedIndexProfile = Readonly<Required<IndexProfile>>;

export const defaultProfile: ResolvedIndexProfile = {
  comparator: defaultComparator,
  renderer: defaultRenderer,
};

export function resolveProfiles(profiles: Profiles): ReadonlyMap<string, ResolvedIndexProfile> {
  const resolved = new Map<string, ResolvedIndexProfile>();
  for (const [name, profile] of Object.entries(profiles)) {
    resolved.set(name, {
      comparator: profile.comparator ?? defaultProfile.comparator,
      renderer: profile.renderer ?? defaultProfile.renderer,
    });
  }
  return resolved;
}
