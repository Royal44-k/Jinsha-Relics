const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'docs/v10/campaign');
const origin=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5188';
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const report={route:origin,driver:'Production DOM, keyboard, pointer, navigation assistance. No injected progress.',stages:[],issues:[],checks:[]};
const destinations=['river-trench','paleochannel','root-survey','jade-cut','clay-fit','bronze-shadow','ivory-record','sunfoil','nine-posts'];
async function check(){
  const software=process.env.JINSHA_SOFTWARE==='1';
  const browser=await chromium.launch({headless:true,executablePath:fs.existsSync(edge)?edge:undefined,args:[...(software?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]),'--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  fs.mkdirSync(output,{recursive:true});
  const page=await browser.newPage({viewport:{width:1040,height:650},deviceScaleFactor:1});
  page.setDefaultTimeout(60000);
  page.on('pageerror',e=>report.issues.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.issues.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)report.issues.push(r.status()+' '+r.url());});
  const waitMode=m=>page.waitForFunction(mode=>document.body.dataset.mode===mode,m,{timeout:120000});
  const shot=name=>page.screenshot({path:path.join(output,name+'.jpg'),type:'jpeg',quality:87,timeout:90000});
  const button=(n)=>page.getByRole('button',{name:n,exact:typeof n==='string'}),click=n=>button(n).click();
  const snapshot=()=>page.evaluate(()=>window.__JINSHA_SURVEY__.snapshot());
  const keyboard=k=>page.keyboard.press(k);
  async function sampleFrames(mode){
    await page.evaluate(expected=>{
      const tag={values:[],last:0,begin:performance.now()};window.surveyCheckFrames=tag;
      function read(now){
        if(tag!==window.surveyCheckFrames||document.body.dataset.mode!==expected)return;
        if(tag.last)tag.values.push(now-tag.last);
        tag.last=now;requestAnimationFrame(read);
      }
      requestAnimationFrame(read);
    },mode);
  }
  function frameSummary(){
    return page.evaluate(()=>{
      const values=(window.surveyCheckFrames?.values||[]).sort((a,b)=>a-b);
      const at=p=>Math.round((values[Math.min(values.length-1,Math.floor(values.length*p))]||0)*10)/10;
      const tag=window.surveyCheckFrames;
      const longest=performance.getEntriesByType('long-animation-frame').filter(e=>e.startTime>=tag.begin&&e.startTime<=tag.last)
        .sort((a,b)=>b.duration-a.duration).slice(0,2).map(e=>({
          ms:Math.round(e.duration),blockingMs:Math.round(e.blockingDuration),
          scripts:e.scripts.slice().sort((a,b)=>b.duration-a.duration).slice(0,2).map(s=>({
            fn:s.sourceFunctionName,invoker:s.invoker,ms:Math.round(s.duration),file:(s.sourceURL||'').split('/').at(-1),position:s.sourceCharPosition}))
        }));
      return {frames:values.length,medianMs:at(.5),p95Ms:at(.95),maxMs:at(1),above50Ms:values.filter(v=>v>50).length,longest};
    });
  }
  async function drag(points){await page.mouse.move(...points[0]);await page.mouse.down();for(const p of points.slice(1))await page.mouse.move(...p,{steps:2});await page.mouse.up();}
  async function setRange(input,val){const min=+await input.getAttribute('min'),max=+await input.getAttribute('max'),b=await input.boundingBox();await input.click({position:{x:8+(b.width-16)*(val-min)/(max-min),y:b.height/2}});}
  async function activity(i){
    if(i===0){
      const r=await page.locator('.js-field canvas').boundingBox(),s=Math.min(r.width/1020,r.height/560);
      const at=(x,y)=>[r.x+(r.width-900*s)/2+x*s,r.y+(r.height-400*s)/2+(6+y)*s];
      const seam=x=>221+.054*(x-430)+12*Math.sin(x*.008)+5*Math.sin(x*.025);
      for(const x of [224,648]){const points=[];for(let k=0;k<4;k++)for(const dx of (k%2?[42,24,8,-8,-24,-42]:[-42,-24,-8,8,24,42]))points.push(at(x+dx,seam(x)-33+22*k));await drag(points);}
      await click('改用记录针');for(const x of [224,648])await page.mouse.click(...at(x,seam(x)));await click('收录层位拓页');
    }else if(i===1){
      await click('解缆出发');
      if(process.env.JINSHA_EDDY==='1'){
        await click(/河心试胆/);await click('迎向回涡');
        for(let wave=0;wave<3;wave++){
          const warning=page.locator('[data-eddy-phase="warning"] .eddy-hud strong');
          await warning.waitFor();const text=await warning.innerText();
          assert.match(text,/向[左右]拨桨/);const key=text.includes('左')?'ArrowLeft':'ArrowRight';
          await page.keyboard.down(key);
          try{
            await page.locator('[data-eddy-phase="opening"]').waitFor({timeout:9500});
            if(wave===1)await shot('river-eddy');
            await keyboard('f');
          }finally{await page.keyboard.up(key);}
        }
        await page.locator('[data-eddy-phase="won"]').waitFor();await click('继续测河');
        report.checks.push('Voluntary river encounter won through three dodges and counters before resuming the two moorings');
        // Keep the ordinary surveying measurement independent of the optional fight and its proof screenshot.
        await sampleFrames('activity');
      }
      await page.keyboard.down('ArrowLeft');await page.keyboard.down('ArrowUp');
      await page.waitForFunction(()=>document.querySelector('.js-field-reading').textContent.includes('第二站'),null,{timeout:120000});
      await page.keyboard.up('ArrowLeft');await page.keyboard.down('ArrowRight');
      await page.waitForFunction(()=>document.querySelector('.js-field-reading').textContent.includes('合拢'),null,{timeout:120000});
      await page.keyboard.up('ArrowRight');await page.keyboard.up('ArrowUp');await click('收好岸线图');
    }else if(i===2){
      await click('甲桩');await click('丙桩');await setRange(page.getByRole('slider',{name:'测绳长度'}),6.08);await click('扣绳读数');await click('收好古根测绘图');
    }else if(i===3){
      await page.locator('.at-view canvas').focus();
      for(const k of ['ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','w','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight'])await keyboard(k);
    }else if(i===4){
      await page.locator('[data-action=widen]').click();await page.locator('[data-action=gauge]').click();
      for(let s=0;s<3;s++){for(let k=0;k<[2,2,3][s];k++)await page.locator('[data-action='+ (s===1?'rotate-left':'rotate-right')+']').click();
        const a=await page.locator('.at-shard-pin').boundingBox(),b=await page.locator('.at-target-pin').boundingBox();
        await drag([[a.x+a.width/2,a.y+a.height/2],[b.x+b.width/2,b.y+b.height/2]]);}
    }else if(i===5){
      await page.locator('.at-view canvas').focus();for(let k=0;k<5;k++)await keyboard('ArrowLeft');await keyboard('Enter');
      await page.locator('.at-print canvas').waitFor();
      for(let s=0;s<3;s++){for(let j=0;j<(s?2:1);j++)await keyboard('ArrowRight');await keyboard('Enter');}
    }else if(i===6){
      for(const [s,value] of [74,46,27].entries()){await page.locator('.jss-focus-mark').nth(s).click();await setRange(page.getByRole('slider'),value);await click(/按下快门/);}
      await click(/封存三格/);
    }else if(i===7){
      await setRange(page.getByRole('slider'),75);await click('固定透光灯');
      for(const dir of [/逆时针拓一段/,/顺时针拓一段/])for(let k=0;k<12;k++)await click(dir);
      await click(/收起负形拓片/);
    }else{
      await click('听参考短句');await page.waitForFunction(()=>document.querySelector('.jss-note').textContent.includes('木、河、石'));
      for(const n of [3,1,8])await page.locator('.jss-post').nth(n).click();
      await click('奏响九柱');await click(/留下九柱/);
    }
  }
  try{
    await page.goto(origin,{waitUntil:'domcontentloaded'});await page.locator('#enter').waitFor();
    report.bundle=await page.locator('script[type=module]').first().getAttribute('src');await shot('00-title');
    await page.locator('#enter').click();
    const waterline=page.getByRole('slider',{name:/比较古河湾/});await waterline.focus();
    await keyboard('Home');assert.equal(await waterline.inputValue(),'0');
    await keyboard('End');assert.equal(await waterline.inputValue(),'100');
    await waterline.click({position:{x:Math.round((await waterline.boundingBox()).width*.58),y:20}});
    await page.waitForFunction(()=>[...document.querySelectorAll('.bank-plate img')].every(i=>i.complete&&i.naturalWidth));
    await shot('00-prologue');report.checks.push('Same-view ancient floodplain and excavation can be compared by keyboard or pointer');
    await click('落到探方边');await waitMode('travel');await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().motion.drawCalls>0);
    report.renderer=await page.locator('#world-view canvas').evaluate(c=>{const gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
    await shot('01-riverbank');const before=await snapshot();await page.keyboard.down('KeyD');await page.waitForTimeout(500);await page.keyboard.up('KeyD');await page.keyboard.down('KeyW');
    await page.waitForFunction(start=>window.__JINSHA_SURVEY__.snapshot().motion.position.some((v,i)=>Math.abs(v-start[i])>.08),before.motion.position,{timeout:35000});await page.keyboard.up('KeyW');
    assert.ok((await snapshot()).motion.position.some((v,i)=>Math.abs(v-before.motion.position[i])>.05));report.checks.push('Normal entry and manual locomotion');
    for(let i=0;i<9;i++){
      const state=await snapshot();assert.equal(state.site,destinations[i]);console.log('Walking to',i+1,state.site);
      await sampleFrames('travel');
      if(!state.near){await page.locator('#guide').click();await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().near,null,{timeout:120000});}
      await page.locator('#interact').click();await waitMode('activity');const approachFrames=await frameSummary();
      await shot('site-'+(i+1));await sampleFrames('activity');
      await activity(i);await waitMode('receipt');assert.equal((await snapshot()).completed.length,i+1);
      report.stages.push({id:destinations[i],record:await page.locator('#folio-title').innerText(),approachFrames,activityFrames:await frameSummary()});
      fs.writeFileSync(path.join(output,'playthrough.json'),JSON.stringify(report,null,2));
      if(i===8)break;
      await click('收进手册，回到河岸');await waitMode('travel');
      if(i===2){
        await page.reload({waitUntil:'domcontentloaded'});await page.locator('#enter').click();await waitMode('travel');
        assert.equal((await snapshot()).completed.length,3);await keyboard('j');await shot('journal-3');
        await click('回到河岸');report.checks.push('Three-record checkpoint survives reload and hand-book return');
      }
    }
    await click('走向黎明');await waitMode('finale');
    await page.waitForFunction(()=>document.querySelector('.jss-final-lines small')?.textContent.includes('空白'),null,{timeout:40000});await shot('finale');
    await click('跳至题记');await click('让证据保有原来的位置');await page.locator('#station-body').getByRole('button',{name:/回到河岸/}).click();
    assert.equal((await snapshot()).ending,true);
    const [download]=await Promise.all([page.waitForEvent('download'),click('保存我的河岸来信')]);
    assert.equal(download.suggestedFilename(),'金沙·河床来信.png');
    const letterFile=path.join(output,'my-river-letter.png');await download.saveAs(letterFile);
    const png=fs.readFileSync(letterFile);assert.equal(png.toString('ascii',1,4),'PNG');assert.equal(png.readUInt32BE(16),1500);assert.equal(png.readUInt32BE(20),1010);
    report.checks.push('Own photographs and selected inscription export to a 1500 × 1010 PNG');
    await click('回到河岸');await waitMode('travel');
    await keyboard('j');assert.equal(await page.locator('.ledger-list .known').count(),9);await shot('complete-ledger');
    await page.getByRole('combobox',{name:'翻看已获得的记录'}).selectOption('6');assert.equal(await page.locator('.film-strip img').count(),3);
    assert.ok(await page.locator('.film-strip img').evaluateAll(imgs=>imgs.every(img=>img.src.startsWith('data:image/jpeg;base64,'))));
    await shot('contact-prints');report.checks.push('Three player-captured photographs survive in the notebook');
    await page.getByRole('combobox',{name:'翻看已获得的记录'}).selectOption('3');await click(/重访选中地点/);await waitMode('travel');assert.equal((await snapshot()).site,'jade-cut');
    report.checks.push('Nine earned records, finale inscription, free exploration and replay destination');
    assert.deepEqual(report.issues,[]);report.ok=true;
  }catch(e){report.error=e.message;report.last=await snapshot().catch(()=>null);report.visible=await page.locator('body').innerText({timeout:5000}).catch(()=>'');await shot('failure').catch(()=>{});throw e;
  }finally{fs.writeFileSync(path.join(output,'playthrough.json'),JSON.stringify(report,null,2));await browser.close();}
}
check().catch(e=>{console.error(e);process.exitCode=1;});

