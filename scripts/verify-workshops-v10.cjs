const { chromium } = require('playwright');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Real module, renderer and controls. The tiny document isolates the three
// workshops from the campaign's travel and save state for replayable checks.
const root=path.resolve(__dirname,'..'),out=path.join(root,'docs/v10/workshops');
const capture=process.argv.includes('--capture');
const shell='<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#work{width:100%;height:100%;margin:0}</style></head><body><main id="work"></main><script type="module">import {mountWorkshops} from "/src/v10/workshops.js";const life=new AbortController();window.seals=[];window.sounds=[];window.leave=()=>life.abort();mountWorkshops(new URLSearchParams(location.search).get("id"),document.querySelector("main"),{signal:life.signal,sound:(name,strength)=>sounds.push([name,strength]),complete:()=>seals.push("finished")});document.body.dataset.ready="true";</script></body></html>';

async function main(){
  const {createServer}=await import('vite');
  const server=await createServer({root,cacheDir:path.join(os.tmpdir(),'jinsha-workshop-v10-check-cache'),configFile:false,logLevel:'error',server:{host:'127.0.0.1',port:0},optimizeDeps:{include:['three','three/addons/environments/RoomEnvironment.js']}});
  await server.listen();
  const address=server.httpServer.address(),url='http://127.0.0.1:'+address.port+'/workshops-check';
  const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser=await chromium.launch({executablePath:process.env.WORKSHOP_BROWSER||(fs.existsSync(edge)?edge:undefined),headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
  if(capture)fs.mkdirSync(out,{recursive:true});
  const errors=[],checks=[];
  async function view(id,mobile=false){
    const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1200,height:760},hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1});
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/workshops-check*',r=>r.fulfill({contentType:'text/html;charset=utf-8',body:shell}));
    await page.goto(url+'?id='+id);
    await page.waitForSelector('body[data-ready="true"]',{timeout:60000});
    const size=await page.locator('.at-view canvas').boundingBox();
    assert.ok(size.width>300&&size.height>175,'renderer has a usable extent');
    return page;
  }
  async function shot(p,name){
    if(!capture)return;
    const cdp=await p.context().newCDPSession(p);
    try{
      const {data}=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
      fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data,'base64'));
    }finally{await cdp.detach();}
  }
  async function cleared(p){
    await p.waitForFunction(()=>window.seals.length===1);
    const names=await p.evaluate(()=>sounds.map(s=>s[0]));
    assert.ok(names.length>=3);
    await p.evaluate(()=>leave());assert.equal(await p.locator('.js-at,canvas').count(),0);
    await p.close();return names;
  }
  async function handheldDrag(p,from,to,steps=5){
    const cdp=await p.context().newCDPSession(p);
    const point=(x,y)=>[{x,y,id:1,radiusX:5,radiusY:5,force:.6}];
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:point(from.x,from.y)});
    for(let i=1;i<=steps;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(from.x+(to.x-from.x)*i/steps,from.y+(to.y-from.y)*i/steps)});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
  }
  async function keyboardJade(){
    const p=await view('jade-cut');
    await shot(p,'jade-bench');
    await p.keyboard.press('ArrowLeft');await p.keyboard.press('ArrowLeft');
    assert.match(await p.locator('.at-feedback').innerText(),/另一边/);
    for(const key of ['ArrowRight','ArrowLeft','ArrowRight','ArrowLeft'])await p.keyboard.press(key);
    assert.match(await p.locator('.at-feedback').innerText(),/发干/);
    await p.keyboard.press('w');
    for(let i=0;i<4;i++)await p.keyboard.press(i%2?'ArrowRight':'ArrowLeft');
    const sounds=await cleared(p);assert.ok(sounds.includes('water-drop')&&sounds.includes('jade-scrape'));
    checks.push('玉作键盘：同侧回拉与干切被拒绝，补水后断玉。');
  }
  async function touchJade(){
    const p=await view('jade-cut',true),canvas=await p.locator('.at-view').boundingBox();
    const l={x:canvas.x+canvas.width*.22,y:canvas.y+canvas.height*.5},r={x:canvas.x+canvas.width*.78,y:l.y};
    for(let i=0;i<8;i++){
      if(i===4)await p.locator('[data-action=wet]').tap();
      await handheldDrag(p,i%2?r:l,i%2?l:r,3);
    }
    await cleared(p);checks.push('玉作触屏：真实 touch 拖绳、舀水并通关。');
  }
  async function interruptReward(){
    const p=await view('jade-cut');
    await p.emulateMedia({reducedMotion:'reduce'});
    for(let i=0;i<8;i++){
      if(i===4)await p.keyboard.press('w');
      await p.keyboard.press(i%2?'ArrowLeft':'ArrowRight');
    }
    await p.locator('.at-solved').waitFor();
    await p.evaluate(()=>leave());await p.waitForTimeout(1200);
    assert.equal(await p.evaluate(()=>seals.length),0,'aborted reward cannot be committed');
    assert.equal(await p.locator('canvas').count(),0);await p.close();
    checks.push('成果镜头中返回河岸，待发的领奖回调与器物画布均已清理。');
  }
  async function clay(mobile){
    const p=await view('clay-fit',mobile),button=name=>p.locator('[data-action="'+name+'"]');
    if(mobile)await button('gauge').tap();else await p.keyboard.press('Enter');
    assert.match(await p.locator('.at-feedback').innerText(),/再展开/);
    if(mobile){await button('widen').tap();await button('gauge').tap();}
    else {await p.keyboard.press('ArrowRight');await p.keyboard.press('Enter');}
    if(!mobile)await shot(p,'clay-before');
    else await shot(p,'clay-touch');
    for(let i=0;i<3;i++){
      const rotations=[2,2,3],direction=i===1?'rotate-left':'rotate-right';
      for(let j=0;j<rotations[i];j++){
        if(mobile)await button(direction).tap();else await p.keyboard.press(i===1?'q':'r');
      }
      // Read the very same two projected markers visible on screen.
      const source=await p.locator('.at-shard-pin').boundingBox(),goal=await p.locator('.at-target-pin').boundingBox();
      const from={x:source.x+source.width/2,y:source.y+source.height/2},to={x:goal.x+goal.width/2,y:goal.y+goal.height/2};
      if(mobile){
        await handheldDrag(p,from,to,7);
      }else{
        await p.locator('.at-view canvas').focus();
        if(i===0){
          for(let k=0;k<14;k++)await p.keyboard.press('ArrowRight');
          for(let k=0;k<3;k++)await p.keyboard.press('ArrowDown');
          await p.keyboard.press('Enter');
        }else{
          await p.mouse.move(from.x,from.y);await p.mouse.down();await p.mouse.move(to.x,to.y,{steps:6});await p.mouse.up();
        }
      }
      assert.equal(await p.locator('.at-instrument output').last().textContent(),(i+1)+' / 3','shard '+i+' registered');
    }
    const sounds=await cleared(p);assert.ok(sounds.includes('clay-fit'));
    checks.push(mobile?'陶作触屏：定径、手指旋转控件和三片连续触移归位。':'陶作桌面：玉规校准、键盘取位与鼠标拾取、三片真实断面合缝。');
  }
  async function bronze(mobile){
    const p=await view('bronze-shadow',mobile),button=name=>p.locator('[data-action="'+name+'"]');
    await button('impress').click();assert.match(await p.locator('.at-feedback').innerText(),/微调/);
    if(mobile){
      const rect=await p.locator('.at-view').boundingBox(),y=rect.y+rect.height*.55;
      await handheldDrag(p,{x:rect.x+rect.width*.70,y},{x:rect.x+rect.width*(.70-5/21.6),y},7);
      await button('impress').tap();
    }else{
      await p.locator('.at-view canvas').focus();
      for(let i=0;i<5;i++)await p.keyboard.press('ArrowLeft');await shot(p,'bronze-profile');await p.keyboard.press('Enter');
    }
    await p.locator('.at-print canvas').waitFor();
    if(!mobile)await shot(p,'bronze-print');
    if(mobile){
      const rect=await p.locator('.at-print canvas').boundingBox();
      await p.touchscreen.tap(rect.x+rect.width*.48,rect.y+rect.height*.94);assert.match(await p.locator('.at-feedback').innerText(),/轮廓不符/);
      for(const [x,y] of [[-.73,.65],[.84,.57],[1.21,-.71]]){
        await p.touchscreen.tap(rect.x+rect.width*(.52+x*250/960),rect.y+rect.height*(.49-y*250/610));
      }
    }else{
      await p.keyboard.press('Enter');assert.match(await p.locator('.at-feedback').innerText(),/轮廓不符/);
      for(let i=0;i<3;i++){
        for(let j=0;j<(i?2:1);j++)await p.keyboard.press('ArrowRight');await p.keyboard.press('Enter');
      }
    }
    await shot(p,mobile?'bronze-touch-stamped':'bronze-stamped');
    const sounds=await cleared(p);assert.ok(sounds.includes('bronze-register'));
    checks.push(mobile?'铜鸟触屏：实际拖动陶托，压印，直接触点辨认三处形态。':'铜鸟键盘：偏角拒印、归零、误判反馈、探点与留印。');
  }
  try{
    for(const fn of [keyboardJade,touchJade,()=>clay(false),()=>clay(true),()=>bronze(false),()=>bronze(true),interruptReward]){
      await fn();console.log(checks.at(-1));
    }
    assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors},null,2));
  }finally{await browser.close();await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
