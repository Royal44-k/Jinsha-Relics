import {chromium} from 'playwright';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chapterIds,saveKey} from '../src/v10/ledger.js';

const origin=process.env.JINSHA_ORIGIN || 'http://127.0.0.1:5188';
const output=process.env.JINSHA_PROOF || 'docs/v12/collection';
const legacyKey='jinsha-river-survey-v10';
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:existsSync(edge)?edge:undefined,
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const report={origin,fixture:'Fresh context has no data. Imported context is seeded only with a four-chapter V10 legacy save. All V11 XP, spending, equipment and replays use real DOM.',checks:[],errors:[]};
let livePage;
await mkdir(output,{recursive:true});
async function note(message){
  report.checks.push(message);
  await writeFile(output+'/migration-checks.json',JSON.stringify(report,null,2));
  console.log(message);
}
async function createCase(legacy=false) {
  const context=await browser.newContext({viewport:{width:850,height:620},reducedMotion:'reduce'});
  // Concurrent project edits reload a Vite dev page mid-flight. A shipped build
  // has no Vite HMR connection. Keep ordinary HTTP and all game input enabled.
  await context.routeWebSocket(/^ws:\/\/(127\.0\.0\.1|localhost):/,()=>{});
  const page=await context.newPage();
  livePage=page;
  page.setDefaultTimeout(120000);
  page.on('pageerror',error=>report.errors.push(error.message));
  if(legacy)await page.addInitScript(({legacyKey,ids})=>{
    if(!localStorage.getItem(legacyKey)) localStorage.setItem(legacyKey,JSON.stringify({version:1,completed:ids,started:true,quality:'economy',muted:true}));
  },{legacyKey,ids:chapterIds.slice(0,4)});
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  const snapshot=()=>page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot());
  const click=(label)=>page.getByRole('button',{name:label,exact:typeof label==='string'}).click();
  const waitMode=mode=>page.waitForFunction(m=>window.__JINSHA_SURVEY__?.snapshot().mode===m,mode,{timeout:200000});
  const ctl=key=>page.locator('[data-collection-control="'+key+'"]');
  return {context,page,click,snapshot,waitMode,ctl};
}
try {
  const fresh=await createCase();
  await fresh.page.locator('#cover-profile').click();
  assert.equal((await fresh.snapshot()).collection.totalXP,0);
  assert.equal((await fresh.snapshot()).collection.equipped,'reed');
  await fresh.click('查看珍藏');
  assert.equal(await fresh.page.locator('.jc-catalogue-item:disabled').count(),9);
  await fresh.click('回到标题');
  assert.equal(await fresh.page.locator('#folio').isVisible(),false);
  await fresh.page.locator('#enter').click();
  assert.equal(await fresh.page.getByRole('button',{name:/承接旧版/}).count(),0);
  await fresh.click('落到探方边');await fresh.waitMode('travel');
  assert.equal((await fresh.snapshot()).site,'river-trench');
  assert.equal((await fresh.snapshot()).collection.totalXP,0);
  await note('Fresh title opens a locked inventory and returns to title. Normal prologue leads to the first site with 0 XP, with no migration button.');
  await fresh.context.close();

  const game=await createCase(true);
  const {page,click,snapshot,waitMode,ctl}=game;
  await page.locator('#cover-profile').click();
  assert.equal((await snapshot()).collection.totalXP,0);
  await click('回到标题');
  await page.locator('#enter').click();
  assert.ok(await page.getByRole('button',{name:'落到探方边',exact:true}).isVisible());
  assert.ok(await page.getByRole('button',{name:'承接旧版 4 处记录'}).isVisible());
  await page.screenshot({path:output+'/legacy-choice.jpg',type:'jpeg',quality:84});
  await click('承接旧版 4 处记录');
  await waitMode('travel');
  let state=await snapshot();
  assert.equal(state.collection.totalXP,120);assert.equal(state.site,'clay-fit');
  assert.deepEqual(state.completed,chapterIds.slice(0,4));
  await note('The four-chapter legacy save remains unclaimed on the title. Explicit import opens the fifth site and grants exactly four cards and 120 XP.');
  await page.locator('#notebook').click();
  await click('羽灵档案');
  await ctl('equip-jade').click();await ctl('buy-jade').click();
  await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().collection.traits.airEfficiency===.79);
  state=await snapshot();
  assert.equal(state.collection.availableXP,80);
  assert.equal(state.collection.traits.level,2);
  await click('回到地图');assert.equal(await page.locator('#folio-title').innerText(),'古蜀探险地图');
  await click('回到河岸');await waitMode('travel');
  state=await snapshot();
  assert.equal(state.site,'clay-fit');
  assert.equal(state.motion.modelForm.id,'jade');assert.equal(state.motion.modelForm.level,2);
  assert.equal(state.motion.traits.airEfficiency,.79);
  await page.screenshot({path:output+'/equipped-in-world.jpg',type:'jpeg',quality:82});
  await note('Travel → journal → wardrobe → map → travel keeps the current site. Spending 40 equips a tier-two jade rig in the actual scene with a 0.79 flight cost multiplier.');
  await page.locator('#notebook').click();
  await page.getByRole('combobox',{name:'翻看已获得的记录'}).selectOption('3');
  await click(/重访选中地点/);await waitMode('travel');
  assert.equal((await snapshot()).site,'jade-cut');
  console.log('Revisit target acquired');
  // A checkpoint is at the previous completed site. If the HUD settles while
  // clicking guide, it can open that very workbench immediately.
  if (!(await snapshot()).near) {
    await page.locator('#guide').click();
    await page.waitForFunction(()=>{const s=window.__JINSHA_SURVEY__.snapshot();return s.mode==='activity'||s.near;},null,{timeout:180000});
  }
  if ((await snapshot()).mode==='travel') await page.locator('#interact').click();
  await waitMode('activity');
  console.log('Revisit workbench entered');
  await page.locator('.at-view canvas').focus();
  for(const key of ['ArrowLeft','s','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','w','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight'])await page.keyboard.press(key);
  const turnJade=page.locator('[data-action=jade-turn-right]');
  for(let turn=0;turn<6;turn++)await turnJade.click();
  await page.locator('[data-action=jade-record]').click();
  await waitMode('receipt');
  state=await snapshot();
  assert.equal(state.completed.length,4);assert.equal(state.collection.totalXP,120);
  assert.equal(state.collection.availableXP,80);
  await ctl('quiz-jade-cut').click();await ctl('option-1').click();
  state=await snapshot();assert.equal(state.collection.totalXP,138);assert.equal(state.collection.availableXP,98);
  await note('Replaying the working jade station via the map yields no duplicate artifact XP. Its first optional identification grants exactly 18 XP.');
  await click('回到主线');await waitMode('travel');assert.equal((await snapshot()).site,'clay-fit');
  await page.locator('#notebook').click();
  await click('返回标题');assert.equal((await snapshot()).mode,'title');
  await page.locator('#cover-profile').click();
  assert.equal((await snapshot()).collection.equipped,'jade');
  await click('查看珍藏');await ctl('relic-jade-cut').click();
  assert.ok(await ctl('quiz-jade-cut').innerText().then(t=>t.includes('鉴定完成')));
  await click('回到标题');assert.equal(await page.locator('#folio').isVisible(),false);
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal((await snapshot()).collection.totalXP,138);
  await page.locator('#enter').click();await waitMode('travel');
  state=await snapshot();
  assert.deepEqual(state.motion.modelForm,{id:'jade',level:2});assert.equal(state.motion.traits.airEfficiency,.79);
  assert.equal(state.site,'clay-fit');assert.equal(state.collection.availableXP,98);
  const old=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),legacyKey);
  const current=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),saveKey);
  assert.deepEqual(old.completed,chapterIds.slice(0,4));assert.deepEqual(current.completed,chapterIds.slice(0,4));
  await note('Title → gallery → title stays on title. Reload restores active fifth site, original V10 file, tier-two world appearance, movement multiplier and exact balance.');
  assert.deepEqual(report.errors,[]);
  await game.context.close();
} catch (error) {
  report.failure=String(error.stack||error);
  if(livePage && !livePage.isClosed()){
    report.lastUI=await livePage.evaluate(()=>({
      snapshot:window.__JINSHA_SURVEY__?.snapshot(),dialog:document.querySelector('dialog[open]')?.innerText,
      site:document.getElementById('station-body')?.innerText,hud:document.getElementById('overlay')?.innerText
    })).catch(()=>null);
  }
  throw error;
} finally {
  await writeFile(output+'/migration-checks.json',JSON.stringify(report,null,2));
  await browser.close();
}

