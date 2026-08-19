import assert from "node:assert";
import test from "node:test";

import { defaultProfile, resolveProfiles, type Profiles } from "../src/profile.ts";
import { defaultRenderer } from "../src/render.ts";
import { defaultComparator } from "../src/sort.ts";

void test("completes named profiles from the default profile", () => {
  const renderer = () => ({});
  const comparator = () => defaultComparator("en");
  const profiles = resolveProfiles({
    renderer: { renderer },
    comparator: { comparator },
  });

  assert.strictEqual(profiles.get("renderer")?.renderer, renderer);
  assert.strictEqual(profiles.get("renderer")?.comparator, defaultProfile.comparator);
  assert.strictEqual(profiles.get("comparator")?.comparator, comparator);
  assert.strictEqual(profiles.get("comparator")?.renderer, defaultProfile.renderer);
});

void test("publishes the concrete default profile", () => {
  assert.strictEqual(defaultProfile.comparator, defaultComparator);
  assert.strictEqual(defaultProfile.renderer, defaultRenderer);
});

void test("treats explicit undefined as omitted", () => {
  const input = {
    named: { comparator: undefined, renderer: undefined },
  } as unknown as Profiles;
  const profile = resolveProfiles(input).get("named");

  assert.strictEqual(profile?.comparator, defaultProfile.comparator);
  assert.strictEqual(profile?.renderer, defaultProfile.renderer);
});
