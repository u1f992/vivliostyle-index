import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import upath from "upath";

export function documentUrl(documentPath: string): URL {
  return pathToFileURL(documentPath);
}

export function documentPath(url: URL): string {
  return upath.normalize(fileURLToPath(url));
}

export function workingDirectory(): string {
  return process.cwd();
}
