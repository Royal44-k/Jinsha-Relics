import test from 'node:test';
import assert from 'node:assert/strict';
import {readSave,writeSave,STORE} from '../src/v2/journey.js';
function memoryStorage(value){const map=new Map(value===undefined?[]:[[STORE,value]]);return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),map};}
test('corrupt, obsolete and incomplete storage cannot crash boot',()=>{for(const raw of ['{oops','null','42','{"version":1}','{"version":2,"collected":"oops","distance":"Infinity"}']){const result=readSave(memoryStorage(raw));assert.ok(result===null||(result.collected.length===0&&result.distance===0));}});
test('save filters unknown and repeated memories and preserves v1',()=>{const storage=memoryStorage('{"version":2,"collected":["bird","bird","alien"],"distance":-5}');storage.map.set('jinsha-sun-v1','prior');const saved=readSave(storage);assert.deepEqual(saved.collected,['bird']);assert.equal(saved.distance,0);assert.equal(writeSave({...saved,collected:new Set(['jade']),settings:{quality:'low'}},storage),true);assert.equal(storage.map.get('jinsha-sun-v1'),'prior');assert.deepEqual(readSave(storage).collected,['jade']);});
test('storage denied still allows a play session',()=>{const storage={getItem(){throw Error('denied')},setItem(){throw Error('quota')}};assert.equal(readSave(storage),null);assert.equal(writeSave({collected:new Set(),settings:{}},storage),false);});
test('a SecurityError from the localStorage property itself cannot break boot',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 try{Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('SecurityError');}});assert.equal(readSave(),null);assert.equal(writeSave({collected:new Set(),settings:{}}),false);}
 finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;}
});
test('v3 safe branch checkpoint survives saves without invalid positions',()=>{const storage=memoryStorage();writeSave({collected:new Set(['bird']),distance:43,completed:false,travel:{safePosition:[1,4.89,-42],safePerchId:'branch-0'},settings:{}},storage);assert.deepEqual(readSave(storage).travel,{safePosition:[1,4.89,-42],safePerchId:'branch-0'});for(const safePosition of [[0,1],[0,null,2],[10001,1,2],['1',2,3]]){storage.setItem(STORE,JSON.stringify({version:2,travel:{safePosition},collected:[]}));assert.equal(readSave(storage).travel,null);}const legacy=readSave(memoryStorage('{"version":2,"distance":25,"collected":["jade"]}'));assert.equal(legacy.travel,null);assert.equal(legacy.distance,25);});
