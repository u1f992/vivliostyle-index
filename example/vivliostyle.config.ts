import { defineConfig, readMetadata, VFM } from "@vivliostyle/cli";
import { createPlugin as createIndexPlugin, logMessages } from "@u1f992/vivliostyle-index";

const entry = ["001-050.md", "051-099.md", "index.md", "100-150.md"];
const index = createIndexPlugin({ entry });

export default defineConfig({
  title: "example",
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
