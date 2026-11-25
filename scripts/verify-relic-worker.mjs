import {createServer,build,preview} from 'vite';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const output='docs/v4/relics',entry=path.resolve(output,'worker-check.html'),outDir=path.resolve(output,'worker-build');
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report={date:new Date().toISOString(),dev:{},production:{}};let dev,production;
try {
 dev=await createServer({root:process.cwd(),server:{port:5194,strictPort:true,host:'127.0.0.1'},logLevel:'error'});await dev.listen();
 const page=await browser.newPage({viewport:{width:1500,height:750},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const mode of ['worker','timeout','error','unavailable']){
  await page.goto(`http://127.0.0.1:5194/docs/v4/relics/worker-check.html?mode=${mode}`);await page.waitForFunction(()=>window.workerReport,null,{timeout:90000});
  report.dev[mode]=await page.evaluate(()=>window.workerReport);assert.equal(report.dev[mode].error,undefined,JSON.stringify(report.dev[mode]));
  if(mode==='worker')await page.screenshot({path:`${output}/worker-dev.png`});
 }
 await dev.close();dev=null;
 await build({root:process.cwd(),logLevel:'error',build:{outDir,emptyOutDir:true,copyPublicDir:false,rollupOptions:{input:entry}},worker:{format:'es'}});
 production=await preview({root:process.cwd(),logLevel:'error',build:{outDir},preview:{port:5194,strictPort:true,host:'127.0.0.1'}});
 await page.goto('http://127.0.0.1:5194/docs/v4/relics/worker-check.html?mode=worker');await page.waitForFunction(()=>window.workerReport,null,{timeout:90000});
 report.production=await page.evaluate(()=>window.workerReport);assert.equal(report.production.error,undefined,JSON.stringify(report.production));await page.screenshot({path:`${output}/worker-production.png`});
 assert.deepEqual(errors,[]);report.pageErrors=errors;
 assert.ok(report.dev.worker.responsiveness.ticks>20);assert.ok(report.production.responsiveness.ticks>20);
 assert.ok(report.dev.worker.metrics.parseMs<200);assert.ok(report.production.metrics.parseMs<200);
 await fs.writeFile(`${output}/worker-report.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({dev:report.dev.worker,production:report.production,failureCases:Object.keys(report.dev).slice(1).map(k=>({case:k,status:report.dev[k].metrics.status,mode:report.dev[k].metrics.mode,terminated:report.dev[k].terminated})),pageErrors:errors},null,2));
} finally {await browser.close();if(dev)await dev.close();if(production)await new Promise(resolve=>production.httpServer.close(resolve));}
