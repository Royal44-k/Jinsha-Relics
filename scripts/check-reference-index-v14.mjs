import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {entries} from './reference-catalog-v14.mjs';

const origin=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5188';
const output=new URL('../docs/v14/references/',import.meta.url);
const fileUrl=new URL('../public/references.html',import.meta.url).href;
const crosscheck=JSON.parse(await readFile(new URL('web-crosscheck.json',output),'utf8'));
const expectedUnconfirmed=crosscheck.items.filter(item=>!item.readable).map(item=>item.href).sort();
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({executablePath:existsSync(edge)?edge:undefined,headless:true});
const expected={all:entries.length,current:entries.filter(e=>e.tags.includes(14)).length,history:entries.filter(e=>e.tags.some(n=>n<14)).length};
const report={source:origin,totals:expected,unconfirmedLinks:expectedUnconfirmed.length,distinctHosts:new Set(entries.map(e=>new URL(e.href).hostname)).size,checks:[]};
const issues=[];
await mkdir(output,{recursive:true});

async function verify({key,viewport,url,touch=false,script=true}){
  const context=await browser.newContext({viewport,isMobile:touch,hasTouch:touch,javaScriptEnabled:script,deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await context.newPage();
  page.on('pageerror',error=>issues.push(error.message));
  const records=page.locator('.records li:visible');
  const links=page.locator('.records a');
  try{
    if(url.startsWith('file:'))await context.setOffline(true);
    if(key==='desktop'){
      await page.goto(origin+'/credits-v10.html');
      await page.getByRole('link',{name:'创作参考索引'}).click();
      assert.equal(page.url(),url);
    }else await page.goto(url);
    assert.equal(await records.count(),expected.all);
    const hrefs=await links.evaluateAll(as=>as.map(a=>a.href));
    assert.equal(new Set(hrefs).size,expected.all);
    const labeled=page.locator('.records a:has(.access-status)');
    assert.deepEqual(await labeled.evaluateAll(as=>as.map(a=>a.href).sort()),expectedUnconfirmed);
    assert.equal(await page.locator('.records [data-current=yes] .access-status').count(),0);
    assert.ok(await links.evaluateAll(as=>as.every(a=>a.protocol==='https:'&&a.target==='_blank'&&a.relList.contains('noopener'))));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(script){
      await page.locator('#period').selectOption('current');
      assert.equal(await records.count(),expected.current);
      await page.locator('#category').selectOption('games');
      assert.equal(await records.count(),13);
      await page.locator('#q').fill('journey');
      assert.equal(await records.count(),1);
      assert.ok((await records.first().innerText()).includes('风之旅人'));
      await page.locator('#q').fill('馆藏铜立人不存在于游戏组');
      assert.equal(await records.count(),0);
      assert.ok(await page.locator('#empty').isVisible());
      if(touch)await page.locator('#reset').tap();else await page.locator('#reset').click();
      assert.equal(await records.count(),expected.all);
      assert.ok(await page.locator('#q').evaluate(e=>e===document.activeElement));
      await page.locator('#period').selectOption('history');
      assert.equal(await records.count(),expected.history);
      await page.locator('#category').selectOption('motion');
      await page.locator('#q').fill('Sael 焦');
      assert.equal(await records.count(),1);
      assert.equal(await records.locator('a').getAttribute('href'),'https://sael.net/plane-of-focus/');
      const jump=page.locator('.jump a[href="#museum"]');
      if(touch)await jump.tap();else await jump.click();
      assert.equal(await records.count(),expected.all);
      assert.ok(await page.locator('#museum h2').isVisible());
      assert.ok(page.url().endsWith('#museum'));
      await page.getByRole('link',{name:'回页首'}).click();
      await page.locator('#period').selectOption('current');
      if(key==='mobile')await page.locator('#category').selectOption('motion');
      await page.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0)});
      await page.screenshot({path:fileURLToPath(new URL(key+'.jpg',output)),type:'jpeg',quality:80});
    }else{
      assert.equal(await page.locator('#tools').isVisible(),false);
      await page.locator('.jump a[href="#motion"]').click();
      assert.ok(page.url().endsWith('#motion'));
      assert.ok(await links.filter({hasText:'Farewell Light'}).isVisible());
    }
    report.checks.push({key,viewport,script,touch,scheme:new URL(url).protocol,ok:true});
  }finally{await context.close();}
}
try{
  await verify({key:'desktop',viewport:{width:1366,height:830},url:origin+'/references.html'});
  await verify({key:'mobile',viewport:{width:390,height:844},url:origin+'/references.html',touch:true});
  await verify({key:'local-file',viewport:{width:1280,height:780},url:fileUrl});
  await verify({key:'file-no-js',viewport:{width:320,height:568},url:fileUrl,touch:true,script:false});
  assert.deepEqual(issues,[]);
  report.ok=true;
}catch(error){report.ok=false;report.error=error.stack;process.exitCode=1;}
finally{
  report.errors=issues;
  await browser.close();
  await writeFile(new URL('browser.json',output),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
