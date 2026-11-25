const assert = require('node:assert/strict');
const fs = require('node:fs');
const newSites = require('./solve-first-sites-v11.cjs');
const path = require('node:path');
const { chromium } = require('playwright');

const base = process.env.JINSHA_ORIGIN || 'http://127.0.0.1:5197';
const output = path.resolve(process.env.JINSHA_FIELD_PROOF || 'docs/v12/fieldwork');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const fixture = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}html,body,main{width:100%;height:100%;margin:0;overflow:hidden}body{background:#17241e}#record{position:absolute;left:-10000px}</style>
<main></main><output id="record"></output><script type="module">
import {mountFieldwork} from '/src/v10/fieldwork.js';
const site=new URLSearchParams(location.search).get('site'),host=document.querySelector('main'),active=new AbortController();
let count=0;const cleanup=mountFieldwork(site,host,{signal:active.signal,sound:name=>{document.body.dataset.lastCue=name;},complete:()=>{document.getElementById('record').textContent=String(++count);}});
addEventListener('pagehide',()=>active.abort());addEventListener('fixture-close',()=>{active.abort();cleanup();});
</script></html>`;
const labels = ['river-trench','paleochannel','root-survey'];
const report={scope:'Isolated V10 fieldwork modules mounted through Vite with real renderer, player inputs and event-driven lifecycle.',checks:[],errors:[]};

async function runView(browser,name,viewport,mobile,posterMode=false){
  const ctx=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
  const page=await ctx.newPage();page.setDefaultTimeout(24000);
  const touch=mobile?await ctx.newCDPSession(page):null;
  const fail=message=>report.errors.push(name+': '+message);
  page.on('pageerror',e=>fail(e.message));
  page.on('console',m=>{if(m.type()==='error')fail(m.text());});
  page.on('response',r=>{if(r.status()>=400)fail(r.status()+' '+r.url());});
  await page.route('**/fieldwork-check?*',route=>route.fulfill({status:200,contentType:'text/html',body:fixture}));
  const staticStyleModule="export const createHotContext=()=>({accept(){},dispose(){},prune(){},invalidate(){},on(){},off(){},send(){},data:{}});export const updateStyle=(id,text)=>{const style=document.createElement('style');style.textContent=text;document.head.append(style)};export const removeStyle=()=>{};export const injectQuery=x=>x;";
  await page.route('**/@vite/client',route=>route.fulfill({status:200,contentType:'text/javascript',body:staticStyleModule}));
  const check=(label,condition)=>{assert.ok(condition,name+': '+label);report.checks.push(name+': '+label);};
  const button=label=>page.getByRole('button',{name:label,exact:true});
  const read=page.locator('.js-field-reading');
  const hint=page.locator('.js-field-hint');
  const shot=title=>page.screenshot({path:path.join(output,name+'-'+title+'.png')});
  const click=locator=>mobile?locator.tap():locator.click();
  const waitText=(selector,text,ms=24000)=>page.waitForFunction(([s,t])=>document.querySelector(s)?.textContent.includes(t),[selector,text],{timeout:ms});
  async function open(site){
    await page.goto(base+'/fieldwork-check?site='+site,{waitUntil:'domcontentloaded'});
    await page.locator('.js-field canvas').waitFor();await page.waitForTimeout(450);
    check(site+' fits viewport',await page.locator('main').evaluate(el=>el.scrollWidth===el.clientWidth&&el.scrollHeight===el.clientHeight));
  }
  const events=async(type,points)=>touch.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y],i)=>({x,y,id:i+1,radiusX:3,radiusY:3}))});
  async function point(x,y){
    if(mobile){await events('touchStart',[[x,y]]);await events('touchEnd',[]);}
    else await page.mouse.click(x,y);
  }
  async function drag(points){
    const [first,...rest]=points;
    if(mobile){await events('touchStart',[first]);for(const p of rest)await events('touchMove',[p]);await events('touchEnd',[]);}
    else{await page.mouse.move(...first);await page.mouse.down();for(const p of rest)await page.mouse.move(...p,{steps:3});await page.mouse.up();}
  }
  async function finish(label){
    await click(button(label));await waitText('#record','1');
    check(label+' emits completion once',await page.locator('#record').innerText()==='1');
    await page.evaluate(()=>window.dispatchEvent(new Event('fixture-close')));
    check('cleanup removes view and canvas',await page.locator('.js-field,canvas').count()===0);
  }
  try{
    if(posterMode){
      for(const site of labels.slice(1)){
        await open(site);await page.waitForLoadState('networkidle');await page.locator('canvas[data-painted]').waitFor();
        await page.locator('.js-field-view').screenshot({path:path.resolve('public/assets/v10/fieldwork-'+site+'.jpg'),quality:76});
      }return;
    }
    await open(labels[0]);await page.locator('canvas[data-material="registered-strata"]').waitFor();await shot('trench');
    await click(button('改用记录针'));check('recording locked before cleaning',/先来回清理/.test(await hint.innerText()));
    const canvas=page.locator('.js-field canvas'),r=await canvas.boundingBox(),scale=Math.min(r.width/1020,r.height/560);
    const joint=x=>221+.054*(x-430)+12*Math.sin(x*.008)+5*Math.sin(x*.025);
    const at=(x,y)=>{
      if(r.width<570&&r.height/r.width>1.03){const east=x>420,wx=east?648:224,wy=joint(wx),size=Math.min(r.width*.425,r.height*.34);
        return [r.x+r.width*(east?.748:.252)+(x-wx)*size/108,r.y+r.height*.67+(y-wy)*size/108];}
      return [r.x+(r.width-900*scale)/2+x*scale,r.y+(r.height-400*scale)/2+(6+y)*scale];};
    for(const x of [224,648]){
      const y=joint(x);const stroke=[];for(let k=0;k<4;k++){
        const h=-33+22*k;const xs=k%2?[42,24,8,-8,-24,-42]:[-42,-24,-8,8,24,42];
        for(const dx of xs)stroke.push(at(x+dx,y+h));
      }
      await drag(stroke);
    }
    check('both windows exposed by real strokes',(await read.innerText()).match(/100%/g)?.length===2);
    const pixels=[];
    for(const x of [206,226,237,630,650,662])pixels.push([at(x,joint(x)-8),at(x,joint(x)+8)]);
    const meanContrast=await canvas.evaluate((el,rows)=>{
      const box=el.getBoundingClientRect(),g=el.getContext('2d');
      function light([x,y]){const px=Math.round((x-box.x)*el.width/box.width),py=Math.round((y-box.y)*el.height/box.height),a=g.getImageData(px-1,py-1,3,3).data;
        let sum=0;for(let i=0;i<a.length;i+=4)sum+=a[i]*.25+a[i+1]*.58+a[i+2]*.17;return sum/9;}
      return rows.reduce((n,[hi,lo])=>n+light(hi)-light(lo),0)/rows.length;},pixels);
    check('accepted boundary agrees with visible sand and dark band',meanContrast>12);
    await click(button('改用记录针'));await waitText('.js-field-reading','两点定界');await point(...at(224,joint(224)-34));
    check('wrong layer rejected',/同一种土/.test(await hint.innerText()));
    await point(...at(224,joint(224)));await click(button('撤回标记'));
    check('recording undo',/0 \/ 2/.test(await read.innerText()));
    await point(...at(224,joint(224)));await point(...at(648,joint(648)));
    await shot('trench-secured');await newSites.sieve(page,{mobile,check,shot,finish:false});await finish('封存陶片与层位记录');
    if(process.argv.includes('--only-trench'))return;
    await open(labels[1]);await shot('river');await click(button('解缆出发'));
    if(mobile){
      const box=await canvas.boundingBox();
      await events('touchStart',[[box.x+box.width*.055,box.y+box.height*.63]]);
      await waitText('.js-field-reading','第二站',75000);
      await events('touchMove',[[box.x+box.width*.945,box.y+box.height*.63]]);
      await waitText('.js-field-reading','合拢',85000);await events('touchEnd',[]);
    }else{
      await page.keyboard.down('ArrowLeft');await page.keyboard.down('ArrowUp');
      await waitText('.js-field-reading','第二站',75000);await page.keyboard.up('ArrowLeft');await page.keyboard.down('ArrowRight');
      await waitText('.js-field-reading','合拢',75000);await page.keyboard.up('ArrowRight');await page.keyboard.up('ArrowUp');
    }
    check('both river control stations reached',/两处靠泊/.test(await read.innerText()));await shot('river-secured');await newSites.transit(page,{mobile,check,shot,finish:false});await finish('收好岸线图');
    await open(labels[2]);await waitText('.js-field-reading','原位木样');await page.waitForLoadState('networkidle');await shot('roots');
    await newSites.roots(page,{mobile,check,shot,finish:false});await finish('收存秋枫鉴定标本');
  }catch(error){await shot('failure').catch(()=>{});console.error(name,await read.innerText().catch(()=>''),await hint.innerText().catch(()=>''));throw error;}
  finally{await ctx.close();}
}
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.JINSHA_EDGE||(fs.existsSync(edge)?edge:undefined),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling']});
  const posterMode=process.argv.includes('--posters');
  try{await runView(browser,'desktop',{width:1280,height:720},false,posterMode);if(posterMode)return;
    await runView(browser,'phone',{width:390,height:844},true);assert.deepEqual(report.errors,[]);
    for(const name of ['desktop','phone']){const stale=path.join(output,name+'-failure.png');if(fs.existsSync(stale))fs.unlinkSync(stale);}}
  catch(error){report.failure=error.message;throw error;}
  finally{await browser.close();if(!posterMode)fs.writeFileSync(path.join(output,process.argv.includes('--only-trench')?'trench-material-results.json':'interaction-results.json'),JSON.stringify(report,null,2));console.log('Checks:',report.checks.length,'Errors:',report.errors.length);}
})().catch(error=>{console.error(error);process.exitCode=1;});
