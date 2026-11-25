// Continuous keyboard approach audit. Read-only path sampling guides the test
// operator; there are no position writes or completion setters in this script.
const {chromium}=require('playwright'),fs=require('node:fs');const out='docs/v6/living-walk';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[],trace=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('**/@vite/client',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('case "update":','case "test-disabled-update":').replace('case "full-reload":','case "test-disabled-reload":')});});
await p.route('**/src/v2/main.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:await response.text()+'\nwindow.__LIVING_ROUTE__=f=>forest.sample(f*forest.length).toArray();'});});
await p.goto('http://127.0.0.1:5186/');await p.waitForFunction(()=>window.__JINSHA_V2__,null,{timeout:120000});await p.locator('#start-btn').click();
const snap=()=>p.evaluate(()=>window.__JINSHA_V2__.snapshot());const targets=await p.evaluate(()=>Array.from({length:27},(_,i)=>window.__LIVING_ROUTE__((i+1)*.01)));
await p.keyboard.down('KeyW');let first=false,stuck=0,last=null;
for(let waypoint=0;waypoint<targets.length;waypoint++){
 for(let step=0;step<40;step++){const s=await snap(),t=targets[waypoint],dx=t[0]-s.position[0],dz=t[2]-s.position[2];if(Math.hypot(dx,dz)<1.3)break;
  const angle=Math.atan2(-dx,-dz);await p.evaluate(a=>window.__JINSHA_V2__.look(a),angle);if(last&&Math.hypot(last[0]-s.position[0],last[2]-s.position[2])<.05)stuck++;else stuck=0;last=s.position;
  if(stuck>10){trace.push({event:'blocked',waypoint,state:s});waypoint=targets.length;break;}
  if(s.adventure.interaction?.id==='root-bud-0'&&!first){await p.keyboard.up('KeyW');await p.keyboard.press('KeyE');first=true;await p.waitForTimeout(900);await p.screenshot({path:out+'/first-bud-natural.png'});await p.keyboard.down('KeyW');}
  if(step%10===0)trace.push({waypoint,position:s.position,near:s.living.nearest?.id,hint:s.living.nearest?.hint,interaction:s.adventure.interaction?.id});await p.waitForTimeout(100);
 }
 if([6,12,18,23].includes(waypoint)){await p.screenshot({path:out+`/path-${waypoint}.png`});}
}
await p.keyboard.up('KeyW');fs.writeFileSync(out+'/report.json',JSON.stringify({date:new Date().toISOString(),firstBud:first,errors,trace,final:await snap()},null,2));console.log(JSON.stringify({firstBud:first,errors,last:trace.at(-1)}));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
