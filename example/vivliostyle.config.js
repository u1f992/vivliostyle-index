// @ts-check

import { VFM } from "@vivliostyle/vfm";
import { index, defaultComparator } from "@u1f992/vivliostyle-index";

/** @type {import('@vivliostyle/cli').VivliostyleConfigSchema} */
const vivliostyleConfig = {
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
      // eslint-disable-next-line no-undef
      log: console.debug,
    }),
};

export default vivliostyleConfig;
