import type * as hast from "hast";
import { fromHtml } from "hast-util-from-html";
import { toText } from "hast-util-to-text";

export function parseFragment(html: string): hast.ElementContent[] {
  return fromHtml(html, { fragment: true }).children.filter(
    (child): child is hast.ElementContent => child.type !== "doctype",
  );
}

export function fragmentToText(html: string) {
  return toText(fromHtml(html, { fragment: true }));
}
