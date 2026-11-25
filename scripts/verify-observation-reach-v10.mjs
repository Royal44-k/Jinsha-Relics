import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';

const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
let browser;
try{
  await server.listen();
  const origin='http://127.0.0.1:'+server.httpServer.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.JINSHA_EDGE||(fs.existsSync(edge)?edge:undefined),args:['--disable-gpu']});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/physical-observations',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>旁注物理核验</title>'}));
  await page.goto(origin+'/physical-observations');
  const result=await page.evaluate(async()=>{
    const [T,{createLocomotion},{createStations},{createLandscape},{createFieldReading},{createSurveyWorld,sites,ground},{postOffsets},{chapterIds,skillLevel}]
      =await Promise.all([
        import('/node_modules/three/build/three.module.js'),import('/src/v3/locomotion.js'),import('/src/v10/stations.js'),
        import('/src/v10/landscape.js'),import('/src/v10/field-reading.js'),import('/src/v10/geography.js'),
        import('/src/v10/post-layout.js'),import('/src/v10/ledger.js')
      ]);
    const complete=Object.freeze(chapterIds.slice()),count=complete.length,world=createSurveyWorld(),scene=new T.Scene();
    createLandscape(scene,world);
    const stations=createStations(scene,world);await stations.ready;
    const [bx,bz]=sites[1],position=new T.Vector3(bx,ground(bx,bz),bz);
    const report={scope:'Single continuous controller-level run in the actual river terrain, station collision and reading systems. Headless browser without WebGL rendering.',
      fixture:{completed:Object.freeze(complete.slice()),start:'Dry ground at the normal ferry station centre. No progress written; no position, stamina, mode, perch or observation injected after spawning.'},
      input:'Key edges and held inputs passed to the same locomotive commands and 2.15 rad/s yaw law as traverse.js. This is a fixed-step physical simulation, not a DOM keyboard or device rendering test.',
      observations:[],milestones:[],checks:[],events:[],modes:[],actualCourse:null};
    const round=v=>Math.round(v*1000)/1000,vec=p=>p.toArray().map(round);
    let seconds=0,distance=0,yaw=0,previousKeys=new Set(),previousMode='',active;
    const motion=createLocomotion({world,position,onEvent:e=>{if(report.events.length<100)report.events.push({t:round(seconds),event:e.type,perch:e.perchId});}});
    motion.setGrowth({airEfficiency:1-.085*skillLevel(count),dashRecovery:1-.10*skillLevel(count)});
    const reading=createFieldReading(scene,id=>report.observations.push({id,t:round(seconds),xyz:vec(position),mode:motion.state.mode,perch:motion.state.perchId,trace:reading.active}));
    const overlay=scene.children.at(-1);
    const driftwood=overlay.children.find(g=>g.children.length===2&&g.children.every(c=>c.geometry?.type==='CylinderGeometry'));
    const columns=overlay.children.find(g=>g.children.length===9&&g.children.every(c=>c.geometry?.type==='BoxGeometry'));
    const log=driftwood.position.clone(),centre=postOffsets[4],cx=sites[8][0]+centre[0],cz=sites[8][1]+centre[1];
    const check=(label,pass)=>{if(!pass)throw Error(label);report.checks.push(label);};
    const snapshot=label=>report.milestones.push({label,t:round(seconds),xyz:vec(position),mode:motion.state.mode,stamina:round(motion.state.stamina),oxygen:round(motion.state.oxygen)});
    const has=id=>report.observations.some(o=>o.id===id);
    const dt=1/60,old=new T.Vector3();
    function tick(codes=[]){
      const held=new Set(codes);
      for(const code of codes)if(!previousKeys.has(code)){
        if(code==='Space')motion.jump();
        if(code==='R')motion.toggleCruise();
        if(code==='C')motion.dive();
        if(code==='T')motion.requestPerch();
        if(code==='Q')reading.toggle(count);
      }
      yaw+=(Number(held.has('A'))-Number(held.has('D')))*dt*2.15;
      old.copy(position);
      motion.update(dt,{yaw,moveZ:Number(held.has('W'))-Number(held.has('S')),moveX:0,sprint:held.has('Shift'),ascend:held.has('Space'),descend:held.has('C')});
      seconds+=dt;distance+=position.distanceTo(old);
      stations.update(seconds,count,position);reading.update(dt,count,motion.state,position);
      if(motion.state.mode!==previousMode){report.modes.push({t:round(seconds),mode:motion.state.mode});previousMode=motion.state.mode;}
      previousKeys=held;
    }
    function hold(seconds,codes=[]){for(let i=0;i<Math.ceil(seconds/dt);i++)tick(codes);}
    function until(label,predicate,input,maxSeconds){
      active=label;
      for(let i=0;i<Math.ceil(maxSeconds/dt);i++){if(predicate())return;tick(input());}
      throw Error(label+' timed out at '+vec(position)+' in '+motion.state.mode+'. Nearest perch '+JSON.stringify(motion.getPerchCandidate()));
    }
    function travel(label,x,z,tolerance,limit){
      until(label,()=>Math.hypot(position.x-x,position.z-z)<=tolerance,()=>{
        const dx=position.x-x,dz=position.z-z,wanted=Math.atan2(dx,dz);
        const delta=Math.atan2(Math.sin(wanted-yaw),Math.cos(wanted-yaw)),keys=[];
        if(Math.abs(delta)>.025)keys.push(delta>0?'A':'D');
        if(Math.abs(delta)<.25)keys.push('W');
        return keys;
      },limit);
    }
    function nearestLogGap(){
      driftwood.updateWorldMatrix(true,true);let gap=Infinity;
      for(const m of driftwood.children){const p=m.geometry.parameters,h=p.height/2;
        const bottom=m.localToWorld(new T.Vector3(0,-h,0)),top=m.localToWorld(new T.Vector3(0,h,0)),axis=new T.Line3(bottom,top),at=axis.closestPointToPointParameter(position,true);
        const radius=T.MathUtils.lerp(p.radiusBottom,p.radiusTop,at);
        gap=Math.min(gap,axis.at(at,new T.Vector3()).distanceTo(position)-radius);}
      return Math.max(0,gap);
    }
    try{
      hold(.8);snapshot('Ferry ground start');
      check('Spawned on dry bank',motion.state.mode==='grounded'&&world.sample(position).waterDepth===0);
      travel('Walk into the river and swim to the driftwood',log.x,log.z+.62,.36,22);hold(.85);snapshot('Surface beside the driftwood');
      check('Surface arrival leaves submerged-wood locked',motion.state.mode==='swimming'&&!has('submerged-wood'));
      until('Dive and stay beside the modeled wood',()=>has('submerged-wood')&&nearestLogGap()<.55,()=>['C'],6);
      snapshot('Dive beside the solid wood model');report.logSurfaceGapMeters=round(nearestLogGap());
      check('Driftwood awarded while diving beside the modeled wood',motion.state.mode==='diving'&&report.logSurfaceGapMeters>0&&report.logSurfaceGapMeters<.55);
      tick([]);until('Ascend from the river into flight',()=>motion.state.mode==='flying'&&position.y>1.0,()=>['Space'],6);
      tick([]);tick(['R']);tick([]);
      until('Gain altitude above the river',()=>position.y>6.6,()=>['Space'],5);hold(.45);
      travel('Cross the river to the jade shed',sites[3][0]+2.0,sites[3][1]+.18,.80,24);hold(.65);snapshot('Outside the jade canopy');
      const beam=world.perches.find(p=>p.id==='station-3-0');check('Jade beam exists on the discovered physical model',!!beam);
      check('Approaching the shed in the air gives no beam record',!has('beam-view'));
      until('Descend beside the front beam',()=>{const offer=motion.getPerchCandidate();return offer?.id===beam.id&&offer.canRequest&&position.y>=beam.position.y+.09&&position.y<=beam.position.y+1.15;},()=>['C'],7);
      tick([]);const offering=motion.getPerchCandidate();report.beamApproach={id:offering.id,distance:round(offering.distance),height:round(offering.height),speed:round(offering.speed),canRequest:offering.canRequest};
      tick(['T']);until('Actual T approach finishes and the survey holds',()=>has('beam-view'),()=>[],4);
      snapshot('Perched on the jade shed beam');report.beamContactErrorMeters=round(position.distanceTo(beam.position));
      check('Perch locked onto the actual station-3-0 beam',motion.state.mode==='perched'&&motion.state.perchId===beam.id&&report.beamContactErrorMeters<.01);
      hold(2.4);tick(['R']);tick([]);
      until('Climb to the long-distance crossing height',()=>position.y>10.25,()=>['Space'],6);hold(.25);
      travel('Fly the valley to the square post sockets',cx,cz,1.1,33);hold(1);
      const relative=position.y-ground(cx,cz);
      snapshot('Above the post court before tracing');check('Flying above the correct court without tracing gives no record',relative>=3&&!has('absent-posts')&&!reading.active);
      tick(['Q']);until('Read the absent posts',()=>has('absent-posts'),()=>[],2);snapshot('Trace active above the real sockets');
      report.postCourt={relativeHeight:round(position.y-ground(cx,cz)),horizontalDistance:round(Math.hypot(position.x-cx,position.z-cz)),visibleColumns:columns.visible?columns.children.filter(m=>m.scale.y>.2).length:0};
      check('Nine reconstructed column meshes rise when tracing above the real court',reading.active&&report.postCourt.visibleColumns===9);
      hold(1);check('Each observation awarded exactly once',report.observations.map(o=>o.id).join(',')==='submerged-wood,beam-view,absent-posts');
      check('No recovery or forced reposition during the route',!report.events.some(e=>e.event==='recovery'));
    }catch(error){report.failure=String(error);report.last={active,xyz:vec(position),state:motion.state.mode,speed:round(motion.state.speed),stamina:round(motion.state.stamina),candidate:motion.getPerchCandidate()};}
    finally{report.actualCourse={simulatedSeconds:round(seconds),metersTraveled:round(distance),perchTargets:world.perches.length,collisionBodies:world.colliders.length};await Promise.all(stations.groups.map(g=>g.userData.assetReady));stations.dispose();}
    return report;
  });
  result.browserErrors=errors;
  const out=path.resolve('docs/v10/fieldwork/observation-reach.json');fs.writeFileSync(out,JSON.stringify(result,null,2));
  console.log(JSON.stringify({checks:result.checks,awards:result.observations,course:result.actualCourse,failure:result.failure,last:result.last,errors}));
  assert.deepEqual(errors,[]);assert.ifError(result.failure);assert.equal(result.observations.length,3);
}finally{await browser?.close();await server.close();}
