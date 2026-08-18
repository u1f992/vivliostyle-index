# @u1f992/vivliostyle-index

A [unified](https://github.com/unifiedjs/unified) plugin for generating indexes in [Vivliostyle CLI](https://github.com/vivliostyle/vivliostyle-cli) builds.

The indexing rules are based on Fujita (2019) and the Japan Science and Technology Agency (n.d.).

The default output follows and extends the index structure specified by the DAISY Consortium (n.d.). Its `data-index-role` vocabulary similarly draws on and extends the index terms defined by the EPUB 3 Structural Semantics Vocabulary 1.1 (Herman and Garrish 2026). The index is identified with the DPUB-ARIA `doc-index` role (Garrish and Siegman 2025).

## References

- DAISY Consortium. n.d. “[Indexes](https://kb.daisy.org/publishing/docs/html/indexes.html).” *Accessible Publishing Knowledge Base*. Accessed August 18, 2026. Revision history: [publishing/docs/html/indexes.html](https://github.com/DAISY/kb/commits/main/publishing/docs/html/indexes.html).
- Fujita, Setsuko. 2019. *[本の索引の作り方](http://www.chijinshokan.co.jp/Books/ISBN978-4-8052-0932-5.htm)*. 地人書館.
- Garrish, Matt, and Tzviya Siegman, eds. 2025. “[`doc-index`](https://www.w3.org/TR/dpub-aria-1.1/#doc-index).” *Digital Publishing WAI-ARIA Module 1.1*. W3C Recommendation, June 12, 2025. World Wide Web Consortium. Revision history: [dpub-aria/index.html](https://github.com/w3c/aria/commits/main/dpub-aria/index.html).
- Herman, Ivan, and Matt Garrish, eds. 2026. “[Indexes](https://www.w3.org/TR/epub-ssv/#h_indexes).” *EPUB 3 Structural Semantics Vocabulary 1.1*. W3C Group Note, May 28, 2026. World Wide Web Consortium. Revision history: [wg-notes/ssv/index.html](https://github.com/w3c/epub-specs/commits/main/wg-notes/ssv/index.html).
- Japan Science and Technology Agency. n.d. “[SIST 13 索引作成](https://warp.ndl.go.jp/20220119/20220113214526id_/jipsti.jst.go.jp/sist/handbook/sist13/sist13_m.htm) [Indexes and Indexing].” Archived January 13, 2022, by the National Diet Library Web Archiving Project. Accessed August 18, 2026. <!-- Last known Wayback Machine snapshot of the SIST site: https://web.archive.org/web/20220302192615/jipsti.jst.go.jp/sist/index.html -->
