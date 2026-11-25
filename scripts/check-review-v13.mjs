import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {createServer, preview} from 'vite';
import {chapterIds, saveKey} from '../src/v10/ledger.js';

const out = process.env.JINSHA_PROOF || 'docs/v13';
const external = process.env.JINSHA_ORIGIN;
const release = process.argv.includes('--release');
const scenarioFilter = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
await mkdir(out, {recursive: true});
const local = {host: '127.0.0.1', port: 0, open: false};
const server = external ? null : release
  ? await preview({logLevel: 'error', preview: local})
  : await createServer({logLevel: 'error', server: {...local, hmr: false}});
if (server && !release) await server.listen();
const origin = external || 'http://127.0.0.1:' + server.httpServer.address().port;
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = await chromium.launch({
  headless: true, executablePath: existsSync(edge) ? edge : undefined,
  args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling']
});
const result = {
  date: new Date().toISOString(), browser: browser.version(), source: external || (release ? 'dist' : 'Vite source'),
  setup: 'Prepared old saves are set before opening the title. Every subsequent action uses the visible game controls.',
  scenarios: []
};

async function scenario(name, count, mobile, play) {
  if (scenarioFilter && scenarioFilter !== name) return;
  const viewport = mobile ? {width: 390, height: 844} : {width: 1366, height: 820};
  const context = await browser.newContext({
    viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, reducedMotion: 'reduce'
  });
  if (count) await context.addInitScript(({key, ids}) => {
    if (window === window.top && !localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify({
        version: 1, completed: ids, started: true, ending: ids.length === 9,
        muted: true, quality: 'economy'
      }));
    }
  }, {key: saveKey, ids: chapterIds.slice(0, count)});
  const page = await context.newPage();
  page.setDefaultTimeout(32000);
  const run = {name, viewport, input: mobile ? 'touchscreen emulation' : 'keyboard and mouse', checks: [], images: [], errors: []};
  result.scenarios.push(run);
  page.on('pageerror', e => run.errors.push(e.message));
  const check = (label, evidence) => {run.checks.push({label, evidence}); console.log(name + ' · ' + label);};
  const press = loc => mobile ? loc.tap() : loc.click();
  const snap = () => page.evaluate(() => window.__JINSHA_SURVEY__.snapshot());
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
  const panel = page.locator('#review-panel');
  const child = page.frameLocator('iframe[name=chapter-review]');
  const action = (scope, id) => scope.locator('[data-action="' + id + '"]');
  const shot = async label => {
    const file = name + '-' + label + '.jpg';
    // Allow the browser's transient touch highlight to fade before capturing the UI.
    if (mobile) await page.waitForTimeout(350);
    await page.screenshot({path: join(out, file), type: 'jpeg', quality: 88});
    run.images.push(file);
  };
  async function open(id) {
    await press(page.locator('#review-' + id));
    await panel.waitFor({state: 'visible'});
  }
  async function select(id) {
    await press(panel.locator('[data-review-id="' + id + '"]'));
    await child.locator('#leave').waitFor({state: 'visible', timeout: 100000});
  }
  async function returned(expectedMode) {
    await page.locator('iframe[name=chapter-review]').waitFor({state: 'hidden'});
    await panel.waitFor({state: 'hidden'});
    await page.waitForFunction(mode => document.body.dataset.mode === mode, expectedMode);
  }
  try {
    // A bookmarked review address in its own tab should open the ordinary title.
    const entryUrl = count ? origin : new URL('/?review=jade-cut', origin).href;
    await page.goto(entryUrl, {waitUntil: 'domcontentloaded', timeout: 90000});
    await page.locator('#enter').waitFor();
    run.entryModule = await page.locator('script[type=module]').first().getAttribute('src');
    assert.equal(await page.locator('#cover-replay').count(), 0);
    assert.equal(await page.getByRole('button', {name: /回顾章节|章节回顾|重玩章节|章节重玩/}).count(), 0);
    const entryText = (await page.locator('#enter').innerText()).trim();
    assert.ok(entryText.startsWith(count ? '继续探索' : '开始探索'), entryText);
    check('首页通过开始探索或继续探索进入现场', entryText);
    if (!count) {
      assert.equal(await page.locator('iframe[name=chapter-review]').count(), 0);
      assert.equal((await snap()).mode, 'title');
      check('单独打开回顾地址仍从正常新档标题进入');
    }
    await press(page.locator('#enter'));
    if (!count) await press(page.getByRole('button', {name: '落到探方边'}));
    await page.waitForFunction(() => document.body.dataset.mode === 'travel', null, {timeout: 140000});
    await play({page, check, saved, snap, child, press, panel, action, open, select, shot, returned});
    assert.deepEqual(run.errors, []);
    run.passed = true;
  } catch (e) {
    run.passed = false;
    run.failure = String(e.stack);
    console.error(name + ' FAILED', e.message);
    try {run.lastScreen = (await page.locator('body').innerText({timeout: 2500})).slice(-1100);} catch {}
  } finally {
    await context.close();
  }
}

function samePlace(a, b) {
  assert.equal(a.site, b.site);
  assert.equal(a.motion.target, b.motion.target);
  assert.ok(Math.hypot(...a.motion.position.map((v, i) => v - b.motion.position[i])) < .08,
    'Player moved ' + JSON.stringify([a.motion.position, b.motion.position]));
}

try {
  await scenario('desktop', 4, false, async ({page, check, saved, snap, child, press, panel, action, open, select, shot, returned}) => {
    const start = await snap();
    await page.keyboard.press('l');
    await panel.waitFor();
    assert.deepEqual(await panel.locator('[data-review-id]:enabled').evaluateAll(nodes => nodes.map(n => n.dataset.reviewId)), chapterIds.slice(0, 4));
    const focusStayedInside = async () => panel.evaluate(node => node.contains(document.activeElement));
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    assert.ok(await focusStayedInside());
    const paused = await snap();
    await page.keyboard.down('w');
    try { await page.waitForTimeout(350); } finally { await page.keyboard.up('w'); }
    samePlace(paused, await snap());
    await shot('travel-library');
    await page.keyboard.press('Escape');
    await returned('travel');
    samePlace(start, await snap());
    check('旅行中 L 打开目录，Esc 回到原坐标和目的地', {site: start.site, position: start.motion.position});
    await open('travel');
    const chapterRequest = /[?&]review=jade-cut(?:&|$)/;
    let releaseRequest;
    const gate = new Promise(resolve => {releaseRequest = resolve;});
    await page.route(chapterRequest, async route => {
      await gate;
      try {await route.continue();} catch { /* The player may have already closed this frame. */ }
    });
    try {
      await press(panel.locator('[data-review-id="jade-cut"]'));
      await press(page.locator('#review-loading-back'));
      await panel.waitFor();
      assert.equal(await page.locator('iframe[name=chapter-review]').count(), 0);
    } finally {
      releaseRequest();
      await page.unroute(chapterRequest);
    }
    await press(panel.locator('#review-resume'));
    await returned('travel');
    samePlace(start, await snap());
    check('延迟章节载入时可取消并回到原位');
    if (!(await snap()).near) {
      await press(page.locator('#guide'));
      await page.keyboard.press('l');
      await panel.waitFor();
      const inTransit = await snap();
      await page.waitForTimeout(350);
      samePlace(inTransit, await snap());
      await page.keyboard.press('Escape');
      await returned('travel');
      await page.waitForFunction(() => window.__JINSHA_SURVEY__.snapshot().near, null, {timeout: 140000});
      check('循迹领航中可暂停选章，收起后继续抵达原目的地', {site: inTransit.site});
    }
    await press(page.locator('#interact'));
    await press(action(page, 'widen'));
    await press(action(page, 'gauge'));
    await press(action(page, 'shard-1'));
    await press(action(page, 'rotate-left'));
    const reading = await page.locator('.at-readout').innerText();
    assert.match(reading, /器腹/);
    const main = await snap();
    const beforeSave = await saved();
    await open('sheet');
    await select('jade-cut');
    await press(action(child, 'pull-left'));
    await press(action(child, 'charge-grit'));
    const wetRope = await child.locator('.at-feedback').innerText();
    await page.keyboard.press('l');
    await panel.waitFor();
    await page.keyboard.press('Escape');
    await panel.waitFor({state: 'hidden'});
    assert.equal(await child.locator('.at-feedback').innerText(), wetRope);
    check('从回顾内查阅目录，合上后仍是同一条已蘸砂的湿绳');
    await press(child.locator('#leave'));
    await returned('activity');
    assert.equal(await page.locator('.at-readout').innerText(), reading);
    assert.deepEqual((await saved()).revisits, beforeSave.revisits);
    samePlace(main, await snap());
    check('中途退出回顾保留陶作定径、选片和角度，也保留主线位置', reading);
    await open('sheet');
    await select('jade-cut');
    for (const id of ['pull-left','charge-grit','pull-left','pull-right','pull-left','pull-right','wet','pull-left','pull-right','pull-left','pull-right']) {
      await press(action(child, id));
    }
    for (let i = 0; i < 6; i++) await press(action(child, 'jade-turn-right'));
    await shot('jade-inspection');
    const finish = child.locator('#review-finish-return');
    await page.evaluate(key => new Promise(acquired => {
      navigator.locks.request(key, () => new Promise(release => {
        window.releaseTestSaveLock = release;
        acquired();
      }));
    }), saveKey);
    try {
      await press(action(child, 'jade-record'));
      await page.evaluate(async key => {
        const deadline = performance.now() + 20000;
        while (!(await navigator.locks.query()).pending.some(lock => lock.name === key)) {
          if (performance.now() > deadline) throw Error('Archive write did not queue for the held lock.');
          await new Promise(resolve => setTimeout(resolve, 35));
        }
      }, saveKey);
      await press(child.locator('#review-sheet'));
      await panel.waitFor();
      const focusedChapter = await panel.evaluate(el => el.contains(document.activeElement) && document.activeElement.dataset.reviewId);
      assert.ok(focusedChapter);
      await page.evaluate(() => window.releaseTestSaveLock());
      await page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.revisits?.['jade-cut'] === 1, saveKey);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.ok(await panel.isVisible());
      assert.equal(await panel.evaluate(el => el.contains(document.activeElement) && document.activeElement.dataset.reviewId), focusedChapter);
      assert.equal(await child.locator('#folio').evaluate(el => el.open), false);
      assert.equal(await child.locator('body').getAttribute('data-mode'), 'activity');
      await press(panel.locator('#review-close'));
    } finally {
      await page.evaluate(() => {
        window.releaseTestSaveLock?.();
        delete window.releaseTestSaveLock;
      });
    }
    await finish.waitFor();
    check('写盘等待时打开目录，完成写盘后仍保留目录与焦点，合上才显示回执');
    await shot('review-receipt');
    await press(child.locator('#review-finish-library'));
    await panel.waitFor();
    assert.match(await panel.locator('[data-review-id="jade-cut"]').innerText(), /已回顾 1 次/);
    await press(panel.locator('#review-close'));
    await panel.waitFor({state: 'hidden'});
    await finish.waitFor();
    await press(finish);
    await returned('activity');
    const end = await snap(), persisted = await saved();
    samePlace(main, end);
    assert.equal(await page.locator('.at-readout').innerText(), reading);
    assert.deepEqual(persisted.completed, beforeSave.completed);
    assert.equal(end.collection.totalXP, main.collection.totalXP);
    assert.equal(persisted.revisits['jade-cut'], (beforeSave.revisits?.['jade-cut'] || 0) + 1);
    await shot('restored-pottery');
    check('玉作回执返回未完成的陶作，独立记一次回顾且经验相同', {reading, totalXP: end.collection.totalXP, revisits: persisted.revisits});
    await press(action(page, 'rotate-right'));
    assert.notEqual(await page.locator('.at-readout').innerText(), reading);
    check('恢复后可接着调整同一陶片');
  });

  await scenario('touch-new', 0, true, async ({page, check, press, panel, open, shot, returned}) => {
    await open('travel');
    assert.equal(await panel.locator('[data-review-id]:enabled').count(), 0);
    await shot('empty-library');
    const close = panel.locator('#review-resume');
    const box = await close.boundingBox();
    assert.ok(box && box.y >= 0 && box.y + box.height <= 845);
    await press(close);
    await returned('travel');
    check('新档触屏回顾目录提示尚无归档，按钮可直接回到河岸');
  });

  await scenario('touch-complete', 9, true, async ({page, check, saved, snap, child, press, panel, open, select, shot, returned}) => {
    const start = await snap(), record = await saved();
    await open('travel');
    assert.equal(await panel.locator('[data-review-id]:enabled').count(), 9);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(overflow, false);
    await shot('chapter-list');
    await select('nine-posts');
    await shot('ninth-station');
    await press(child.locator('#review-sheet'));
    await panel.waitFor();
    await press(panel.locator('#review-resume'));
    await returned('travel');
    samePlace(start, await snap());
    assert.equal((await saved()).ending, true);
    assert.deepEqual((await saved()).revisits, record.revisits);
    assert.equal((await snap()).collection.totalXP, start.collection.totalXP);
    check('触屏选择第九章后返回，保留站位、结局和经验', {site: start.site, xp: start.collection.totalXP});
  });
} finally {
  await browser.close();
  await server?.close();
  await writeFile(join(out, (scenarioFilter || 'chapter-review') + '-report.json'), JSON.stringify(result, null, 2) + '\n');
}
if (!result.scenarios.length || result.scenarios.some(run => !run.passed)) process.exitCode = 1;
