import { defineConfig, readMetadata, VFM } from "@vivliostyle/cli";
import {
  byKeys,
  byListedOrder,
  createIndexPlugin,
  defaultComparator,
  logMessages,
} from "@u1f992/vivliostyle-index";

const entry = ["chapter.md", "index.md"];
const index = createIndexPlugin({
  entry,
  profiles: {
    "symbols-first": {
      comparator: (locales) => ({
        ...defaultComparator(locales),
        group: byKeys(byListedOrder(["記号"])(locales)),
      }),
    },
  },
});

export default defineConfig({
  title: "Custom comparator example",
  author: "u1f992",
  language: "ja",
  theme: "./css",
  entry,
  documentProcessor: (options, metadata) =>
    VFM(options, metadata)
      .use(index, {
        createEntryProcessor: ({ contents }) => VFM(options, readMetadata(contents)),
      })
      .use(logMessages),
});
