import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as T from 'three';
import {WebGLObjects} from '../node_modules/three/src/renderers/webgl/WebGLObjects.js';
import {readSave,writeSave} from '../src/v2/journey.js';
import {createAdventureWorld} from '../src/v5/adventure-world.js';
import {createLifeEffects} from '../src/v9/life-effects.js';
import {endingMemory,updateEndingMemory} from '../src/v9/ending-memory.js';
import {journeyNotesMarkup} from '../src/v9/journey-notes.js';

const files=['src/v9/ending-memory.js','src/v9/journey-notes.js','src/v9/growth-ui.js','src/v9/life-effects.js','src/v9/living-tree.js','src/v5/adventure-world.js','src/v2/journey.js','src/v2/main.js'],report={at:new Date().toISOString(),method:'Read-only production modules and extracted actual main handlers; minimal DOM and WebGL attribute registry substitutes, no browser/GPU. Stored progress is round-tripped through real save sanitizer and real world.restore.',sources:files.map(path=>({path,sha256:crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')})),journeys:[],input:[],findings:[]};
class Element{
 constructor(tag='div'){this.tagName=tag;this.hidden=false;this.style={};this.dataset={};this.textContent='';this.innerHTML='';this.children=[];this.queries=new Map();this.attributes={};this.firstElementChild={style:{}};this.classList={toggle(){},add(){},remove(){}};this.open=false;}
 setAttribute(k,v){this.attributes[k]=v;}append(...nodes){this.children.push(...nodes);}appendChild(n){this.children.push(n);}replaceChildren(...nodes){this.children=[...nodes];}remove(){this.removed=true;}querySelector(id){if(!this.queries.has(id))this.queries.set(id,new Element());return this.queries.get(id);}focus(){document.activeElement=this;}closest(){return null;}showModal(){this.open=true;}close(){this.open=false;}
}
const dom=new Map(),$=id=>{if(!dom.has(id))dom.set(id,new Element());return dom.get(id);};let lastCreated;
globalThis.document={createElement:tag=>lastCreated=new Element(tag),getElementById:$,body:new Element('body'),activeElement:null};globalThis.matchMedia=()=>({matches:false});globalThis.innerWidth=1440;
const growthSource=fs.readFileSync('src/v9/growth-ui.js','utf8').replace("import './growth-ui.css';",''),{growthMarkup,createGrowthUI}=await import('data:text/javascript;base64,'+Buffer.from(growthSource).toString('base64'));
const scene=new T.Scene(),forest={length:400,path:new T.LineCurve3(new T.Vector3(),new T.Vector3(0,0,-400)),sample:d=>new T.Vector3(0,0,-d),sampleGround:()=>0},traversal={perches:[],groundAt:()=>0},events=[],world=createAdventureWorld({scene,forest,traversal,onEvent:e=>events.push(e)}),storageMap=new Map(),storage={getItem:key=>storageMap.get(key)||null,setItem:(key,v)=>storageMap.set(key,v)},epilogue=new Element(),ui=createGrowthUI(),uiRoot=lastCreated;
for(const root of [false,true])for(let mask=0;mask<8;mask++){
 const ids=['reed','stone','dusk'].filter((_,i)=>mask&(1<<i)),saved={root:{slots:root?[0,1,2]:[null,null,null],held:null},expedition:{cleared:[...ids,...ids,'invalid'],discovered:[]}};
 writeSave({collected:new Set(root?['bird']:[]),distance:30,completed:false,adventure:saved},storage);const read=readSave(storage);world.restore(read.adventure,read.collected);const snapshot=world.snapshot(),beforeEvents=events.length;
 for(let i=0;i<3;i++){world.restore(world.serialize(),read.collected);world.update(0,i,{playing:false,position:new T.Vector3(),motion:{mode:'grounded'}});}
 const memory=endingMemory(snapshot),notes=journeyNotesMarkup(snapshot),markup=growthMarkup(snapshot),expectedArticles=ids.length+Number(root);
 assert.equal(memory.count,ids.length);assert.equal((notes.match(/<article>/g)||[]).length,expectedArticles);assert.equal(events.length,beforeEvents,JSON.stringify({root,ids,events:events.slice(beforeEvents)}));assert.equal(snapshot.growth.essence,Number(root)*2+ids.length*2);assert.ok(!/NaN|undefined|Infinity/.test(markup));
 for(let i=0;i<4;i++)updateEndingMemory(epilogue,snapshot);assert.equal(epilogue.children.length,3);assert.equal(epilogue.children[1].children.length,3);assert.equal(epilogue.children[1].children.filter(n=>n.className==='is-restored').length,ids.length);
 ui.reset();ui.update(snapshot,{mode:'title'});ui.update(snapshot,{mode:'playing'});assert.equal(uiRoot.querySelector('#v9-growth-arrival').hidden,true,'restored progress must not emit a new level-up arrival');
 report.journeys.push({root,cleared:ids,essence:snapshot.growth.essence,level:snapshot.growth.level,storyArticles:expectedArticles,repeatRestoreEvents:events.length-beforeEvents,epilogueTopNodes:epilogue.children.length});
}
world.reset();world.update(0,0,{playing:false,position:new T.Vector3(),motion:{mode:'grounded'}});const fresh=world.snapshot();assert.equal(journeyNotesMarkup(fresh),'');assert.equal(endingMemory(fresh).count,0);assert.equal(fresh.growth.essence,0);ui.reset();ui.update(fresh,{mode:'playing'});assert.equal(uiRoot.querySelector('#v9-growth-arrival').hidden,true);report.fresh={notesEmpty:true,epilogueSeeds:0,essence:0,arrivalHidden:true};

const main=fs.readFileSync('src/v2/main.js','utf8');
const functionText=(name,next)=>main.slice(main.indexOf('function '+name+'('),main.indexOf('function '+next+'('));
const reset=functionText('resetInput','applySettings'),open=functionText('openDialog','closeDialog'),close=functionText('closeDialog','openProfile');
assert.ok(reset.startsWith('function resetInput')&&!reset.includes('function openDialog'));
const keyBegin=main.indexOf("window.addEventListener('keydown',"),keyEnd=main.indexOf("});window.addEventListener('keyup'",keyBegin),keyCode=main.slice(keyBegin+"window.addEventListener('keydown',".length,keyEnd+1),calls={pulse:0,jump:0,dash:0,perch:0,cruise:0,interact:0,stop:0},paused=[];
const env={state:{mode:'playing'},keys:new Set(),quickWalk:false,focusHeld:false,clickOrigin:null,touch:{x:0,y:0},drag:null,velocity:new T.Vector3(),motion:{stop(){calls.stop++;}},travelCamera:{stopInput(){}},$,
 returnMode:'playing',lastFocus:null,document,renderer:{domElement:new Element('canvas')},audio:{setPaused:p=>paused.push(p)},disposePreview(){},closePottery(){},growthUI:{markup:()=>'<h2 id="dialog-title">growth fixture</h2>'},adventure:{pulse:()=>calls.pulse++},jump:()=>calls.jump++,dash:()=>calls.dash++,requestPerch:()=>calls.perch++,toggleCruise:()=>calls.cruise++,interact:()=>calls.interact++,listen(){},toggleLight(){},openJournal(){},openAtlas(){},closeAtlas(){},hint(){},enterPhoto(){},exitPhoto(){},pause(){}};
const api=new Function('env','with(env){'+reset+open+close+';return {handler:'+keyCode+',openDialog,closeDialog};}')(env);
const press=(code,extra={})=>api.handler({code,repeat:false,ctrlKey:false,metaKey:false,altKey:false,target:{matches:()=>false},preventDefault(){},...extra});
press('KeyB');assert.equal(calls.pulse,1);press('KeyB',{repeat:true});press('KeyB',{ctrlKey:true});press('KeyB',{altKey:true});assert.equal(calls.pulse,1);report.input.push({case:'B actual press / repeat / Ctrl / Alt',pulseCount:1});
press('KeyN',{ctrlKey:true});assert.equal(env.state.mode,'playing');press('KeyN');assert.equal(env.state.mode,'modal');assert.equal($('dialog').open,true);assert.equal(env.keys.size,0);assert.equal(paused.at(-1),true);
const before={...calls};for(const code of ['KeyB','KeyR','KeyV','KeyX','Space','KeyE'])press(code);assert.deepEqual(calls,before);press('Escape');assert.equal(env.state.mode,'playing');assert.equal($('dialog').open,false);assert.equal(paused.at(-1),false);assert.equal(document.activeElement,env.renderer.domElement);report.input.push({case:'N growth modal blocks gameplay and Escape restores play/focus',blockedKeys:6,audioPausedThenResumed:true});
press('KeyN',{target:{matches:()=>true}});assert.equal(env.state.mode,'playing');document.activeElement={closest:()=>({})};press('Space');assert.equal(calls.jump,0);report.input.push({case:'input control N and focused native-button Space preserve UI ownership',pass:true});

// Use the actual Three.js WebGLObjects cleanup hook with a registry substitute.
// No graphics context is created; this isolates the GPU attribute ownership contract.
const effectScene=new T.Scene(),fx=createLifeEffects(effectScene),meshes=[];effectScene.traverse(o=>{if(o.isInstancedMesh)meshes.push(o);});const attributes=new Set(),released=[];
const objects=WebGLObjects({ARRAY_BUFFER:34962},{get:(o,g)=>g,update(){}},{update:a=>attributes.add(a),remove:a=>attributes.delete(a)},{releaseStatesOfObject:o=>released.push(o.uuid)},{render:{frame:1}});
for(const mesh of meshes)objects.update(mesh);assert.equal(attributes.size,3);fx.dispose();const afterModuleDispose=attributes.size;for(const mesh of meshes)mesh.dispose();const afterExplicitMeshDispose=attributes.size;
report.effectDisposal={instancedMeshes:meshes.length,registryAfterModuleDispose:afterModuleDispose,registryAfterExplicitMeshDispose:afterExplicitMeshDispose,sceneChildren:effectScene.children.length};
if(afterModuleDispose)report.findings.push({priority:'P3',file:'src/v9/life-effects.js',issue:'dispose() omits InstancedMesh.dispose(), so the real Three WebGLObjects hook cannot release three instanceMatrix attributes.',reproduction:'Create module, register its three bead meshes with actual WebGLObjects, call module.dispose(): attribute registry still has 3 entries. Calling the three mesh.dispose() removes all 3.',scope:'Bounded disposal-contract defect, 3 instanceMatrix buffers per created effects instance. Current main creates one instance and does not dispose/recreate it during ordinary new journeys; no evidence of per-pulse or per-journey accumulation.'});
ui.dispose();world.dispose();objects.dispose();fs.mkdirSync('docs/v9/character/review',{recursive:true});fs.writeFileSync('docs/v9/character/review/final-lifecycle-review.json',JSON.stringify(report,null,2));console.log(JSON.stringify({journeys:report.journeys.length,input:report.input,fresh:report.fresh,findings:report.findings},null,2));
