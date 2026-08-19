import { defineConfig, readMetadata, VFM } from "@vivliostyle/cli";
import { createIndexPlugin, logMessages, type IndexPluginOptions } from "@u1f992/vivliostyle-index";

const entry = ["001-050.md", "051-097.md", "098-099-index.md", "100-150.md"];
const index = createIndexPlugin({ entry });

export default defineConfig({
  title: "Basic example",
  author: "u1f992",
  language: "ja",
  theme: "./css",
  entry,
  documentProcessor: (options, metadata) =>
    VFM(options, metadata)
      .use(index, {
        // `readMetadata` is the document metadata reader corresponding to `VFM`.
        createEntryProcessor: ({ contents }) => VFM(options, readMetadata(contents)),
        // `satisfies` makes the plugin option documentation available on hover in this `use` call.
      } satisfies IndexPluginOptions)
      .use(logMessages),
});
