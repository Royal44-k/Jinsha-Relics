const fs = require('fs');
const main='src/main.js';
let s=fs.readFileSync(main,'utf8');
s=s.replace("state.guiding=null;velocity.set(0,0,0);$('guide-status')", "state.guiding=null;yaw=Math.atan2(r.position[0]-playerPos.x,playerPos.z-r.position[2]);velocity.set(0,0,0);$('guide-status')");
s=s.replace('gl_FragColor=vec4(c,.8);','gl_FragColor=vec4(c,.8*(1.-smoothstep(70.,180.,length(vPos.xy))));');
fs.writeFileSync(main,s);
const test='scripts/smoke-test.cjs';let t=fs.readFileSync(test,'utf8');t=t.replace("await page.screenshot({path:'docs/ending.png'})", "await page.waitForTimeout(3200);await page.screenshot({path:'docs/ending.png'})");fs.writeFileSync(test,t);
