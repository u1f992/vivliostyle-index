# @u1f992/vivliostyle-index

A [unified](https://github.com/unifiedjs/unified) plugin for generating indexes in [Vivliostyle CLI](https://github.com/vivliostyle/vivliostyle-cli) builds.

The project uses [本の索引の作り方](http://www.chijinshokan.co.jp/Books/ISBN978-4-8052-0932-5.htm) by 藤田節子 (Chijin Shokan) and [SIST 13 索引作成](https://jipsti.jst.go.jp/sist/handbook/sist13/sist13_m.htm) as references for its indexing rules.

## Usage

The instruction syntax is MakeIndex/upmendex-inspired. Put an instruction in the `q` query parameter of the URL in a `data-index` attribute. The URL path and fragment identify the element that receives the generated index. The HTML parser decodes the attribute before the URL parser reads `q`. Percent-encode any instruction character that URL query parsing would otherwise alter or treat as syntax. This includes literal `#`, `&`, `+`, and `%`, written as `%23`, `%26`, `%2B`, and `%25`, respectively. Characters preserved by query parsing can remain unencoded; the examples use this minimal form. Finally, escape the resulting URL for use in an HTML attribute.

| Format | Description |
| --- | --- |
| `<entry>` | Adds a page locator. Creates the target index and entry if needed. |
| `<entry>\|\|<template>` | Adds a page locator wrapped in `<template>`. |
| `<entry>\|(<endReference>` | Adds a range locator that ends at `<endReference>`. |
| `<entry>\|(<endReference>\|<template>` | Adds a range locator wrapped in `<template>`. |
| `<entry>\|-><target>` | Adds a "see" reference. Creates `<entry>` but not `<target>`. |
| `<entry>\|=><target>` | Adds a "see also" reference. Creates `<entry>` but not `<target>`. |

`<entry>` and `<target>` contain two or three keys: `<key>!<key>` or `<key>!<key>!<key>`. The keys specify the group heading, main heading, and optional subheading in that order. A `<key>` has the form `<reading>@<innerHTML>`. If `@<innerHTML>` is omitted, the reading is also used as the inner HTML. `\@`, `\!`, `\|`, and `\\` represent literal `@`, `!`, `|`, and `\`. Keys match only if they have the same reading and original `<innerHTML>` string.

`<endReference>` has the form `[<documentPath>]#<elementId>` and is resolved relative to the document containing the range instruction. Omit `<documentPath>` when the end element is in the same document. Because the reference is inside the `q` value, encode its `#` as `%23`. It ends at the first unescaped `|`, so write a literal `|` as `\|`. Any query in `<endReference>` is discarded after URL resolution. The end element must exist and come after the start element in both entry order and document order.

`<template>` is an HTML fragment containing exactly one `<slot>` element. The generated locator takes the place of that element, and the rest of the fragment surrounds it. A range locator replaces the slot with its start anchor, its separator, and its end anchor together. Use a template where the locator needs markup a stylesheet cannot supply, such as `<strong><slot></slot></strong>` for an important page. A template runs to the end of the instruction, so an unescaped `|` inside it is a literal `|`. Write a literal `\` as `\\` there and inside `<endReference>`; `@` and `!` carry no meaning outside a key and need no escape. The fragment is parsed on its own rather than in the context of the list item that will hold it, so markup a list item would not otherwise accept, such as a `<td>`, is kept. A `<slot>` the parser cannot keep where it is written, such as one inside a `<table>`, is moved out of that element, and the locator lands beside the element instead of inside it. Slots inside a `<template>`, `<script>`, or `<style>` element, or inside an attribute value, do not count toward the one the fragment must contain.

An instruction the plugin cannot read is rejected with a warning and contributes nothing: one whose syntax is invalid, and one whose `<endReference>` does not resolve to a document and an element. An accepted instruction can still be revoked later, again with a warning. A range is revoked when its end element is missing or does not follow its start; a "see" or "see also" reference is revoked when its target is absent from the index. An entry left with no locator, reference, or subentry is revoked as well, and that in turn can revoke references that pointed at it.

An index exists once an instruction naming its target is accepted, and its target element is replaced even when every entry is later revoked. A target named only by rejected instructions, or by no instruction at all, keeps its original contents.
