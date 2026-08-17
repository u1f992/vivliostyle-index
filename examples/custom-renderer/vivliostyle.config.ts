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
            locator: ({ locator, properties, children, fillTemplate }) => [
              h(
                "li",
                properties,
                locator.location.type === "range"
                  ? fillTemplate([
                      h("a", { href: locator.location.start }),
                      h("span"),
                      h("a", { href: locator.location.end }),
                    ])
                  : children,
              ),
            ],
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
