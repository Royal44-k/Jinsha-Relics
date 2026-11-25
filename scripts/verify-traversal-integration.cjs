const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=process.env.JINSHA_URL||'http://127.0.0.1:5186';

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const page=await browser.newPage();
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.route('**/__physics-world-check.html',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><title>Isolated locomotion verification</title><script type="module">
    import * as THREE from '/node_modules/three/build/three.module.js';
    import {createForest} from '/src/v2/world.js';
    import {createTraversalWorld} from '/src/v3/traversal-world.js';
    import {createLocomotion} from '/src/v3/locomotion.js';
    const scene=new THREE.Scene(),forest=createForest(scene),world=createTraversalWorld(scene,forest);
    window.physics={THREE,scene,forest,world,createLocomotion};
  </script>`}));
  try {
    await page.goto(`${base}/__physics-world-check.html`);
    await page.waitForFunction(()=>window.physics,{timeout:60000});
    const report=await page.evaluate(scope=>{
      const {THREE,forest,world,createLocomotion}=window.physics;
      const dt=1/90,checks=[],events=[],failures=[];
      const vector=p=>new THREE.Vector3(...p);
      const at=f=>{const p=forest.sample(f*forest.length);p.y=world.sample(p).groundHeight;return p;};
      const make=p=>createLocomotion({world,position:p.clone(),onEvent:e=>events.push(e)});
      const snap=c=>{const s=c.getSnapshot();return {mode:s.mode,position:s.position.map(v=>+v.toFixed(3)),speed:+s.speed.toFixed(3),stamina:+s.stamina.toFixed(3),oxygen:+s.oxygen.toFixed(3),perchId:s.perchId,boundaryMessage:s.boundaryMessage};};
      function check(name,pass,detail){checks.push({name,pass,...detail});if(!pass)failures.push(name);}
      function advance(c,seconds,input={}){for(let i=0;i<Math.round(seconds/dt);i++)c.update(dt,input);}
      function toward(c,target,seconds,extra={}){
        let minimumHeight=Infinity,maximumSpeed=0,enteredWater=false,maxDistance=0;
        for(let i=0;i<Math.round(seconds/dt);i++){
          const dx=target.x-c.position.x,dz=target.z-c.position.z,d=Math.hypot(dx,dz);
          maxDistance=Math.max(maxDistance,d);
          const ascend=extra.fly?c.position.y<extra.fly:!!extra.ascend;
          c.update(dt,{moveZ:d>.18?Math.min(1,d/1.2):0,yaw:Math.atan2(-dx,-dz),...extra,ascend});
          minimumHeight=Math.min(minimumHeight,c.position.y);maximumSpeed=Math.max(maximumSpeed,c.state.speed);
          enteredWater ||= c.state.mode==='swimming'||c.state.mode==='diving';
        }
        return {distance:Math.hypot(target.x-c.position.x,target.z-c.position.z),minimumHeight,maximumSpeed,enteredWater,maxDistance};
      }
      function reach(c,target,seconds=6){
        let steps=0;
        for(;steps<Math.round(seconds/dt);steps++){
          const dx=target.x-c.position.x,dz=target.z-c.position.z,d=Math.hypot(dx,dz);
          if(d<.32)break;
          c.update(dt,{moveZ:Math.min(1,d/1.2),yaw:Math.atan2(-dx,-dz),sprint:true});
        }
        return {reached:Math.hypot(target.x-c.position.x,target.z-c.position.z)<.32,seconds:+(steps*dt).toFixed(2),state:snap(c),target:target.toArray().map(v=>+v.toFixed(3))};
      }
      if(scope==='structures'){
        const tangent=forest.path.getTangentAt(.575),right=new THREE.Vector3(-tangent.z,0,tangent.x);
        const house=forest.sample(forest.length*.575).addScaledVector(right,-9);house.y=world.groundAt(house);
        const rotation=new THREE.Euler(0,Math.atan2(tangent.x,tangent.z),0);
        const local=(x,z,y=0)=>new THREE.Vector3(x,y,z).applyEuler(rotation).add(house);
        const entrance=local(0,-3.7);entrance.y=world.sample(entrance).groundHeight;
        const platform=local(0,0,.715),c=make(entrance),levels=[],start=snap(c);
        for(let i=0;i<90*5;i++){
          const dx=platform.x-c.position.x,dz=platform.z-c.position.z,d=Math.hypot(dx,dz);
          c.update(dt,{moveZ:d>.17?Math.min(1,d/1.2):0,yaw:Math.atan2(-dx,-dz)});
          const level=+(c.position.y-house.y).toFixed(3);if(!levels.includes(level)&&[.22,.44,.715].some(v=>Math.abs(level-v)<.01))levels.push(level);
        }
        const up=snap(c),upDistance=Math.hypot(c.position.x-platform.x,c.position.z-platform.z);
        check('wooden steps enter platform without jumping',upDistance<.5&&c.state.mode==='grounded'&&Math.abs(c.position.y-platform.y)<.01&&levels.length===3,{start,end:up,houseBase:+house.y.toFixed(3),stepLevels:levels,targetDistance:+upDistance.toFixed(3),obstacles:events.filter(e=>e.type==='obstacle').map(e=>e.text)});
        const exit=reach(c,entrance,6);advance(c,.5);
        check('wooden steps return from platform to ground',exit.reached&&c.state.mode==='grounded'&&Math.abs(c.position.y-world.groundAt(c.position))<.03,{...exit,end:snap(c)});

        const nine=world.landmarks.find(l=>l.id==='nine-posts').position.clone(),postTangent=forest.path.getTangentAt(.84),postForward=new THREE.Vector3(postTangent.x,0,postTangent.z).normalize();
        const postStart=nine.clone().addScaledVector(postForward,-.9);postStart.y=world.sample(postStart).groundHeight;
        const postEnd=nine.clone().addScaledVector(postForward,.9);postEnd.y=world.sample(postEnd).groundHeight;
        const walker=make(postStart);const walking=toward(walker,postEnd,1.5);
        const distanceToPost=Math.hypot(walker.position.x-nine.x,walker.position.z-nine.z),forward=walker.position.clone().sub(nine).dot(postForward);
        check('nine-post column blocks the walking body',forward<-.3&&distanceToPost>=.42,{state:snap(walker),distanceToPost:+distanceToPost.toFixed(3),forward:+forward.toFixed(3),targetDistance:+walking.distance.toFixed(3)});
        const flyer=make(postStart);flyer.jump();advance(flyer,1.6,{ascend:true});const over=toward(flyer,postEnd,2.5,{fly:postStart.y+5});
        check('powered flight passes above the nine-post column',over.distance<.4&&flyer.position.y>world.groundAt(nine)+3.1,{state:snap(flyer),targetDistance:+over.distance.toFixed(3)});
        const hutPost=local(2,-1.7),hutStart=local(1.1,-1.7,.715),hutEnd=local(2.9,-1.7,.715),hutWalker=make(hutStart);
        toward(hutWalker,hutEnd,1.5);const hutDistance=Math.hypot(hutWalker.position.x-hutPost.x,hutWalker.position.z-hutPost.z);
        check('hut corner post blocks a walker on the platform',hutDistance>=.39&&hutWalker.position.distanceTo(hutEnd)>.8,{state:snap(hutWalker),distanceToPost:+hutDistance.toFixed(3)});
        const hutFlyer=make(hutStart);hutFlyer.jump();advance(hutFlyer,1.6,{ascend:true});const hutOver=toward(hutFlyer,hutEnd,2.5,{fly:house.y+5.7});
        check('powered flight clears the hut post above roof height',hutOver.distance<.4&&hutFlyer.position.y>house.y+3.8,{state:snap(hutFlyer),targetDistance:+hutOver.distance.toFixed(3)});
        return {date:new Date().toISOString(),scope,checks,failures,eventCounts:events.reduce((counts,event)=>(counts[event.type]=(counts[event.type]||0)+1,counts),{})};
      }
      let c=make(at(.015));const walkStart=c.position.clone();
      const walking=toward(c,at(.035),7);
      check('actual forest ground walking',c.position.distanceTo(walkStart)>4&&c.state.mode==='grounded'&&Math.abs(c.position.y-world.sample(c.position).groundHeight)<.02,{state:snap(c),travel:+c.position.distanceTo(walkStart).toFixed(3),targetDistance:+walking.distance.toFixed(3)});

      c=make(at(.31-11/forest.length));c.jump();advance(c,1.5,{ascend:true});
      const gorgeStart=snap(c),gorgeTarget=at(.31+11/forest.length),crossing=toward(c,gorgeTarget,7,{fly:5.2});
      check('powered flight crosses actual ravine',crossing.distance<1.2&&crossing.minimumHeight>1,{start:gorgeStart,end:snap(c),target:gorgeTarget.toArray(),minimumHeight:+crossing.minimumHeight.toFixed(3),targetDistance:+crossing.distance.toFixed(3)});
      c.land();advance(c,7);
      check('ravine far bank accepts stable landing',c.state.mode==='grounded'&&Math.abs(c.position.y-world.sample(c.position).groundHeight)<.02,{state:snap(c)});

      const pool=world.pool.clone();c=make(at(.215));const riverStart=snap(c),river=toward(c,pool,10);
      check('walking from bank enters actual river',river.enteredWater&&c.state.mode==='swimming'&&c.position.y<world.sample(c.position).waterLevel,{start:riverStart,end:snap(c),targetDistance:+river.distance.toFixed(3),water:world.sample(c.position)});
      c.dive();advance(c,3.5,{descend:true});const bed=world.sample(c.position).groundHeight;
      check('diving stops above actual river bed',c.state.mode==='diving'&&c.position.y< -1.4&&c.position.y>=bed+.17&&c.state.oxygen<1,{state:snap(c),riverBed:+bed.toFixed(3)});
      advance(c,3,{ascend:true});
      check('actual river ascent restores swimming',c.state.mode==='swimming'&&c.position.y>-.9,{state:snap(c)});
      const shore=toward(c,at(.215),11);
      check('swimming exits onto the real bank without catching the lip',c.state.mode==='grounded'&&shore.distance<.6,{state:snap(c),targetDistance:+shore.distance.toFixed(3)});

      const bridge=world.bridges[0];
      for(const direction of [-1,1]){
        const entrance=bridge.centre.clone().addScaledVector(bridge.tangent,direction*(bridge.length/2+1.5));entrance.y=world.sample(entrance).groundHeight;
        const exit=bridge.centre.clone().addScaledVector(bridge.tangent,-direction*(bridge.length/2+1.5));exit.y=world.sample(exit).groundHeight;
        c=make(entrance);const result=reach(c,exit,14);
        check(`log bridge crosses on foot direction ${direction}`,result.reached&&c.state.mode==='grounded',{...result,entrance:entrance.toArray().map(v=>+v.toFixed(3))});
      }

      c=make(at(.01));const routeFailures=[];let routeSeconds=0;
      const waypoints=[];
      for(let d=forest.length*.01+1.4;d<forest.length*.98;d+=1.4){
        if(Math.abs(d-forest.length*.31)<13)continue;
        if(d>forest.length*.31+13&&!waypoints.some(p=>p.bridge)){
          for(const sign of [-1,1]){const p=bridge.centre.clone().addScaledVector(bridge.tangent,sign*(bridge.length/2+1));p.y=world.sample(p).groundHeight;p.bridge=true;waypoints.push(p);}
        }
        waypoints.push(at(d/forest.length));
      }
      for(let index=0;index<waypoints.length;index++){
        const span=Math.hypot(waypoints[index].x-c.position.x,waypoints[index].z-c.position.z);
        const result=reach(c,waypoints[index],Math.max(6,span/3.3+2));routeSeconds+=result.seconds;
        if(!result.reached){routeFailures.push({waypoint:index,...result});if(routeFailures.length>=3)break;}
      }
      check('continuous main corridor with bridge bypass stays passable',routeFailures.length===0,{state:snap(c),pathFraction:+(forest.sampleMain(c.position).distance/forest.length).toFixed(3),simulatedSeconds:+routeSeconds.toFixed(2),blocked:routeFailures});

      c=make(at(.10));c.jump();advance(c,1.2,{ascend:true,moveZ:1});c.stop();const frozen=snap(c),pausedPosition=c.position.clone();
      c.update(0,{});const pausePreserved=c.position.equals(pausedPosition)&&c.velocity.length()===0;
      advance(c,1.5);const resumed=snap(c),save=c.getSnapshot();c.reset(vector(save.safePosition));
      check('airborne pause preserves position and safe save resumes on solid ground',pausePreserved&&resumed.position[1]<frozen.position[1]&&c.state.mode==='grounded'&&c.velocity.length()===0,{frozen,resumed,savedPosition:save.safePosition,state:snap(c)});

      for(const p of world.perches){
        const start=p.position.clone().add(new THREE.Vector3(0,.3,1));c=make(start);const perched=c.interact();advance(c,.5);
        const perchedState=snap(c),save=c.getSnapshot();c.stop();c.reset(vector(save.safePosition));const restored=c.state.mode==='perched'&&c.state.perchId===p.id;
        c.jump();advance(c,.4,{ascend:true});
        check(`actual ${p.id} perches and takes off`,perched&&restored&&perchedState.mode==='perched'&&c.state.mode==='flying'&&c.position.y>p.position.y,{perched:perchedState,restored,takeoff:snap(c)});
      }

      const centre=at(.70),tangent=forest.path.getTangentAt(.70),right=new THREE.Vector3(-tangent.z,0,tangent.x),edge=centre.clone().addScaledVector(right,-22);edge.y=world.sample(edge).groundHeight;
      c=make(edge);const before=events.length;const outYaw=Math.atan2(right.x,right.z);advance(c,4,{moveZ:1,yaw:outYaw,sprint:true});
      const edgeState=snap(c),warnings=events.slice(before).filter(e=>e.type==='boundary').length;
      toward(c,centre,13);const reentry=snap(c);c.stop();const stopped=c.velocity.length()===0;
      c.reset(at(.70));
      check('actual boundary warns once and allows retreat/reset',warnings>0&&warnings<=1&&edgeState.boundaryMessage!==''&&reentry.boundaryMessage===''&&stopped&&c.velocity.length()===0,{edge:edgeState,reentry,warnings,reset:snap(c)});

      const sun=forest.landmarks.find(l=>l.id==='sun');
      for(let i=0;i<4;i++){
        const angle=i*Math.PI/2,target=sun.position.clone().add(new THREE.Vector3(Math.cos(angle)*2.8,0,Math.sin(angle)*2.8));target.y=world.sample(target).groundHeight;
        c=make(at(.94));c.jump();advance(c,1.3,{ascend:true});const approach=toward(c,target,5,{fly:4.3});c.stop();c.land();advance(c,6);
        const distance=Math.hypot(c.position.x-target.x,c.position.z-target.z);
        check(`final sun position ${i+1} remains reachable`,distance<1.0&&c.state.mode==='grounded',{target:target.toArray().map(v=>+v.toFixed(3)),state:snap(c),distance:+distance.toFixed(3),approachDistance:+approach.distance.toFixed(3)});
      }
      return {date:new Date().toISOString(),pathLength:+forest.length.toFixed(3),checks,failures,eventCounts:events.reduce((counts,event)=>(counts[event.type]=(counts[event.type]||0)+1,counts),{})};
    },process.env.JINSHA_CHECK||'full');
    report.pageErrors=pageErrors;
    fs.mkdirSync(path.join(__dirname,'../docs/v3'),{recursive:true});
    fs.writeFileSync(path.join(__dirname,report.scope==='structures'?'../docs/v3/physics-structures-check.json':'../docs/v3/physics-world-check.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
    assert.deepEqual(report.failures,[],'actual-world traversal checks must pass');
    assert.deepEqual(pageErrors,[],'isolated world must initialize without browser errors');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
