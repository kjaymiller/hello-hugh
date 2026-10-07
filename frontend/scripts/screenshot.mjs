// Visual smoke test for the mobile UI, driven with Playwright.
//
// Requires: `bun install` in frontend/ (playwright is a devDependency) and
// `npx playwright install chromium` once, plus the app stack running via
// `fnox exec -- docker compose up -d --build` from the repo root.
//
// Usage: node scripts/screenshot.mjs [output-dir] [base-url]

import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = process.argv[2] || "/tmp/hh-shots";
const BASE_URL = process.argv[3] || "http://localhost:3001";
execSync(`mkdir -p ${OUT}`);

const pw = execSync(
  `docker compose -f "${path.join(REPO_ROOT, "docker-compose.yml")}" exec app printenv HUGH_PASSWORD`
)
  .toString()
  .trim();

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, // iPhone 12/13/14-ish
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  geolocation: { latitude: 33.749, longitude: -84.388 },
  permissions: ["geolocation"],
});
const page = await context.newPage();
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));

// --- Timeline (public, no auth) ---
await page.goto(`${BASE_URL}/timeline.html`);
await page.waitForSelector(".checkin-card");
await page.evaluate(() => document.getElementById("feed").scrollTo(0, 0));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/timeline.png` });

// --- Check-in page: login screen ---
await page.goto(`${BASE_URL}/index.html`);
await page.waitForSelector("#login-screen");
await page.screenshot({ path: `${OUT}/checkin-login.png` });

// --- Login ---
await page.fill("#password", pw);
await page.click("#login-btn");
await page.waitForSelector("#checkin-screen:not([hidden])");
await page.screenshot({ path: `${OUT}/checkin-empty.png` });

// --- Capture location ---
await page.click("#capture-location-btn");
await page.waitForFunction(
  () => document.getElementById("location-status").textContent.includes("±")
);

// --- Pick a photo. Needs a real image file — pass one as an env var, or
// this falls back to a generated solid-color JPEG. ---
const photoPath = process.env.SCREENSHOT_PHOTO || `${OUT}/_fixture.jpg`;
if (!process.env.SCREENSHOT_PHOTO) {
  execSync(
    `sips -s format jpeg -z 1200 800 /System/Library/Desktop\\ Pictures/Solid\\ Colors/Yellow.png --out ${photoPath}`
  );
}
await page.setInputFiles("#photo", photoPath);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/checkin-ready.png` });

console.log("Console/page errors:", errors);
console.log("Screenshots written to", OUT);

await browser.close();
