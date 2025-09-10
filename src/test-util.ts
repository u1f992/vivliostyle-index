import type { EntryBase, Index, Key } from "./model.js";

export function dropSequentialId<TKey extends Key>(
  indexes: Index<TKey>[],
): unknown {
  function handleEntry(entry: EntryBase<TKey>): unknown {
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
