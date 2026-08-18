import { defineConfig, readMetadata, VFM } from "@vivliostyle/cli";
import {
  createIndexPlugin,
  logMessages,
  type LocatorListRenderer,
} from "@u1f992/vivliostyle-index";

const entry = ["chapter.md", "index.md"];
const index = createIndexPlugin({
  entry,
  settings: [
    [
      { path: "index.md", id: "index" },
      {
        renderer: ({ h }) => {
          const locatorList = (): LocatorListRenderer => ({
            locator: ({ properties }) => ({
              pageNumber: ({ properties, target }) => [h("a", { ...properties, href: target })],
              self: ({ contents }) => [h("span", properties, contents)],
            }),
          });
          return {
            preamble: () => [
              h("dl", { className: "index-legend" }, [
                h("dt", "→"),
                h("dd", "を見よ参照"),
                h("dt", "⇒"),
                h("dd", "をも見よ参照"),
              ]),
            ],
            groupList: ({ properties }) => ({
              group: ({ properties }) => ({
                entryList: () => ({
                  entry: () => ({
                    locatorList,
                    subentryList: () => ({
                      subentry: () => ({ locatorList }),
                    }),
                  }),
                }),
                self: ({ heading, entryList }) => [h("li", properties, [...heading, ...entryList])],
              }),
              self: ({ groups }) => [
                h(
                  "ul",
                  properties,
                  groups.flatMap(({ content }) => content),
                ),
              ],
            }),
          };
        },
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
