import { defineConfig, readMetadata, VFM } from "@vivliostyle/cli";
import { createIndexPlugin } from "@u1f992/vivliostyle-index";

const entry = ["chapter.md", "index.md"];
const index = createIndexPlugin({ entry });

export default defineConfig({
  title: "Vivliostyle index E2E",
  entry,
  documentProcessor: (options, metadata) =>
    VFM(options, metadata).use(index, {
      createEntryProcessor: ({ contents }) => VFM(options, readMetadata(contents)),
    }),
});
