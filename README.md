# @u1f992/vivliostyle-index

A [unified](https://github.com/unifiedjs/unified) plugin for generating indexes in [Vivliostyle CLI](https://github.com/vivliostyle/vivliostyle-cli) builds.

The project uses [本の索引の作り方](http://www.chijinshokan.co.jp/Books/ISBN978-4-8052-0932-5.htm) by 藤田節子 (Chijin Shokan) and [SIST 13 索引作成](https://jipsti.jst.go.jp/sist/handbook/sist13/sist13_m.htm) as references for its indexing rules.

## Usage

The instruction syntax is MakeIndex/upmendex-inspired. Put an instruction in the `q` query parameter of the URL in a `data-index` attribute. The URL path and fragment identify the element that receives the generated index. That element must carry the DPUB-ARIA role `doc-index` among the tokens of its `role` attribute, so that the published document exposes the index as a navigation landmark. The HTML parser decodes the attribute before the URL parser reads `q`. Percent-encode any instruction character that URL query parsing would otherwise alter or treat as syntax. This includes literal `#`, `&`, `+`, and `%`, written as `%23`, `%26`, `%2B`, and `%25`, respectively. Characters preserved by query parsing can remain unencoded; the examples use this minimal form. Finally, escape the resulting URL for use in an HTML attribute.

| Format | Description |
| --- | --- |
| `<entry>` | Adds a page locator. Creates the target index and entry if needed. |
| `<entry>\|\|<template>` | Adds a page locator wrapped in `<template>`. |
| `<entry>\|(<endReference>` | Adds a range locator that ends at `<endReference>`. |
| `<entry>\|(<endReference>\|<template>` | Adds a range locator wrapped in `<template>`. |
| `<entry>\|-><target>` | Adds a preferred cross-reference ("see"). Creates `<entry>` but not `<target>`. |
| `<entry>\|=><target>` | Adds a related cross-reference ("see also"). Creates `<entry>` but not `<target>`. |

`<entry>` and `<target>` contain two or three keys: `<key>!<key>` or `<key>!<key>!<key>`. The keys specify the group heading, the entry heading, and an optional subentry heading in that order. A `<key>` has the form `<reading>@<innerHTML>`. If `@<innerHTML>` is omitted, the reading is also used as the inner HTML. `\@`, `\!`, `\|`, and `\\` represent literal `@`, `!`, `|`, and `\`. Keys match only if they have the same reading and original `<innerHTML>` string.

`<endReference>` has the form `[<documentPath>]#<elementId>` and is resolved relative to the document containing the range instruction. Omit `<documentPath>` when the end element is in the same document. Because the reference is inside the `q` value, encode its `#` as `%23`. It ends at the first unescaped `|`, so write a literal `|` as `\|`. Any query in `<endReference>` is discarded after URL resolution. The end element must exist and come after the start element in both entry order and document order.

`<template>` is an HTML fragment containing exactly one `<slot>` element. The generated locator takes the place of that element, and the rest of the fragment surrounds it. A range locator replaces the slot with its start anchor, its separator, and its end anchor together. Use a template where the locator needs markup a stylesheet cannot supply, such as `<strong><slot></slot></strong>` for an important page. A template runs to the end of the instruction, so an unescaped `|` inside it is a literal `|`. Write a literal `\` as `\\` there and inside `<endReference>`; `@` and `!` carry no meaning outside a key and need no escape. The fragment is parsed on its own rather than in the context of the list item that will hold it, so markup a list item would not otherwise accept, such as a `<td>`, is kept. A `<slot>` the parser cannot keep where it is written, such as one inside a `<table>`, is moved out of that element, and the locator lands beside the element instead of inside it. Slots inside a `<template>`, `<script>`, or `<style>` element, or inside an attribute value, do not count toward the one the fragment must contain.

An instruction the plugin cannot read is rejected with a warning and contributes nothing: one whose syntax is invalid, and one whose `<endReference>` does not resolve to a document and an element. An accepted instruction can still be revoked later, again with a warning. A range is revoked when its end element is missing or does not follow its start; a cross-reference is revoked when its target is absent from the index. An entry left with no locator, cross-reference, or subentry is revoked as well, and that in turn can revoke cross-references that pointed at it.

An index exists once an instruction naming its target is accepted, and its target element is replaced even when every entry is later revoked. A target element whose `role` attribute lacks the `doc-index` token is reported with a warning and keeps its original contents. A target named only by rejected instructions, or by no instruction at all, keeps its original contents without a role check.

## Generated markup

An index replaces the contents of its target element with its groups, preceded by a preamble when one is rendered for that target. Every element of the output comes from a renderer. A target without a configured renderer uses the default renderer throughout; its shape below stays fixed, so a stylesheet addresses the index through it. By default the target also carries the whole index as JSON in a `data-index-result` attribute.

The shape follows the index structure of the DAISY Accessible Publishing Knowledge Base, [Indexes](https://kb.daisy.org/publishing/docs/html/indexes.html): a target exposed through the DPUB-ARIA [`doc-index`](https://www.w3.org/TR/dpub-aria/#doc-index) role, a section per group holding its heading, and unordered lists of entries. It extends that form where the knowledge base leaves practical needs unaddressed. The `group-list` element wraps the sections so that a stylesheet can lay the groups out in columns while the preamble spans them. The headings come from a configurable renderer because no fixed heading level suits every document outline; the knowledge base's `h2` presupposes its `h1` inside the `nav`. Subentries and cross-references, which the knowledge base's examples do not reach, take their structure from [EPUB Indexes 1.0](https://idpf.org/epub/idx/). The locators form an `ol` where the knowledge base writes inline links, because a generated locator holds no text until pagination and its order would otherwise be carried nowhere.

```
target
├── preamble                the nodes its renderer returns
└── div                     group-list
    └── section             group
        ├── span            group heading
        └── ul              entry-list
            └── li          entry, carrying the ID its cross-references link to
                ├── span    entry heading
                ├── ol      locator-list
                ├── ul      xref-preferred ("see")
                ├── ul      xref-related ("see also")
                └── ul      subentry-list
                    └── li  subentry, carrying the ID its cross-references link to
                        ├── span   subentry heading
                        ├── ol     locator-list
                        ├── ul     xref-preferred ("see")
                        └── ul     xref-related ("see also")
```

Each element the default renderer generates below the preamble names its part in a `data-index-role` attribute: `group-list` on the element holding every group, `group` on each group section, and `entry-list`, `locator-list`, `xref-preferred`, `xref-related`, and `subentry-list` on the lists. The names follow the terms of the [EPUB Structural Semantics Vocabulary](https://www.w3.org/TR/epub-ssv-11/#indexes) with the `index-` prefix dropped. `group-list` and `subentry-list` extend that vocabulary: it has no term for an element holding every group, and it labels the list of subentries `index-entry-list` without distinguishing it from the list of main entries, so `subentry-list` is the finer term. The locator list is an `ol`: locators run in publication order, and until pagination fills the anchors that order is carried nowhere else. Every other list is a `ul`, whose order can be reproduced from its contents and the configured comparators.

A preamble is the node sequence its renderer returns, rendered whenever its target is replaced, including when the index holds no group; without one, the group list is the target's only child. The lists under a heading are always present and always in this order, four under an entry and, without the nested subentry list, three under a subentry; an empty one holds no items. The group list is the exception and disappears when the index holds no group. A heading is a `span` holding the parsed key HTML. A locator item holds one link, or a start link, an empty `<span>`, and an end link for a range; a template wraps those nodes without reordering them. A locator link points at the built document, so the source extension becomes `.html` unless it already is `.html`, `.htm`, or `.xhtml`. A cross-reference item holds one link whose contents are the target heading, or the target entry heading, an empty `<span>`, and the target subentry heading when the cross-reference points at a subentry.

A renderer configured for a target replaces any part of this shape. Its factory runs once per index with `h` from [hastscript](https://github.com/syntax-tree/hastscript) and the sorted index, and returns a tree of closures mirroring the output. `group`, `entry`, and `subentry` receive their model node, read-only and accompanied by the generated ID for an entry or subentry, and return the renderers for their subtree. A `*List` field renders a list container from its rendered items, each paired with its model node; `groupList` runs even when the index holds no group. `heading` renders from the parsed key HTML. `locatorAnchors` and `xrefAnchor` render the link nodes, and the template of the instruction is then applied to them; `locator` and `xref` render an item from those anchor nodes and the template-applied nodes. `self` renders the element itself from its rendered parts. Every field is optional, and an omitted field or an empty object keeps the default form for that part. To share one function between entries and subentries, bind it to a local constant and pass it in both places.

Wrapping the returned tree in the `indexRenderer` function links the types of every level: the element types a renderer returns flow into the parts of the renderers that consume them, and an omitted renderer contributes its default, so a consumer under untouched defaults sees `a`, `span`, `ol`, `ul`, `li`, `section`, and `div` elements rather than arbitrary nodes. A plain object behaves the same at runtime and leaves every hook typed against plain node lists. The literal tag types come from omitted defaults only: hastscript's `h` returns an element whose `tagName` is a plain `string`, so a hook you provide contributes `hast.Element` to its consumers unless you assert a narrower type yourself.

The parts an entry, subentry, or target-level `self` renderer receives include `props`, the properties the element must carry, typed with what the plugin guarantees to put in them; a group carries no such properties, so its `self` receives none. For an entry or subentry the guarantee is the ID its cross-references link to. The target-level `self` receives the target's attributes with `data-index-result` added and returns the final properties together with the children, so the renderer decides what the target ends up carrying.
