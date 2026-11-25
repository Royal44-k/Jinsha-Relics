const {chromium}=require('playwright'),fs=require('node:fs');
const out='docs/v6/living-preview';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await p.route('**/@vite/client',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('case "update":','case "test-disabled-update":').replace('case "full-reload":','case "test-disabled-reload":')});});
await p.goto('http://127.0.0.1:5186/chapter-preview-v5.html');await p.waitForFunction(()=>window.ready,null,{timeout:120000});
const report=await p.evaluate(async()=>{const {createLivingWorld}=await import('/src/v6/living-world.js'),x=window.preview;window.living=createLivingWorld({scene:x.scene,forest:x.forest,traversal:x.world});return living.debug();});
for(const [i,id] of ['lantern-bough','river-mirror','wing-passage'].entries()){
await p.evaluate(({i,id})=>{const x=window.preview,T=x.THREE,pos=new T.Vector3().fromArray(living.debug().moments.find(m=>m.id===id).position),mode=['perched','diving','grounded'][i];
const input={playing:true,position:pos,motion:{mode,speed:0},listening:true,adventure:{inventory:{carried:true}}};for(let n=0;n<80;n++)living.update(.05,n*.05,input);if(i===2){input.motion.mode='flying';input.position.y+=2.5;for(let n=0;n<60;n++)living.update(.05,4+n*.05,input);}
x.camera.position.copy(pos).add(new T.Vector3(...[[3,1.5,5],[1.7,.1,3.5],[7,1.5,9]][i]));x.camera.lookAt(pos.clone().add(new T.Vector3(0,i===0?1.2:i===2?1.2:0,0)));x.frame(pos,[.105,.215,.665][i]);living.update(0,0,input);x.renderer.render(x.scene,x.camera);
},{i,id});await p.screenshot({path:out+'/'+id+'.png'});
}
report.errors=errors;report.snapshot=await p.evaluate(()=>living.snapshot());fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(errors.length)process.exitCode=1;
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
