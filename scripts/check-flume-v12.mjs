import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {build} from 'vite';
import {advancePour,cores,makePour,sediment,speed} from '../src/v12/flume-physics.js';

const proof='docs/v12/flume';await mkdir(proof,{recursive:true});
const result={method:'Packaged Vite module over HTTP, Edge input, localStorage and particle integration',checks:[],counts:[],rendering:[],errors:[]};
function check(name,ok){assert.ok(ok,name);result.checks.push(name);}
function simulate(gate,depth=0){
  const b=makePour();let steps=0;
  while(!b.done&&steps++<1800)advancePour(b,1/60,typeof gate==='function'?gate(b.time):gate,depth);
  assert.ok(b.done);return b;
}
for(const g of [0,7,34,83,100]){
  const b=simulate(g);result.counts.push({g,window:b.counts,upstream:b.before,downstream:b.after});
  check('all 108 tracers accounted for at '+g+'%',b.before.concat(b.counts,b.after).reduce((a,n)=>a+n,0)===108);
}
const medium=simulate(34),changed=simulate(t=>t<.9?34:83);
check('closed gate stops horizontal transport',speed(0)===0&&simulate(0).before.join()==='36,36,36');
check('adjusting flow after release moves the actual grains',medium.counts.join()!==changed.counts.join());
const gates=[83,34,7];
for(const c of cores){let h=0;for(const k of c.target){const b=simulate(gates[k],h);check(c.name+' layer at height '+h.toFixed(2),sediment(b.counts).kind===k);h+=b.landing.length*.0022;}}
// Load a packaged module over HTTP just like a release, including its actual
// compiled CSS and scene assets. Keep the fixture outside the game entry point.
const bundle=await build({configFile:false,publicDir:false,logLevel:'silent',build:{write:false,minify:false,cssCodeSplit:false,rollupOptions:{input:'src/v12/flume.js',preserveEntrySignatures:'strict',output:{entryFileNames:'flume.js',assetFileNames:'flume[extname]'}}}});
const files=new Map(bundle.output.map(f=>['/'+f.fileName,[f.type==='asset'?'text/css':'application/javascript',f.type==='asset'?f.source:f.code]]));
for(const path of ['/assets/v10/cutbank.webp','/assets/v10/workshop/wood.jpg','/assets/v10/workshop/clay.jpg']){
  files.set(path,[path.endsWith('webp')?'image/webp':'image/jpeg',await readFile('public'+path)]);
}
const html='<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/flume.css"><style>*{box-sizing:border-box}body{background:#13221f;color:#eee;margin:0}main{max-width:1020px;padding:18px;margin:30px auto}button{font:inherit}</style><main></main><script type=module>import {mountFlume} from "/flume.js";const ac=new AbortController();window.closeCard=mountFlume(document.querySelector("main"),{completedCount:Number(location.search.slice(1)),signal:ac.signal,onClose:()=>document.body.dataset.closed="yes"});</script>';
files.set('/__flume',['text/html; charset=utf-8',html]);
const server=createServer((req,res)=>{
  const path=req.url.split('?')[0],asset=files.get(path);
  if(!asset){res.writeHead(path==='/favicon.ico'?204:404).end();return;}
  res.writeHead(200,{'Content-Type':asset[0]}).end(asset[1]);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:existsSync(edge)?edge:undefined});
async function run(label,mobile,flat=false){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1180,height:790},hasTouch:mobile,isMobile:mobile,reducedMotion:mobile?'reduce':'no-preference'});
  if(!flat)await context.addInitScript(()=>{
    const metrics=window.__flumeDraw={total:0};
    for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
      const original=WebGL2RenderingContext.prototype[name];
      WebGL2RenderingContext.prototype[name]=function(...args){metrics.total++;return original.apply(this,args);};
    }
  });
  if(flat)await context.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:get.call(this,type,...args);};
  });
  const p=await context.newPage(),cdp=mobile?await context.newCDPSession(p):null;let errors=result.errors;
  p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
  const button=name=>p.getByRole('button',{name,exact:true});
  const click=async b=>{await b.scrollIntoViewIfNeeded();return mobile?b.tap():b.click();};
  async function drag(from,to){
    if(mobile){
      const send=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{id:1,x,y}]});
      await send('touchStart',...from);for(let i=1;i<=9;i++)await send('touchMove',from[0]+(to[0]-from[0])*i/9,from[1]+(to[1]-from[1])*i/9);await send('touchEnd');
    }else{await p.mouse.move(...from);await p.mouse.down();await p.mouse.move(...to,{steps:10});await p.mouse.up();}
  }
  async function pos(selector){const l=p.locator(selector);await l.scrollIntoViewIfNeeded();const b=await l.boundingBox();return [b.x+b.width/2,b.y+b.height/2];}
  async function flow(g){
    const input=p.locator('.fl-controls input');await input.scrollIntoViewIfNeeded();const b=await input.boundingBox(),x=b.x+8+(b.width-16)*g/100;
    if(mobile)await p.touchscreen.tap(x,b.y+b.height/2);else await p.mouse.click(x,b.y+b.height/2);
  }
  async function settle(){await p.waitForFunction(()=>['mismatch','ready','complete'].includes(document.querySelector('.fl-lab')?.dataset.phase));}
  const coreKey=id=>'jinsha-flume-v1.'+id;
  try{
    await p.goto(base+'/__flume?1');await p.locator('.fl-stage canvas').first().waitFor();
    check(label+' later cores are gated',await p.locator('.fl-target:disabled').count()===2);
    const stage=p.locator(flat?'.fl-fallback':'.fl-canvas');await stage.waitFor();
    if(flat){
      check('cutaway shown when WebGL2 is unavailable',await button('正视水槽').count()===0);
      await flow(83);await click(button('倾倒混合样'));await p.locator('[data-phase=pour]').waitFor();await settle();
      await flow(7);await click(button('倾倒混合样'));await p.locator('[data-phase=pour]').waitFor();await settle();
      check('offline 2D fallback builds both correct physical layers',await p.locator('.fl-lab').getAttribute('data-phase')==='complete');
      await p.locator('.fl-lab').screenshot({path:join(proof,label+'-wan.png')});
      await p.goto(base+'/__flume?3');await stage.waitFor();check('station three unlocks only the second additional core',await p.locator('.fl-target:disabled').count()===1);
      await p.goto(base+'/__flume?0');await stage.waitFor();check('zero-station guest cannot pour',await button('倾倒混合样').isDisabled());return;
    }
    await p.waitForLoadState('networkidle');const draws=await p.evaluate(()=>window.__flumeDraw.total);
    await p.waitForTimeout(240);const idle=await p.evaluate(()=>window.__flumeDraw.total)-draws;
    check(label+' idle instrument does not submit WebGL draws',draws>0&&idle===0);
    result.rendering.push({device:label,initialAndResizeDraws:draws,drawsDuring240msIdle:idle});
    const bb=await stage.boundingBox(),from=[bb.x+bb.width*.62,bb.y+bb.height*.72],prior=await stage.screenshot();
    await drag(from,[from[0]+42,from[1]-14]);check(label+' camera orbits actual three-dimensional tank',!prior.equals(await stage.screenshot()));
    await click(button('正视水槽'));
    if(!mobile){
      const range=p.locator('input');await range.focus();const at=Number(await range.inputValue());
      await p.keyboard.press('ArrowRight');check('keyboard can operate the physical gate',Number(await range.inputValue())===at+1);
    }
    const grip=await pos('[data-grip=gate]');await drag(grip,[grip[0],grip[1]-27]);
    check(label+' gate is physically draggable',Number(await p.locator('input').inputValue())>44);
    await flow(34);await click(button('先试流'));await p.locator('[data-phase=trial]').waitFor();
    await p.waitForTimeout(780);await p.locator('.fl-lab').screenshot({path:join(proof,label+'-trial.png')});await settle();
    check(label+' no layer kept after trial',await p.locator('.fl-observed li').first().textContent()==='01待沉积');
    const cup=await pos('[data-grip=pour]');await drag(cup,[cup[0]+51,cup[1]+5]);
    await p.locator('[data-phase=pour]').waitFor();await settle();check(label+' real scoop produces a wrong middle-sand bed',await p.locator('.fl-lab').getAttribute('data-phase')==='mismatch');
    await click(button('撤回上一层'));check(label+' undo removes only last layer',await p.locator('.fl-lab').getAttribute('data-phase')==='ready');
    const selected=mobile?cores.slice(0,1):cores;
    if(!mobile){await p.goto(base+'/__flume?9');await stage.waitFor();}
    for(const c of selected){
      await click(button(c.name));
      for(const [i,k] of c.target.entries()){
        await flow(gates[k]);await click(button('倾倒混合样'));await p.locator('[data-phase=pour]').waitFor();await settle();
        assert.ok(await p.locator('.fl-observed li').nth(i).innerText().then(t=>t.includes(['粗砂','中砂','细砂'][k])));
        if(i===0&&c===cores[0]){
          await p.reload();await stage.waitFor();check(label+' intermediate bed persists',await p.locator('.fl-observed li').first().innerText().then(t=>t.includes('粗砂')));
        }
      }
      check(label+' '+c.name+' recipe completed by observed grains',await p.locator('.fl-lab').getAttribute('data-phase')==='complete');
      const save=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),coreKey(c.id));check(label+' '+c.name+' persisted particle landing positions',save.best>=c.target.length&&save.layers.every(layer=>layer.length>=6));
      await p.locator('.fl-lab').screenshot({path:join(proof,label+'-'+c.id+'.png')});
      await click(button('再配一份'));check(label+' best recorded after repeat',await p.locator('.fl-saved').innerText().then(t=>t.includes('最少')));
    }
    if(mobile)check('390px workbench has no horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await click(button('收起水槽'));check(label+' close releases the canvas',await p.locator('canvas').count()===0);
  }catch(error){await p.screenshot({path:join(proof,label+'-failure.png')});throw error;}
  finally{await cdp?.detach();await context.close();}
}
try{await run('desktop',false);await run('phone',true);await run('webgl-off',false,true);assert.deepEqual(result.errors,[]);result.ok=true;}
catch(e){result.failure=e.message;throw e;}
finally{await browser.close();server.close();await writeFile(join(proof,'checks.json'),JSON.stringify(result,null,2)+'\n');}
