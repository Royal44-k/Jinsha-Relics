import fs from 'node:fs';
import * as T from 'three';
import {createAdventureWorld} from '../src/v5/adventure-world.js';
import {createMomentDirector} from '../src/v6/director.js';
import {createCameraClearance} from '../src/v7/camera-clearance.js';

const scene=new T.Scene(),forest={length:400,path:new T.LineCurve3(new T.Vector3(),new T.Vector3(0,0,-400)),sample:d=>new T.Vector3(0,0,-d),sampleGround:()=>0},traversal={perches:[],groundAt:()=>0};
const world=createAdventureWorld({scene,forest,traversal,saved:{root:{slots:[0,1,2]}}}),focus=new T.Vector3().fromArray(world.snapshot().rootLife.position),colliders=world.cameraColliders.filter(o=>o.userData.cameraSubject!=='rebirth-root'),clearance=createCameraClearance(),ray=new T.Raycaster();
scene.updateMatrixWorld(true);clearance.prepare(colliders);
const report={at:new Date().toISOString(),scope:'CPU raycasts against actual V9 root geometry with tagged subject meshes excluded; no forest or rendered image. Director input uses actual main.js function text.',excludedMeshes:world.cameraColliders.filter(o=>o.userData.cameraSubject==='rebirth-root').length,rootFocus:focus.toArray(),rayCases:0,nearObstructions:[],input:[]};
for(let angleIndex=0;angleIndex<144;angleIndex++){
 const angle=angleIndex*Math.PI*2/144,anchor=focus.clone().add(new T.Vector3(Math.sin(angle)*1.5,0,Math.cos(angle)*1.5)),context={position:anchor,yaw:angle,motion:{mode:'grounded',speed:0},playing:true,reduced:false,manualInput:false};
 const director=createMomentDirector();director.play({id:'rebirth',focus:focus.toArray()},context);
 for(let frame=0;frame<18*30;frame++){
  const shot=director.update(1/30,context);if(!shot||shot.weight<.999)continue;
  const dir=shot.position.clone().sub(shot.target);ray.set(shot.target,dir.clone().normalize());ray.far=dir.length();const hit=clearance.first(ray,colliders);report.rayCases++;
  if(hit&&hit.distance<1.7){report.nearObstructions.push({angle:angleIndex*2.5,second:(frame+1)/30,hitDistance:hit.distance,mesh:hit.object.name||'(unnamed root)',parent:hit.object.parent?.name,target:shot.target.toArray()});break;}
 }
}
const main=fs.readFileSync('src/v2/main.js','utf8'),contextText=main.slice(main.indexOf('function directorContext()'),main.indexOf('\nfunction playMoment(')),applyText=main.slice(main.indexOf('function applyMomentCamera('),main.indexOf('\nfunction headingAt('));
report.actualCameraApply=[];
for(const angleDegrees of [0,125,340]){
 const a=angleDegrees*Math.PI/180,anchor=focus.clone().add(new T.Vector3(Math.sin(a)*1.5,0,Math.cos(a)*1.5)),context={position:anchor,yaw:a,motion:{mode:'grounded',speed:0},playing:true,reduced:false,manualInput:false},director=createMomentDirector(),camera=new T.PerspectiveCamera(48,16/9,.08,150);
 director.play({id:'rebirth',focus:focus.toArray()},context);let shot;for(let i=0;i<60;i++)shot=director.update(1/60,context);
 camera.position.copy(anchor).add(new T.Vector3(0,1.17,4.25));
 const deps={THREE:T,camera,cameraTarget:anchor.clone().add(new T.Vector3(0,.85,0)),ray:new T.Raycaster(),traversal:{sample:()=>({terrainHeight:0})},cameraClearance:clearance,visibleCameraColliders:()=>world.cameraColliders,position:anchor,director,activeShot:shot};
 const apply=new Function('deps','with(deps){'+applyText+';return applyMomentCamera;}')(deps);apply(shot);
 report.actualCameraApply.push({angleDegrees,elapsed:1,shotStillActive:director.snapshot().active,cameraPosition:camera.position.toArray()});
}
for(const code of ['KeyW','Space','KeyX','KeyV','KeyR']){
 const deps={state:{mode:'playing'},settings:{reduced:false},position:focus.clone().add(new T.Vector3(0,0,3)),yaw:0,motion:{state:{mode:'grounded',speed:0}},drag:null,touch:{x:0,y:0},keys:new Set()},makeContext=new Function('deps','with(deps){'+contextText+';return directorContext;}')(deps),director=createMomentDirector();
 director.play({id:'rebirth',focus:focus.toArray()},makeContext());director.update(1/60,makeContext());deps.keys.add(code);
 const c=makeContext();director.update(1/60,c);report.input.push({code,manualInput:c.manualInput,activeAfterFirstInputFrame:director.snapshot().active});
}
report.actionFunctions=[];
for(const name of ['jump','dash','toggleCruise','requestPerch']){
 const position=focus.clone().add(new T.Vector3(0,0,3)),context={position,yaw:0,motion:{mode:'grounded',speed:0},playing:true,reduced:false,manualInput:false},director=createMomentDirector();director.play({id:'rebirth',focus:focus.toArray()},context);director.update(1/60,context);
 let invoked=0;const deps={state:{mode:'playing'},director,activeShot:{id:'rebirth'},perchCandidate:null,motion:{state:{mode:'grounded',speed:0},jump(){invoked++;return true;},dash(){invoked++;return true;},toggleCruise(){invoked++;return true;},requestPerch(){invoked++;return true;},getPerchCandidate:()=>({distance:1})},movementInput:()=>({}),travelFeedback(){}};
 const source=main.split('\n').find(line=>line.startsWith('function '+name+'(')),action=new Function('deps','with(deps){'+source+';return '+name+';}')(deps);action();
 report.actionFunctions.push({name,shortPressReleasedBeforeRAF:true,actionInvoked:invoked,shotStillActive:director.snapshot().active});
}
world.dispose();fs.mkdirSync('docs/v9/character/review',{recursive:true});fs.writeFileSync('docs/v9/character/review/tree-camera-cpu-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,nearObstructions:report.nearObstructions.slice(0,2)},null,2));
