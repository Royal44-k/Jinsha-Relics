import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const out='docs/v4/relics';await fs.mkdir(out,{recursive:true});
const server=await createServer({root:process.cwd(),server:{port:5194,strictPort:true,host:'127.0.0.1'},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1800,height:900},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5194/docs/v4/relics/preview.html');await page.waitForFunction(()=>window.previewReady,{timeout:60000});
 const report=await page.evaluate(()=>window.relicPreview.checks());await page.screenshot({path:`${out}/five-artifacts.png`});
 for(const id of ['bird','jade','mask','tiger','sun']){
  await page.setViewportSize({width:1000,height:1000});await page.goto(`http://127.0.0.1:5194/docs/v4/relics/preview.html?id=${id}`);await page.waitForFunction(()=>window.previewReady);
  await page.screenshot({path:`${out}/${id}-studio.png`});
  if(id==='mask'){await page.evaluate(()=>window.relicPreview.view('mask',[3.5,1,4.2]));await page.screenshot({path:`${out}/mask-side.png`});}
  if(id==='jade'){await page.evaluate(()=>window.relicPreview.view('jade',[1.5,4.5,2.1]));await page.screenshot({path:`${out}/jade-bore.png`});}
  await page.locator('#light').fill('95');await page.locator('#light').dispatchEvent('input');await page.screenshot({path:`${out}/${id}-side-light.png`});
 }
 await fs.writeFile(`${out}/browser-report.json`,JSON.stringify({date:new Date().toISOString(),errors,assets:report},null,2));console.log(JSON.stringify({errors,assets:report},null,2));if(errors.length)process.exitCode=1;
} finally {await browser.close();await server.close();}
