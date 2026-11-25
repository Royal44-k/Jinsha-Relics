const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const OUT='docs/v7/pottery-focus-review';fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const report={at:new Date().toISOString(),method:'Real pottery UI in an isolated HTML fixture; no game scene, Three.js or WebGL context is loaded.',errors:[],checks:[]};
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/__review-pottery-focus.html',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Pottery focus fixture</title><body><button id="origin">打开陶作</button><button id="outside">底层导航</button><script type="module">
import {createPotteryUI} from '/src/v7/pottery-ui.js';
let value={fired:false,displayFired:false,firing:false,heat:0,viewingWork:null,works:[],totalMade:0,canUndo:false,name:'测试器物',pattern:'plain'};
const update=()=>ui.update(value,{x:720,y:250,bottom:650,width:250,height:400});
const ui=createPotteryUI({onClose:()=>ui.close(),onFire(){value={...value,firing:true};update();},onRemake(){value={...value,fired:false,displayFired:false};update();}});
document.querySelector('#origin').onclick=()=>{ui.open(value);update();};
window.focusFixture={ui,complete(){value={...value,fired:true,displayFired:true,firing:false,heat:1,totalMade:1};update();}};
</script></body></html>`}));
  await page.goto('http://127.0.0.1:5186/__review-pottery-focus.html');await page.waitForFunction(()=>window.focusFixture);
  const active=()=>page.evaluate(()=>{const element=document.activeElement,root=document.querySelector('#v7-pottery');return {tag:element.tagName,id:element.id,className:element.className,inside:root.contains(element),visible:!!element.getClientRects().length};});
  await page.locator('#origin').click();assert.equal((await active()).className,'pottery-surface');
  await page.locator('.pottery-fire').click();assert.equal(await page.locator('.pottery-fire').isHidden(),true);report.afterHiddenFire=await active();
  await page.keyboard.press('Tab');let result=await active();report.checks.push({name:'forward Tab after firing hides its focused button',result});assert.ok(result.inside&&result.visible,'hidden fire must return Tab focus to visible pottery controls');assert.equal(result.className,'pottery-surface');
  await page.locator('#outside').evaluate(el=>el.focus());await page.keyboard.press('Shift+Tab');result=await active();report.checks.push({name:'reverse Tab when focus is outside the visible list',result});assert.ok(result.inside&&result.visible);assert.equal(result.className,'pottery-close');
  await page.evaluate(()=>focusFixture.complete());await page.locator('.pottery-remake').click();assert.equal(await page.locator('.pottery-remake').isHidden(),true);report.afterHiddenRemake=await active();
  await page.keyboard.press('Tab');result=await active();report.checks.push({name:'forward Tab after remaking hides its focused button',result});assert.ok(result.inside&&result.visible);assert.equal(result.className,'pottery-surface');
  await page.locator('#outside').evaluate(el=>el.focus());await page.keyboard.press('Shift+Tab');result=await active();report.checks.push({name:'reverse Tab returns to final visible control on editable clay',result});assert.equal(result.className,'pottery-fire');
  await page.keyboard.press('Escape');result=await active();report.checks.push({name:'Escape returns focus to the original trigger',result});assert.equal(result.id,'origin');assert.equal(await page.locator('#v7-pottery').isHidden(),true);
  assert.deepEqual(report.errors,[]);report.passed=true;console.log(JSON.stringify(report,null,2));
 }catch(error){report.failure=error.message;throw error;}finally{await browser.close();fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2));}
})().catch(error=>{console.error(error);process.exitCode=1;});
