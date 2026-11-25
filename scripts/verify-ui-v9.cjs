const legacyEntry=require('./legacy-entry-v9.cjs');
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const OUT='docs/v9/ui',URL=legacyEntry();fs.mkdirSync(OUT,{recursive:true});
const inertVite=`export const createHotContext=()=>({accept(){},dispose(){},prune(){},invalidate(){},on(){},off(){},send(){},data:{}});export const updateStyle=(id,text)=>{let s=[...document.querySelectorAll('style[data-static-vite]')].find(s=>s.dataset.staticVite===id);if(!s){s=document.createElement('style');s.dataset.staticVite=id;document.head.append(s)}s.textContent=text};export const removeStyle=id=>{[...document.querySelectorAll('style[data-static-vite]')].find(s=>s.dataset.staticVite===id)?.remove()};export const injectQuery=url=>url;`;
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-gpu']}),report={at:new Date().toISOString(),scope:'Real HTML/CSS and view modules with explicit data fixtures. Main.js replaced to isolate layout; these are not full game or GPU tests.',checks:[],errors:[],views:[]};
 const check=(label,value)=>{assert.ok(value,label);report.checks.push(label);};
 try{
  for(const [name,width,height]of [['desktop',1440,900],['mobile',390,844],['compact',360,640],['landscape',844,390]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));
   await page.route('**/src/v2/main.js*',r=>r.fulfill({status:200,contentType:'text/javascript',body:'// Isolated layout fixture.'}));
   await page.route('**/@vite/client',r=>r.fulfill({status:200,contentType:'text/javascript',body:inertVite}));
   await page.goto(URL,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
   check(name+': no WebGL or substitute canvas',await page.locator('canvas').count()===0);
   check(name+': real concept image decoded',await page.locator('.load-art>img').evaluate(el=>el.complete&&el.naturalWidth>1500));
   await page.screenshot({path:OUT+'/loading-'+name+'.png'});
   check(name+': loading stages and status visible',await page.locator('#load-status').isVisible()&&await page.locator('.load-steps li').count()===4);
   await page.evaluate(()=>window.__bootFailed('角色资源暂时未能载入，请检查连接后重新开启。'));
   const retry=await page.locator('#load-retry').boundingBox(),help=await page.locator('#load-help').boundingBox();
   check(name+': recovery controls remain inside viewport',retry&&help&&retry.y>=0&&help.y+help.height<=height&&retry.x>=0&&retry.x+retry.width<=width);
   await page.screenshot({path:OUT+'/loading-retry-'+name+'.png'});
   await page.emulateMedia({reducedMotion:'reduce'});
   check(name+': reduced motion stops ambient loading animation',await page.evaluate(()=>document.getElementById('loading').getAnimations({subtree:true}).every(a=>a.playState!=='running')));
   await page.addStyleTag({url:'/src/v2/style.css'});
   await page.evaluate(async()=>{
    const {createGrowthUI}=await import('/src/v9/growth-ui.js');window.growthFixture=createGrowthUI({onOpen:()=>{document.getElementById('dialog-content').innerHTML=window.growthFixture.markup();document.getElementById('dialog').showModal();}});
    document.getElementById('loading').hidden=true;document.getElementById('hud').hidden=false;
    window.growthFixture.update({growth:{level:1,name:'青翎',essence:6,nextAt:10},inventory:{}},{mode:'playing'});
   });
   await page.locator('#v9-growth-button').click();await page.screenshot({path:OUT+'/growth-'+name+'.png'});
   check(name+': growth shows current and next concrete abilities',await page.locator('.v9-growth-card.is-current h3').textContent()==='青翎'&&await page.locator('.v9-growth-page').textContent().then(t=>t.includes('减少 20%')&&t.includes('再收获 4 点生息')));
   check(name+': growth has no horizontal overflow',await page.evaluate(()=>document.getElementById('dialog').scrollWidth<=document.getElementById('dialog').clientWidth+1));
   await page.keyboard.press('Escape');check(name+': native modal releases on Escape',!await page.locator('#dialog').evaluate(el=>el.open));
   await page.evaluate(async()=>{
    const {createExperienceUI}=await import('/src/v5/experience-ui.js');window.mapFixture=createExperienceUI();const s={mode:'playing',visible:true,distance:140,length:302,position:[-8,0,-140],inventory:{feathers:5,totalFeathers:12},stages:[['root','古根初醒',-15],['light','水镜引光',-80],['water','泥火归水',-148]].map(([id,title,z],i)=>({id,title,position:[i*8,0,z],done:i<2,discovered:true,progress:i<2?3:1,total:3})),encounters:[{id:'reed',title:'芦岸 · 滞息',story:'芦叶重新回应。',reward:'芦岸种火',discovered:true,cleared:false,position:[-6,0,-95]},{id:'stone',title:'石廊 · 回声',discovered:false,cleared:false,position:null}]};window.mapFixture.update(s);window.mapFixture.openMap(s);
   });
   await page.locator('#v9-map-encounter-list [data-stage="encounter:reed"]').click();
   check(name+': discovered seed selectable, unknown node not leaked',await page.locator('#v5-note-title').textContent()==='芦岸 · 滞息'&&await page.locator('.v9-encounter-pin').count()===1&&!(await page.locator('#v5-travel-map').textContent()).includes('石廊'));
   await page.screenshot({path:OUT+'/map-'+name+'.png'});
   await page.evaluate(async()=>{window.mapFixture.closeMap();document.getElementById('title-screen').hidden=true;document.getElementById('hud').hidden=true;document.getElementById('ending').hidden=false;const {updateEndingMemory}=await import('/src/v9/ending-memory.js');updateEndingMemory(document.getElementById('v9-ending-memory'),{growth:{name:'曜羽'},encounters:[{id:'reed',title:'芦岸',discovered:true,cleared:true},{id:'stone',title:'石廊',discovered:true,cleared:true},{id:'dusk',title:'暮原',discovered:true,cleared:true}]});});
   await page.screenshot({path:OUT+'/ending-'+name+'.png'});const returnButton=await page.locator('#return-world').boundingBox(),endingTitle=await page.locator('#ending h2').boundingBox();check(name+': ending keeps title and return action reachable',returnButton&&returnButton.y+returnButton.height<=height&&endingTitle.y>=0);check(name+': optional restoration changes the epilogue',await page.locator('.v9-epilogue-seeds .is-restored').count()===3&&(await page.locator('#v9-ending-memory').textContent()).includes('一个春天'));
   report.views.push({name,width,height,retry,help});await page.close();
  }
  check('no layout runtime errors',report.errors.length===0);
 }catch(error){report.failure=error.stack;throw error;}finally{await browser.close();fs.writeFileSync(OUT+'/layout-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,errors:report.errors,failure:report.failure}));}
})().catch(e=>{console.error(e);process.exitCode=1;});
