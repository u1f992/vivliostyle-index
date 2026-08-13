import { fileURLToPath } from "node:url";

import upath from "upath";

export type Target = Readonly<{
  documentPath: string;
  elementId: string;
}>;

export type TargetKey = string;

export function createTarget(url: URL): Target {
  const documentUrl = new URL(url);
  documentUrl.search = "";
  documentUrl.hash = "";
  return {
    documentPath: upath.normalize(fileURLToPath(documentUrl)),
    elementId: decodeURIComponent(url.hash.slice(1)),
  };
}

export function resolveTarget(reference: string, baseUrl: URL): Target {
  return createTarget(new URL(reference, baseUrl));
}

export function createTargetKey(target: Target): TargetKey {
  return JSON.stringify([target.documentPath, target.elementId]);
}
