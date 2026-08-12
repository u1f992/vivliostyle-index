import type { EntryBase, Index } from "../src/model.ts";

export function dropSequentialId(indexes: Index[]): unknown {
  function handleEntry(entry: EntryBase): unknown {
    return {
      ...entry,
      locators: entry.locators.map(([, locator, flag]) => [locator, flag]),
      see: entry.see.map(([, ...rest]) => rest),
      seeAlso: entry.seeAlso.map(([, ...rest]) => rest),
    };
  }
  return indexes.map((index) => ({
    id: index.id,
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
  }));
}
