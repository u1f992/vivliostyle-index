// @ts-check

import { VFM } from "@vivliostyle/vfm";

import { vivliostyleIndex } from "@u1f992/vivliostyle-index";

/** @type {import('@vivliostyle/cli').VivliostyleConfigSchema} */
const vivliostyleConfig = {
  title: "example",
  author: "u1f992",
  language: "ja",
  // readingProgression: 'rtl', // reading progression direction, 'ltr' or 'rtl'.
  size: "A5",
  // theme: '', // .css or local dir or npm package. default to undefined
  image: "ghcr.io/vivliostyle/cli:9.1.1",
  entry: ["001-050.md", "051-110.md", "111-150.md", "151.md"], // 'entry' can be 'string' or 'object' if there's only single markdown file
  documentProcessor: (opts, meta) =>
    ((processor = VFM(opts, meta)) =>
      processor.use(vivliostyleIndex, {
        processor,
        targetEntries: ["001-050.md", "051-110.md", "111-150.md"],
        entryWithIndex: "151.md",
        indexesOutput: ".vivliostyle/index.json",
      }))(),
  // entryContext: './manuscripts', // default to '.' (relative to 'vivliostyle.config.js')
  // output: [ // path to generate draft file(s). default to '{title}.pdf'
  //   './output.pdf', // the output format will be inferred from the name.
  //   {
  //     path: './book',
  //     format: 'webpub',
  //   },
  // ],
  // workspaceDir: '.vivliostyle', // directory which is saved intermediate files.
  // toc: {
  //   title: 'Table of Contents',
  //   htmlPath: 'index.html',
  //   sectionDepth: 3,
  // },
  // cover: './cover.png', // cover image. default to undefined.
  // vfm: { // options of VFM processor
  //   replace: [ // specify replace handlers to modify HTML outputs
  //     {
  //       // This handler replaces {current_time} to a current local time tag.
  //       test: /{current_time}/,
  //       match: (_, h) => {
  //         const currentTime = new Date().toLocaleString();
  //         return h('time', { datetime: currentTime }, currentTime);
  //       },
  //     },
  //   ],
  //   hardLineBreaks: true, // converts line breaks of VFM to <br> tags. default to 'false'.
  //   disableFormatHtml: true, // disables HTML formatting. default to 'false'.
  // },
};

export default vivliostyleConfig;
