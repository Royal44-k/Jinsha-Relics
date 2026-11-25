import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {chapterIds,restore,encode,secureRecord,skillLevel,validFilm,mergeArchive} from '../src/v10/ledger.js';
import {cameraReach} from '../src/v10/camera-boom.js';
import {matchObservation} from '../src/v10/observations.js';
import {sites,ground,createSurveyWorld} from '../src/v10/geography.js';

test('Only sequential evidence is awarded, including after a replay',()=>{
  const s=restore(null);assert.equal(secureRecord(s,'clay-fit'),false);
  chapterIds.forEach(id=>{assert.equal(secureRecord(s,id),true);assert.equal(secureRecord(s,id),false);});
  assert.equal(secureRecord(s,undefined),false);assert.deepEqual(s.completed,chapterIds);
});
test('Completed replays persist only for earned chapters and merge simultaneous visits',()=>{
  const local=restore(JSON.stringify({version:1,completed:[chapterIds[0]],revisits:{[chapterIds[0]]:1,[chapterIds[1]]:7}}));
  assert.deepEqual(local.revisits,{[chapterIds[0]]:1});
  const stored=restore(encode(local));stored.revisits[chapterIds[0]]=2;
  const merged=mergeArchive(local,stored,{revisited:chapterIds[0]});
  assert.equal(merged.revisits[chapterIds[0]],3);
  assert.deepEqual(mergeArchive(local,merged).revisits,merged.revisits);
});
test('Legacy and damaged checkpoints restore only a valid prefix',()=>{
  assert.deepEqual(restore('broken').completed,[]);assert.deepEqual(restore('{"distance":45}').completed,[]);
  const s=restore(JSON.stringify({version:1,completed:[chapterIds[0],chapterIds[2]],ending:true,inscription:'x',observations:['beam-view']}));
  assert.deepEqual(s.completed,[chapterIds[0]]);assert.equal(s.ending,false);assert.equal(s.inscription,'');assert.deepEqual(s.observations,[]);
});
test('Museum triptych survives older saves and keeps one archived plate per field of study',()=>{
  const choices=['root-survey','clay-fit','ivory-record'];
  const old=restore(JSON.stringify({version:1,completed:chapterIds,ending:true}));
  assert.deepEqual(old.fieldTriptych,[]);
  const local={...old,fieldTriptych:choices};
  assert.deepEqual(restore(encode(local)).fieldTriptych,choices);
  assert.deepEqual(restore(encode({...local,ending:false})).fieldTriptych,[]);
  assert.deepEqual(restore(encode({...local,fieldTriptych:['jade-cut','jade-cut','sunfoil']})).fieldTriptych,[]);
  assert.deepEqual(mergeArchive(old,local).fieldTriptych,choices);
  const other={...old,fieldTriptych:['river-trench','bronze-shadow','nine-posts']};
  assert.deepEqual(mergeArchive(other,local,{fieldTriptych:true}).fieldTriptych,other.fieldTriptych);
});
test('Ending, wildlife notes, preferred voice and earned evidence survive reload',()=>{
  const s=restore(null);for(const id of chapterIds)secureRecord(s,id);
  Object.assign(s,{muted:true,ending:true,inscription:'让想象留下可辨的笔迹',observations:['submerged-wood','absent-posts']});
  assert.deepEqual(restore(encode(s)),s);assert.deepEqual([0,2,3,5,6,9].map(skillLevel),[0,0,1,1,2,2]);
});
test('Photographs are bounded local JPEGs, only restored with station seven',()=>{
  const film=Array(3).fill('data:image/jpeg;base64,/9j/ABCD');assert.deepEqual(validFilm(film),film);
  assert.deepEqual(validFilm(film.slice(1)),[]);assert.deepEqual(validFilm(['https://other',...film.slice(1)]),[]);
  assert.deepEqual(validFilm([...film.slice(1),'data:image/jpeg;base64,/9j/'+'A'.repeat(33000)]),[]);
  assert.deepEqual(restore(JSON.stringify({version:1,completed:chapterIds.slice(0,6),photos:film})).photos,[]);
  assert.deepEqual(restore(JSON.stringify({version:1,completed:chapterIds.slice(0,7),photos:film})).photos,film);
});
test('Nine distinct sites offer dry ground, optional support surfaces preserve diving below',()=>{
  assert.equal(new Set(sites.map(s=>s.join())).size,9);for(const site of sites)assert.ok(ground(...site)>.08);
  const world=createSurveyWorld(),p=new Vector3(3,2.1,0);
  world.surfaces.push({minX:2,maxX:4,minZ:-1,maxZ:1,heightAt:()=>2});
  assert.equal(world.sample(p).groundHeight,2);p.y=-1.1;
  assert.equal(world.sample(p).groundHeight,ground(3,0));assert.ok(world.sample(p).waterDepth>0);
});
test('A field note requires its own movement, place and discovery context',()=>{
  const features={log:new Vector3(4,0,1),posts:new Vector3(3,1,1)},p=new Vector3(4,5,1);
  assert.equal(matchObservation(2,{mode:'swimming'},p,false,features),null);
  assert.equal(matchObservation(2,{mode:'diving'},p,false,features),'submerged-wood');
  assert.equal(matchObservation(3,{mode:'perched',perchId:'station-3-0'},p,false,features),'beam-view');
  assert.equal(matchObservation(7,{mode:'flying'},p,true,features),null);
  assert.equal(matchObservation(8,{mode:'flying'},p,false,features),null);
  assert.equal(matchObservation(8,{mode:'flying'},p,true,features),'absent-posts');
});
test('Preferences and replay rewards from an older tab cannot erase newly earned evidence',()=>{
  const old=restore(null),current=restore(null);chapterIds.forEach(id=>secureRecord(current,id));
  Object.assign(current,{ending:true,inscription:'让证据保有原来的位置',quality:'high',observations:['beam-view']});
  old.muted=true;secureRecord(old,chapterIds[0]);
  const result=mergeArchive(old,current,{muted:true});
  assert.deepEqual(result.completed,chapterIds);assert.equal(result.ending,true);assert.equal(result.inscription,current.inscription);
  assert.equal(result.muted,true);assert.equal(result.quality,'high');assert.deepEqual(result.observations,['beam-view']);
});
test('Camera retreats in front of a post while airborne views can clear its top',()=>{
  const post={x:0,z:2.5,radius:.4,y:0,height:2.4};
  assert.ok(cameraReach(new Vector3(0,1,0),new Vector3(0,2,5),[post])<.4);
  assert.equal(cameraReach(new Vector3(0,4,0),new Vector3(0,5,5),[post]),1);
  assert.equal(cameraReach(new Vector3(0,1,0),new Vector3(5,2,0),[post]),1);
});

