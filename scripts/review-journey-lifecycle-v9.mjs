import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from 'three';
import {readSave,writeSave} from '../src/v2/journey.js';
import {createAdventureWorld} from '../src/v5/adventure-world.js';
import {endingMemory} from '../src/v9/ending-memory.js';
const map=new Map(),storage={getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)},scene=new T.Scene(),forest={length:400,path:new T.LineCurve3(new T.Vector3(),new T.Vector3(0,0,-400)),sample:d=>new T.Vector3(0,0,-d),sampleGround:()=>0},traversal={perches:[],groundAt:()=>0},events=[],world=createAdventureWorld({scene,forest,traversal,onEvent:e=>events.push(e)}),report={at:new Date().toISOString(),scope:'Real writeSave/readSave, world restore/reset and endingMemory. Fixtures exercise stored completion/duplicate/corrupt identifiers; not a browser playthrough.',roundTrips:[]};
const rootSave={root:{slots:[0,1,2],held:null},light:{turns:[1,3,2]},water:{turns:[0,2,0]},trial:{completed:true},finale:{complete:true},feathers:['feather-1','invalid'],expedition:{cleared:[],discovered:[]}};
for(const count of [0,1,2,3]){
 const ids=['reed','stone','dusk'].slice(0,count),saved={...rootSave,expedition:{cleared:[...ids,...ids,'invalid'],discovered:[]}};
 writeSave({collected:new Set(['bird','jade','mask','tiger','sun']),distance:399,completed:true,adventure:saved,travel:{safePosition:[0,0,-399],safePerchId:null}},storage);
 const read=readSave(storage);assert.deepEqual(read.adventure.expedition.cleared,ids);world.restore(read.adventure,read.collected);
 const snapshot=world.snapshot(),ending=endingMemory(snapshot),before=world.serialize(),eventCount=events.length;
 for(let i=0;i<5;i++)world.restore(before,read.collected);
 const after=world.snapshot();assert.equal(after.growth.essence,snapshot.growth.essence);assert.equal(events.length,eventCount);assert.equal(ending.count,count);assert.equal(ending.level,'曜羽');assert.equal(traversal.perches.filter(p=>p.id==='reborn-root-bough').length,1);
 report.roundTrips.push({cleared:ids,essence:after.growth.essence,level:after.growth.level,epilogueCount:ending.count,restoreRewardEvents:events.length-eventCount,treePerches:traversal.perches.length});
}
world.reset();world.update(0,0,{position:new T.Vector3(),motion:{mode:'grounded',speed:0},playing:false});
const fresh=world.snapshot();assert.equal(fresh.growth.essence,0);assert.equal(fresh.growth.level,0);assert.ok(fresh.encounters.every(e=>!e.cleared&&!e.discovered));assert.equal(traversal.perches.filter(p=>p.id==='reborn-root-bough').length,0);assert.equal(fresh.rootLife.progress,0);
report.newJourney={essence:fresh.growth.essence,level:fresh.growth.level,knownEncounters:fresh.encounters.filter(e=>e.discovered).length,treeProgress:fresh.rootLife.progress,treePerches:traversal.perches.length};world.dispose();fs.mkdirSync('docs/v9/character/review',{recursive:true});fs.writeFileSync('docs/v9/character/review/journey-lifecycle-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
