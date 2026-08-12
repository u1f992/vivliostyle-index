# @u1f992/vivliostyle-index

[unified](https://github.com/unifiedjs/unified) plugin that integrates automatic index generation into [Vivliostyle CLI](https://github.com/vivliostyle/vivliostyle-cli) workflows.

This project seeks to align with the requirements presented in 藤田節子's『[本の索引の作り方](http://www.chijinshokan.co.jp/Books/ISBN978-4-8052-0932-5.htm)』(地人書館) and [SIST 13　索引作成](https://jipsti.jst.go.jp/sist/handbook/sist13/sist13_m.htm).

## Usage

The basic concept is to embed index manipulation commands in the `command` query parameter of a URL stored in the `data-index` attribute. The URL's document path and fragment identify the element where the index is generated.

The command body is a YAML list with top-level brackets omitted. Token and escaping rules follow YAML conventions, plus URL query and HTML attribute character encoding. For example, to make `null` a heading word in a `Key`, write `["null",reading]`, then encode it for the query and attribute contexts.

| Format                       | Description                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `<heading>`                  | Adds a locator (page). Creates the index and heading specified by the URL and `<heading>` if they do not exist.                        |
| `page!,<heading>`            | Adds a high-importance locator (page). Creates the index and heading specified by the URL and `<heading>` if they do not exist.        |
| `range,<heading>,<endReference>`  | Adds a locator (range) ending at the element identified by `<endReference>`.                                                      |
| `range!,<heading>,<endReference>` | Adds a high-importance locator (range) ending at the element identified by `<endReference>`.                                      |
| `see,<heading>,<target>`     | Adds a "see" reference. Creates the index and heading specified by the URL and `<heading>`, but `<target>` is not automatically created. |
| `seeAlso,<heading>,<target>` | Adds a "see also" reference. Creates the index and heading specified by the URL and `<heading>`, but `<target>` is not automatically created. |

Furthermore, `<heading>` and `<target>` follow the format `[Key, Key] | [Key, Key, Key]` where `type Key = [string, string]`. The basic form of `Key` is a tuple consisting of the heading's innerHTML and reading for sorting. The innerHTML is parsed and stored as the JSON representation of `hast.Element.children: hast.ElementContent[]`. Keys match only when both their HTML representation and reading match. Taking two `Key`s corresponds to group heading and main heading, while taking three `Key`s corresponds to group heading, main heading, and subheading.

`<endReference>` has the form `[<documentPath>]#<elementId>` and is resolved relative to the document containing the range command. Omit `<documentPath>` for an end element in the same document. A fragment-only reference must be quoted as a YAML string, and because the reference is part of the `command` query parameter, its `#` must be URL-encoded. For example, `'#end'` is written as `'%23end'` in `data-index`. The end element must exist and strictly follow the element containing the range command in entry and document order. Otherwise, the range command is ignored with a warning.
