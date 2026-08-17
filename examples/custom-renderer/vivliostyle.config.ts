import { defineConfig, readMetadata, VFM } from "@vivliostyle/cli";
import { createIndexPlugin, indexRenderer, logMessages } from "@u1f992/vivliostyle-index";

const entry = ["chapter.md", "index.md"];
const index = createIndexPlugin({
  entry,
  settings: [
    [
      { path: "index.md", id: "index" },
      {
        renderer: ({ h }) =>
          indexRenderer({
            preamble: () => [
              h("dl", { className: "index-legend" }, [
                h("dt", "→"),
                h("dd", "を見よ参照"),
                h("dt", "⇒"),
                h("dd", "をも見よ参照"),
              ]),
            ],
            group: () => ({
              self: ({ heading, entryList }) => [
                h("li", { dataIndexRole: "group" }, [...heading, ...entryList]),
              ],
            }),
            groupList: ({ groups }) => [
              h(
                "ul",
                { dataIndexRole: "group-list" },
                groups.flatMap(({ children }) => children),
              ),
            ],
          }),
      },
    ],
  ],
});

export default defineConfig({
  title: "Custom renderer example",
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
