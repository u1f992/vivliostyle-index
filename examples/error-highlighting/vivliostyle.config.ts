import { defineConfig, readMetadata, VFM } from "@vivliostyle/cli";
import { createIndexPlugin, logMessages } from "@u1f992/vivliostyle-index";

const entry = ["chapter.md", "index.md"];
const index = createIndexPlugin({ entry });

export default defineConfig({
  title: "Index error highlighting example",
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
