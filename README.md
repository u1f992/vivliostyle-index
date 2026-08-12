# @u1f992/vivliostyle-index

[unified](https://github.com/unifiedjs/unified) plugin that integrates automatic index generation into [Vivliostyle CLI](https://github.com/vivliostyle/vivliostyle-cli) workflows.

This project seeks to align with the requirements presented in 藤田節子's『[本の索引の作り方](http://www.chijinshokan.co.jp/Books/ISBN978-4-8052-0932-5.htm)』(地人書館) and [SIST 13　索引作成](https://jipsti.jst.go.jp/sist/handbook/sist13/sist13_m.htm).

## Usage

The basic concept is to embed index manipulation commands in the `data-index` attribute using the format `func,args...`.

The command body is a YAML list with top-level brackets omitted. Token and escaping rules follow YAML conventions, plus HTML attribute character encoding. For example, to make `null` a heading word in a `Key`, write `["null",reading]`, which becomes `[&quot;null&quot;,reading]`.

| Format                            | Description                                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(page,)<id>,<heading>`           | Adds a locator (page). Creates the index and heading specified by `<id>` and `<heading>` if they don't exist (`(page,)` must always be omitted).                                |
| `page!,<id>,<heading>`            | Adds a high-importance locator (page). Creates the index and heading specified by `<id>` and `<heading>` if they don't exist.                                                   |
| `range,<id>,<heading>,<rangeId>`  | Starts a locator (range). Not added to the index until properly closed.                                                                                                         |
| `range!,<id>,<heading>,<rangeId>` | Starts a high-importance locator (range). Not added to the index until properly closed.                                                                                         |
| `/range,<rangeId>`                | Closes the corresponding locator (range) and adds it to the index. Creates the index and heading specified by `<id>` and `<heading>` from `range`/`range!` if they don't exist. |
| `see,<id>,<heading>,<target>`     | Adds a "see" reference. Creates the index and heading specified by `<id>` and `<heading>` if they don't exist, but `<target>` is not automatically created.                     |
| `seeAlso,<id>,<heading>,<target>` | Adds a "see also" reference. Creates the index and heading specified by `<id>` and `<heading>` if they don't exist, but `<target>` is not automatically created.                |
| `expand,<id>`                     | Expands the index specified by `<id>` as a child of this element.                                                                                                               |

Furthermore, `<heading>` and `<target>` follow the format `[Key, Key] | [Key, Key, Key]` where `type Key = [string, string]`. The basic form of `Key` is a tuple consisting of the heading's innerHTML and reading for sorting. The innerHTML is parsed and stored as the JSON representation of `hast.Element.children: hast.ElementContent[]`. Keys match only when both their HTML representation and reading match. Taking two `Key`s corresponds to group heading and main heading, while taking three `Key`s corresponds to group heading, main heading, and subheading.
