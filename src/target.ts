import { documentPath } from "./platform.ts";

export type Target = Readonly<{
  path: string;
  fragment: string;
}>;

export type TargetKey = string;

export function createTarget(url: URL): Target {
  const strippedUrl = new URL(url);
  strippedUrl.search = "";
  strippedUrl.hash = "";
  return {
    path: documentPath(strippedUrl),
    fragment: decodeURIComponent(url.hash.slice(1)),
  };
}

export function resolveTarget(reference: string, baseUrl: URL): Target {
  return createTarget(new URL(reference, baseUrl));
}

export function createTargetKey(target: Target): TargetKey {
  return JSON.stringify([target.path, target.fragment]);
}
