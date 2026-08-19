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
      { path: "index.md", fragment: "index" },
      {
        renderer: ({ h }) => {
          const locatorList: LocatorListRenderer = {
            locator: () => ({
              location: {
                compose: ({ properties: { href: _href, ...properties }, contents }) => [
                  h("span", properties, contents),
                ],
                pageNumber: ({ properties }) => [
                  h("a", { ...properties, href: properties.dataIndexPageTarget }),
                ],
              },
            }),
          };
          return {
            compose: ({ groupList }) => [
              h("dl", { className: "index-legend" }, [
                h("dt", "→"),
                h("dd", "を見よ参照"),
                h("dt", "⇒"),
                h("dd", "をも見よ参照"),
              ]),
              ...groupList,
            ],
            groupList: {
              compose: ({ properties, groups }) => [h("ul", properties, groups.flat())],
              group: () => ({
                compose: ({ properties, heading, entryList }) => [
                  h("li", properties, [...heading, ...entryList]),
                ],
                entryList: {
                  entry: () => ({
                    locatorList,
                    subentryList: {
                      subentry: () => ({ locatorList }),
                    },
                  }),
                },
              }),
            },
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
