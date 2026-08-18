# Error highlighting

This example intentionally contains an unresolved cross-reference, an unmatched range start, and an unmatched range end.
The generated anchors carry `data-index-error` with the corresponding error identifier.

The stylesheet selects every generated error with `[data-index-error]`, emphasizes it in red, and displays the identifier after the link.

```shell
npm run preview --workspace error-highlighting-example
```
