import { defineConfig, VFM } from "@vivliostyle/cli";
import { index, defaultComparator } from "@u1f992/vivliostyle-index";

export default defineConfig({
  title: "example",
  author: "u1f992",
  language: "ja",
  theme: "./css",
  entry: ["001-050.md", "051-099.md", "100-150.md", "index.md"],
  documentProcessor: (opt, meta) =>
    VFM(opt, meta).use(index, {
      entryProcessor: VFM(opt, meta),
      indexEntryMap: {
        "index.md": ["001-050.md", "051-099.md", "100-150.md"],
      },
      comparators: {
        $: defaultComparator("ja"),
      },
      log: console.debug,
    }),
});
