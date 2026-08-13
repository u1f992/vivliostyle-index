import upath from "upath";

function encodeRelativePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function createLocationHref(sourcePath: string, targetPath: string, id: string): string {
  const relativePath =
    sourcePath === targetPath
      ? ""
      : encodeRelativePath(
          upath.relative(upath.dirname(targetPath), upath.changeExt(sourcePath, ".html")),
        );
  return `${relativePath}#${encodeURIComponent(id)}`;
}
