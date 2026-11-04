// Renders the Apple Wallet pass images into public/pass (run once; output is committed).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const out = new URL("../public/pass/", import.meta.url).pathname;
const icon = (s) => `<div style="width:${s}px;height:${s}px;background:#F7F5F1;display:grid;place-items:center">
  <div style="width:${s * 0.62}px;height:${s * 0.62}px;border-radius:50%;background:#8A9A82"></div></div>`;
const logo = (s) => `<div style="width:${50 * s}px;height:${50 * s}px;display:grid;place-items:center">
  <div style="width:${26 * s}px;height:${26 * s}px;border-radius:50%;background:rgba(255,255,255,.7)"></div></div>`;

const browser = await chromium.launch();
const page = await browser.newPage();
const shots = [
  ["icon.png", icon(29)], ["icon@2x.png", icon(58)], ["icon@3x.png", icon(87)],
  ["logo.png", logo(1)], ["logo@2x.png", logo(2)], ["logo@3x.png", logo(3)],
];
for (const [name, html] of shots) {
  await page.setContent(`<body style="margin:0;background:transparent">${html}</body>`);
  await page.locator("body > div").screenshot({ path: out + name, omitBackground: true });
}
await browser.close();
console.log("pass images written");
