import upath from "upath";

const htmlExtensions = new Set([".html", ".htm", ".xhtml"]);

function encodeRelativePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function toHtmlPath(path: string): string {
  return htmlExtensions.has(upath.extname(path).toLowerCase())
    ? path
    : upath.changeExt(path, ".html");
}

export function createLocationHref(sourcePath: string, targetPath: string, id: string): string {
  const relativePath =
    sourcePath === targetPath
      ? ""
      : encodeRelativePath(upath.relative(upath.dirname(targetPath), toHtmlPath(sourcePath)));
  return `${relativePath}#${encodeURIComponent(id)}`;
}
