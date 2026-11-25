import { chromium } from 'playwright';
import fs from 'node:fs/promises';
// Short visual review only: screenshots and state checks, no FPS sampling.
await fs.mkdir('docs/v3/character-runtime', { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], shots = [];
page.on('pageerror', error => errors.push(error.message));
const capture = async name => {
  await page.screenshot({ path: `docs/v3/character-runtime/${name}.png` });
  shots.push({ name, state: await page.evaluate(() => {
    const s = window.__JINSHA_V2__.snapshot();
    return { mode: s.mode, position: s.position, motion: s.motion, camera: s.camera, immersion: s.immersion };
  }) });
};
try {
  await page.goto('http://127.0.0.1:5186');
  await page.waitForFunction(() => window.__JINSHA_V2__?.snapshot().motion, null, { timeout: 120000 });
  await page.locator('#start-btn').click(); await page.waitForTimeout(3600);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(900); await capture('walk'); await page.keyboard.up('KeyW');
  await page.keyboard.down('Space'); await page.waitForTimeout(1700); await capture('flight'); await page.keyboard.up('Space');
  await page.keyboard.down('KeyW'); await page.waitForTimeout(800); await capture('glide'); await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyC');
  await page.waitForFunction(() => window.__JINSHA_V2__.snapshot().motion.mode === 'grounded', null, { timeout: 15000 });
  await page.keyboard.up('KeyC'); await page.waitForTimeout(500); await capture('land');
  const navigation = await page.evaluate(() => { const s = window.__JINSHA_V2__.snapshot(); return { perches: s.perches, places: s.places }; });
  const pool = navigation.places.find(place => place.type === 'water');
  if (pool) {
    await page.evaluate(p => window.__JINSHA_V2__.goPoint([p[0], -.62, p[2]]), pool.position);
    await page.waitForTimeout(700); await page.keyboard.down('KeyW'); await page.waitForTimeout(600); await capture('swim'); await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyC'); await page.waitForTimeout(1700); await capture('dive'); await page.keyboard.up('KeyC');
  }
  if (navigation.perches.length) {
    await page.evaluate(p => window.__JINSHA_V2__.goPoint(p), navigation.perches[0].position);
    await page.waitForTimeout(800); await capture('perch');
  }
  const report = { method: 'Real main scene, short keyboard-driven visual samples. Water/perch locations use DEV goPoint; no traversal or performance claim for these teleports.', errors, shots };
  await fs.writeFile('docs/v3/character-runtime/review.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
