import assert from "node:assert";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { BrowserPlatform, detectBrowserPlatform } from "@puppeteer/browsers";
import { DEFAULT_BROWSER_VERSIONS } from "@vivliostyle/cli/constants";
import { Document } from "mupdf";
import puppeteer, {
  type Browser as PuppeteerBrowser,
  type HTTPRequest,
  type Page,
} from "puppeteer-core";

import { runCommand, startCommand, type RunningCommand } from "./process.ts";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, "../..");
const fixtureDirectory = path.join(testDirectory, "fixtures", "basic");
const temporaryRoot = path.join(projectRoot, ".tmp");
const browserCacheDirectory = path.join(temporaryRoot, "vivliostyle-browsers");
const browserInstaller = fileURLToPath(new URL("install-browser.ts", import.meta.url));
const vivliostyle = fileURLToPath(import.meta.resolve("@vivliostyle/cli/cli"));
const commandEnvironment = { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" };
let browserInstallation: Promise<string> | undefined;

type PreviewEvent = Readonly<{
  kind: "request" | "reload";
  value: string;
  sequence: number;
}>;

async function createPublication(): Promise<string> {
  await fs.mkdir(temporaryRoot, { recursive: true });
  const publication = await fs.mkdtemp(path.join(temporaryRoot, "vivliostyle-"));
  await fs.cp(fixtureDirectory, publication, { recursive: true });
  return publication;
}

async function removePublication(publication: string): Promise<void> {
  await fs.rm(publication, { recursive: true, force: true });
}

async function installBrowser(signal: AbortSignal): Promise<string> {
  const platform = detectBrowserPlatform();
  if (!platform) {
    throw new Error(`unsupported browser platform: ${process.platform} ${process.arch}`);
  }
  if (platform === BrowserPlatform.LINUX_ARM) {
    return resolveLinuxArmChromium();
  }
  const result = await runCommand(
    process.execPath,
    [browserInstaller, browserCacheDirectory, DEFAULT_BROWSER_VERSIONS.chrome[platform], platform],
    { cwd: testDirectory, env: commandEnvironment, signal, timeout: 300_000 },
  );
  const executable = result.stdout.trim();
  await fs.access(executable, fsConstants.X_OK);
  return executable;
}

async function resolveLinuxArmChromium(): Promise<string> {
  const configured = process.env.VIVLIOSTYLE_E2E_BROWSER;
  const pathCandidates = (process.env.PATH?.split(path.delimiter) ?? []).flatMap((directory) => [
    path.join(directory, "chromium"),
    path.join(directory, "chromium-browser"),
  ]);
  const candidates = configured ? [configured, ...pathCandidates] : pathCandidates;
  const errors: unknown[] = [];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate, fsConstants.X_OK);
      return candidate;
    } catch (error) {
      errors.push(error);
    }
  }
  throw new AggregateError(errors, "could not find an executable Chromium for Linux ARM64");
}

function browserExecutablePath(signal: AbortSignal): Promise<string> {
  return (browserInstallation ??= installBrowser(signal));
}

function extractPdfText(bytes: Uint8Array): string {
  const document = Document.openDocument(bytes, "application/pdf");
  try {
    const pages: string[] = [];
    for (let index = 0; index < document.countPages(); index += 1) {
      const page = document.loadPage(index);
      try {
        const text = page.toStructuredText();
        try {
          pages.push(text.asText());
        } finally {
          text.destroy();
        }
      } finally {
        page.destroy();
      }
    }
    return pages.join("\n");
  } finally {
    document.destroy();
  }
}

async function waitFor<T>(
  read: () => T | Promise<T>,
  accept: (value: T) => boolean,
  timeout: number,
  describe: string,
): Promise<T> {
  const deadline = Date.now() + timeout;
  let value = await read();
  while (!accept(value)) {
    if (Date.now() >= deadline) {
      throw new Error(`timed out waiting for ${describe}: ${String(value)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    value = await read();
  }
  return value;
}

async function viewerText(page: Page): Promise<string> {
  const texts = await Promise.all(
    page.frames().map(async (frame) => {
      try {
        return await frame.evaluate(() => document.body?.textContent ?? "");
      } catch {
        return "";
      }
    }),
  );
  return texts.join("\n");
}

function requestPath(request: HTTPRequest): string | undefined {
  try {
    return new URL(request.url()).pathname;
  } catch {
    return undefined;
  }
}

function fullReloadPath(payload: string): string | undefined {
  try {
    const message: unknown = JSON.parse(payload);
    if (
      typeof message === "object" &&
      message !== null &&
      "type" in message &&
      message.type === "full-reload" &&
      "path" in message &&
      typeof message.path === "string"
    ) {
      return message.path;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function closePreview(
  publication: string,
  preview: RunningCommand | undefined,
  browser: PuppeteerBrowser | undefined,
) {
  const closeResults = await Promise.allSettled([browser?.close(), preview?.stop()]);
  const removeResult = await Promise.allSettled([removePublication(publication)]);
  const errors = [...closeResults, ...removeResult].flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  );
  if (errors.length > 0) {
    throw new AggregateError(errors, "failed to close preview resources");
  }
}

void test("builds inspectable web publication and PDF outputs", { timeout: 480_000 }, async (t) => {
  const publication = await createPublication();
  t.after(() => removePublication(publication));
  const browserPath = await browserExecutablePath(t.signal);
  const webPublication = path.join(publication, "output");
  const pdf = path.join(publication, "output.pdf");

  await runCommand(
    process.execPath,
    [
      vivliostyle,
      "build",
      "--config",
      "vivliostyle.config.ts",
      "--output",
      webPublication,
      "--format",
      "webpub",
      "--output",
      pdf,
      "--format",
      "pdf",
      "--executable-browser",
      browserPath,
    ],
    { cwd: publication, env: commandEnvironment, signal: t.signal, timeout: 150_000 },
  );

  const indexHtml = await fs.readFile(path.join(webPublication, "index.html"), "utf8");
  const pdfBytes = await fs.readFile(pdf);
  assert.match(indexHtml, />Apple</v);
  assert.match(indexHtml, /href="chapter\.html#apple"/v);
  assert.strictEqual(pdfBytes.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdfBytes.byteLength > 1_000);
  assert.match(extractPdfText(pdfBytes), /Apple/v);
});

void test(
  "reloads the Viewer after an affected index target is touched",
  { timeout: 480_000 },
  async (t) => {
    const publication = await createPublication();
    let preview: RunningCommand | undefined;
    let browser: PuppeteerBrowser | undefined;
    t.after(async () => {
      await closePreview(publication, preview, browser);
    });
    const chapterPath = path.join(publication, "chapter.md");
    const indexPath = path.join(publication, "index.md");
    const originalIndex = await fs.readFile(indexPath, "utf8");
    const oldTime = new Date("2000-01-01T00:00:00.000Z");
    await fs.utimes(indexPath, oldTime, oldTime);

    preview = startCommand(
      process.execPath,
      [
        vivliostyle,
        "preview",
        "--config",
        "vivliostyle.config.ts",
        "--no-open-viewer",
        "--host",
        "127.0.0.1",
        "--port",
        "0",
      ],
      { cwd: publication, env: commandEnvironment, signal: t.signal },
    );
    const ready = await preview.waitForOutput(/Preview URL:\s+(https?:\/\/\S+)/v, 30_000);
    const previewUrl = ready[1];
    assert.ok(previewUrl);

    browser = await puppeteer.launch({
      executablePath: await browserExecutablePath(t.signal),
      headless: true,
      args: ["--no-sandbox", "--disable-web-security"],
    });
    const page = await browser.newPage();
    const session = await page.createCDPSession();
    const events: PreviewEvent[] = [];
    let sequence = 0;

    page.on("request", (request) => {
      const pathname = requestPath(request);
      if (pathname === "/vivliostyle/chapter.html" || pathname === "/vivliostyle/index.html") {
        events.push({ kind: "request", value: pathname, sequence: sequence++ });
      }
    });
    await session.send("Network.enable");
    session.on("Network.webSocketFrameReceived", ({ response }) => {
      const reloadPath = fullReloadPath(response.payloadData);
      if (reloadPath !== undefined) {
        events.push({ kind: "reload", value: reloadPath, sequence: sequence++ });
      }
    });

    await page.goto(previewUrl, { waitUntil: "domcontentloaded" });
    await waitFor(
      () => viewerText(page),
      (text) => text.includes("Source marker"),
      60_000,
      "the initial publication in the Viewer",
    );
    await waitFor(
      () => viewerText(page),
      (text) => text.includes("Apple"),
      60_000,
      "the initial index in the Viewer",
    );
    const initialRequestCount = events.filter(
      ({ kind, value }) => kind === "request" && value === "/vivliostyle/index.html",
    ).length;
    const initialIndexMtime = (await fs.stat(indexPath)).mtimeMs;
    const changeSequence = sequence;

    await fs.writeFile(
      chapterPath,
      '# Chapter\n\n<span id="banana" data-index="index.md?q=b!Banana#index">Source marker</span>\n',
    );

    const sourceReload = await waitFor(
      () =>
        events.find(
          ({ kind, value, sequence: eventSequence }) =>
            kind === "reload" && value.endsWith("/chapter.html") && eventSequence >= changeSequence,
        ),
      (event) => event !== undefined,
      60_000,
      "a source-entry full-reload message",
    );
    assert.ok(sourceReload);
    await waitFor(
      () => fs.stat(indexPath),
      (stat) => stat.mtimeMs > initialIndexMtime,
      60_000,
      "the affected index target to be touched",
    );
    const targetReload = await waitFor(
      () =>
        events.find(
          ({ kind, value, sequence: eventSequence }) =>
            kind === "reload" &&
            value.endsWith("/index.html") &&
            eventSequence > sourceReload.sequence,
        ),
      (event) => event !== undefined,
      60_000,
      "an index-target full-reload message",
    );
    assert.ok(targetReload);
    await waitFor(
      () =>
        events.filter(
          ({ kind, value, sequence: eventSequence }) =>
            kind === "request" &&
            value === "/vivliostyle/index.html" &&
            eventSequence > targetReload.sequence,
        ).length,
      (count) => count > 0,
      60_000,
      "the Viewer to request the index after its full-reload message",
    );
    await waitFor(
      () => viewerText(page),
      (text) => text.includes("Source marker"),
      60_000,
      "the reloaded publication in the Viewer",
    );
    const updatedText = await waitFor(
      () => viewerText(page),
      (text) => text.includes("Banana") && !text.includes("Apple"),
      60_000,
      "the updated index in the Viewer",
    );

    assert.ok(initialRequestCount > 0);
    assert.match(updatedText, /Banana/v);
    assert.strictEqual(await fs.readFile(indexPath, "utf8"), originalIndex);
  },
);
