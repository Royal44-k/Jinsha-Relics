const fs=require('node:fs');
const firstSites=require('./solve-first-sites-v11.cjs');
const {walkIvory,walkSunfoil,walkNinePosts,walkDawn}=require('./walk-sanctuary-v11.cjs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=process.env.JINSHA_PROOF||path.join(root,'docs/v12/campaign');
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
  page.on('pageerror',e=>{console.error('Page exception',e.stack);report.issues.push(e.stack||e.message);});
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
  async function activity(i){
    if(i===0){
      await click('打开剖面放大镜');
      const lens=page.locator('#strata-dialog');
      await lens.getByRole('button',{name:'放大 2.8×'}).click();
      await lens.getByRole('button',{name:'换到东窗'}).click();
      await lens.locator('canvas').focus();await keyboard('ArrowDown');await shot('strata-lens');
      await keyboard('Escape');await lens.waitFor({state:'detached'});await waitMode('activity');
      assert.equal((await snapshot()).completed.length,0);
      report.checks.push('An optional enlarged cross-section supports keyboard depth selection and specimen comparison without interrupting the dig');
      const r=await page.locator('.js-field canvas').boundingBox(),s=Math.min(r.width/1020,r.height/560);
      const at=(x,y)=>[r.x+(r.width-900*s)/2+x*s,r.y+(r.height-400*s)/2+(6+y)*s];
      const seam=x=>221+.054*(x-430)+12*Math.sin(x*.008)+5*Math.sin(x*.025);
      for(const x of [224,648]){const points=[];for(let k=0;k<4;k++)for(const dx of (k%2?[42,24,8,-8,-24,-42]:[-42,-24,-8,8,24,42]))points.push(at(x+dx,seam(x)-33+22*k));await drag(points);}
      await click('改用记录针');for(const x of [224,648])await page.mouse.click(...at(x,seam(x)));await firstSites.sieve(page);
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
      await page.keyboard.up('ArrowRight');await page.keyboard.up('ArrowUp');await firstSites.transit(page);
    }else if(i===2){
      await firstSites.roots(page);
    }else if(i===3){
      await page.locator('.at-view canvas').focus();
      for(const k of ['ArrowLeft','s','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','w','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight'])await keyboard(k);
      await page.locator('[data-action=jade-turn-right]').waitFor();
      const r=await page.locator('.at-view').boundingBox();
      await drag([[r.x+r.width*.45,r.y+r.height*.55],[r.x+r.width*.45+110,r.y+r.height*.55]]);
      await page.locator('[data-action=jade-record]').click();
    }else if(i===4){
      await page.locator('[data-action=widen]').click();await page.locator('[data-action=gauge]').click();
      for(let s=0;s<3;s++){for(let k=0;k<[2,2,3][s];k++)await page.locator('[data-action='+ (s===1?'rotate-left':'rotate-right')+']').click();
        const a=await page.locator('.at-shard-pin').boundingBox(),b=await page.locator('.at-target-pin').boundingBox();
        await drag([[a.x+a.width/2,a.y+a.height/2],[b.x+b.width/2,b.y+b.height/2]]);}
      const r=await page.locator('.at-view').boundingBox();await drag([[r.x+r.width*.4,r.y+r.height*.61],[r.x+r.width*.4+105,r.y+r.height*.61]]);
      await page.locator('[data-action=clay-record]').click();
    }else if(i===5){
      const act=name=>page.locator('[data-action='+name+']').click();
      await act('support-view');await click('标出薄尾');
      await act('support-test');await page.waitForFunction(()=>document.querySelector('.at-feedback').textContent.includes('尾端下沉'));
      await page.waitForTimeout(1120);
      await act('support-right');await act('support-right');await act('support-right');
      await act('support-select');for(let k=0;k<6;k++)await act('support-right');await act('support-test');
    }else if(i===6){
      await walkIvory(page);
    }else if(i===7){
      await walkSunfoil(page);
    }else{await walkNinePosts(page);}
  }
  try{
    await page.goto(origin,{waitUntil:'domcontentloaded'});await page.locator('#enter').waitFor();
    report.bundle=await page.locator('script[type=module]').first().getAttribute('src');await shot('00-title');
    await page.locator('#enter').click();
    await click('九柱方位');assert.match(await page.locator('.witness p').innerText(),/冬至/);await click('旧河岸');
    await page.waitForFunction(()=>document.querySelector('.witness img').naturalWidth>0);await shot('00-prologue');
    report.checks.push('Selectable field evidence reveals a distinct visual and research question before departure');
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
      if(i===0){
        await shot('first-discovery');
        await page.locator('.jc-quiz summary').click();
        const answers=page.locator('.jc-options button');const count=await answers.count();
        for(let j=0;j<count&&await answers.count();j++)await answers.nth(j).click();
        assert.equal((await snapshot()).collection.quizzes.length,1);
        report.checks.push('First collection identification awards XP on the live receipt');
      }
      if(i===1){await click(/^随烁羽前往/);await waitMode('travel');await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().near,null,{timeout:120000});}
      else{await click('自行探索');await waitMode('travel');}
      if(i===2){
        await page.reload({waitUntil:'domcontentloaded'});await page.locator('#enter').click();await waitMode('travel');
        assert.equal((await snapshot()).completed.length,3);await keyboard('j');await shot('journal-3');
        await click('回到河岸');report.checks.push('Three-record checkpoint survives reload and hand-book return');
      }
    }
    await click('进入冬至候日');await waitMode('finale');await shot('finale');await walkDawn(page,{watch:true});
    await waitMode('receipt');assert.equal((await snapshot()).ending,true);
    const printFrames=page.locator('#folio .js-print-frame');
    assert.equal(await printFrames.count(),3);
    const triptychCaptions=await printFrames.allInnerTexts();
    const imposed=await page.evaluate(()=>JSON.parse(localStorage.getItem('jinsha-ancient-shu-v11')).fieldTriptych);
    assert.ok(imposed.length===3&&imposed.every((id,row)=>destinations.slice(row*3,row*3+3).includes(id)));
    await shot('solstice');
    report.checks.push('A measured baseline leads through the playable winter sunrise to the museum ending');
    await click('进入金面具特展');await page.locator('.gold-mask-room[data-mode="live"]').waitFor();
    await page.locator('.gold-mask-views [data-view="back"]').click();
    await page.waitForFunction(()=>document.querySelector('.gold-mask-plate img')?.naturalWidth>0);
    await page.locator('.gold-mask-live canvas').waitFor({timeout:30000});
    await shot('gold-mask');await click('返回河岸');await waitMode('travel');await keyboard('j');
    assert.equal(await button('金面具特展').isVisible(),true);
    await click('我的终章展签');assert.deepEqual(await printFrames.allInnerTexts(),triptychCaptions);
    await click('回到手册');report.checks.push('Three archived field prints persist in this journey and reopen from its journal');
    report.checks.push('Ending unlocks a repeatable mask exhibit with an interactive rendered reverse view');
    await click('回到河岸');await waitMode('travel');
    await keyboard('j');assert.equal(await page.locator('.ledger-list .known').count(),9);await shot('complete-ledger');
    await page.getByRole('combobox',{name:'翻看已获得的记录'}).selectOption('6');assert.equal(await page.locator('.film-strip img').count(),3);
    assert.ok(await page.locator('.film-strip img').evaluateAll(imgs=>imgs.every(img=>img.src.startsWith('data:image/jpeg;base64,'))));
    await shot('contact-prints');report.checks.push('Three player-captured photographs survive in the notebook');
    await page.getByRole('combobox',{name:'翻看已获得的记录'}).selectOption('3');await click(/重访选中地点/);await waitMode('travel');assert.equal((await snapshot()).site,'jade-cut');
    report.checks.push('Nine earned records, winter solstice ending, free exploration and replay destination');
    async function track(name){
      await keyboard('j');await waitMode('journal');
      await page.locator('summary',{hasText:'地图支线'}).click();await click(name);await waitMode('travel');
    }
    await track('追踪主线');assert.equal((await snapshot()).site,'nine-posts');
    if(!(await snapshot()).near){await page.locator('#guide').click();await page.waitForFunction(()=>window.__JINSHA_SURVEY__.snapshot().near);}
    await page.locator('#interact').click();await waitMode('finale');await page.locator('#leave').click();await waitMode('travel');
    await track(/标记 · 西岸织棚/);await page.locator('#guide').click();
    await page.waitForFunction(()=>!document.getElementById('interact').hidden&&document.getElementById('interact').textContent.includes('西岸织棚'));
    await track(/标记 · 东台石场/);
    await page.waitForFunction(()=>document.getElementById('place').textContent==='东台石场'&&document.getElementById('interact').textContent.includes('西岸织棚'));
    report.checks.push('Switching from a replay to the main route restores the finale, and a tracked destination stays distinct from a nearby interaction');
    assert.deepEqual(report.issues,[]);report.ok=true;
  }catch(e){report.error=e.message;report.last=await snapshot().catch(()=>null);report.visible=await page.locator('body').innerText({timeout:5000}).catch(()=>'');await shot('failure').catch(()=>{});throw e;
  }finally{fs.writeFileSync(path.join(output,'playthrough.json'),JSON.stringify(report,null,2));await browser.close();}
}
check().catch(e=>{console.error(e);process.exitCode=1;});
