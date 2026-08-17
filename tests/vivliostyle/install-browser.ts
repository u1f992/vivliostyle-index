import { Browser, BrowserPlatform, install } from "@puppeteer/browsers";

const [cacheDir, buildId, platformName] = process.argv.slice(2);

if (!cacheDir || !buildId || !platformName) {
  throw new Error("expected cache directory, build ID, and browser platform");
}

const platforms = Object.values(BrowserPlatform) as string[];
if (!platforms.includes(platformName)) {
  throw new Error(`unsupported browser platform: ${platformName}`);
}

const browser = await install({
  browser: Browser.CHROME,
  buildId,
  cacheDir,
  platform: platformName as BrowserPlatform,
});

process.stdout.write(browser.executablePath);
