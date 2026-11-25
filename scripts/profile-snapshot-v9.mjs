import * as T from 'three';
import {writeFile} from 'node:fs/promises';
import {createAdventureWorld} from '../src/v5/adventure-world.js';
const scene=new T.Scene(),path=new T.LineCurve3(new T.Vector3(),new T.Vector3(0,0,-400));
const forest={length:400,path,sample:d=>new T.Vector3(0,0,-d),sampleGround:()=>0};
const world=createAdventureWorld({scene,forest,traversal:{perches:[],groundAt:()=>0}});
world.update(.016,1,{position:new T.Vector3(0,0,-114),motion:{mode:'grounded'},playing:true});
for(let i=0;i<1000;i++)world.snapshot();
const batches=[];let checksum=0;
for(let batch=0;batch<30;batch++){const start=performance.now();for(let i=0;i<1000;i++)checksum+=world.snapshot().totals.stages;batches.push((performance.now()-start)/1000);}
const sorted=[...batches].sort((a,b)=>a-b),report={at:new Date().toISOString(),method:'Node CPU-only; 30 batches of 1000 snapshots after warmup. A flat 400m fixture, no renderer or GC instrumentation; this is not game FPS.',medianMs:sorted[15],p95BatchMeanMs:sorted[28],tenCallsMs:sorted[15]*10,snapshotJsonBytes:Buffer.byteLength(JSON.stringify(world.snapshot())),checksum,batches};
world.dispose();await writeFile('docs/v9/snapshot-profile.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,batches:undefined}));
