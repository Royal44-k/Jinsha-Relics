import { Group } from 'three';
import { createDetailedRelic } from './relics.js';
import { packRelicGroup } from './relic-transfer.js';

let started=false;
self.onmessage=event=>{
  if(event.data?.type!=='build'||started)return;
  started=true;
  try {
    const start=performance.now(),root=new Group();root.name='Detailed relic templates';
    const timings={};
    for(const id of ['bird','jade','mask','tiger','sun']) {
      const before=performance.now();root.add(createDetailedRelic(id));timings[id]=performance.now()-before;
      self.postMessage({type:'progress',id,completed:root.children.length,total:5});
    }
    const buildMs=performance.now()-start,packStart=performance.now(),{json,transferables,bytes}=packRelicGroup(root);
    self.postMessage({type:'ready',json,metrics:{buildMs,packMs:performance.now()-packStart,assetBuildMs:timings,bytes,bufferCount:transferables.length}},transferables);
  } catch(error) {
    self.postMessage({type:'error',message:error?.message||String(error)});
  } finally {
    // Transferred buffers have moved to main; no worker-side cache is retained.
    self.close();
  }
};
