import type { EntryBase, Index } from "../src/model.ts";

export function dropSequences(index: Index): unknown {
  function handleEntry(entry: EntryBase): unknown {
    return {
      ...entry,
      locators: entry.locators.map(({ sequence: _, ...rest }) => rest),
      see: entry.see.map(({ sequence: _, ...rest }) => rest),
      seeAlso: entry.seeAlso.map(({ sequence: _, ...rest }) => rest),
    };
  }
  return {
    children: index.children.map((group) => ({
      key: group.key,
      children: group.children.map((main) => ({
        key: main.key,
        // @ts-expect-error ignore
        ...handleEntry(main),
        children: main.children.map((sub) => ({
          key: sub.key,
          // @ts-expect-error ignore
          ...handleEntry(sub),
        })),
      })),
    })),
  };
}
