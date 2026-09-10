import { chromium } from "playwright";
import { execSync } from "node:child_process";

const pw = execSync(
  `docker compose -f /Users/kjaymiller/projects/hello-hugh/docker-compose.yml exec app printenv HUGH_PASSWORD`
)
  .toString()
  .trim();

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  geolocation: { latitude: 33.7505, longitude: -84.388 }, // near "Office"
  permissions: ["geolocation"],
});
const page = await context.newPage();
page.on("pageerror", (err) => console.log("PAGE ERROR:", err));

await page.goto("http://localhost:3001/index.html");
await page.fill("#password", pw);
await page.click("#login-btn");
await page.waitForSelector("#checkin-screen:not([hidden])");

// Nearby chip should appear automatically after auto-capture.
await page.waitForSelector("#nearby-chips .chip", { timeout: 5000 });
const chipText = await page.textContent("#nearby-chips .chip");
console.log("Nearby chip found:", chipText);

await page.click("#nearby-chips .chip");
const isSelected = await page.evaluate(
  () => document.querySelector("#nearby-chips .chip").classList.contains("selected")
);
console.log("Chip selected after click:", isSelected);

// "Name this place" flow.
await page.click("#show-name-place-btn");
await page.fill("#new-location-name", "Playwright Test Spot 1789059761");
await page.click("#save-location-btn");
await page.waitForFunction(
  () =>
    [...document.querySelectorAll("#nearby-chips .chip")].some(
      (c) => c.textContent === "Playwright Test Spot 1789059761"
    ),
  { timeout: 5000 }
);
console.log("New nickname chip appeared after saving.");

await page.screenshot({ path: "/tmp/hh-nickname-ui.png" });

await browser.close();
