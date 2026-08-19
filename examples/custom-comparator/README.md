# Custom comparator

This example selects a custom index profile that places the `記号` group before every other group.
The remaining groups, and every other index collection, retain locale-aware comparison.
Because the index target has `lang="ja"`, its unlisted groups are ordered using Japanese comparison.

```shell
npm run preview --workspace custom-comparator-example
```
