import { unpackRelicGroup } from './relic-transfer.js';

const IDS=['bird','jade','mask','tiger','sun'];
let pending;
let diagnostics={status:'idle',mode:null};
export function getRelicLoadDiagnostics(){return {...diagnostics};}

function validate(root) {
  const entries={};
  for(const id of IDS) {
    const model=root.children.find(child=>child.name===id);
    if(!model?.isGroup)throw new Error(`Relic worker did not supply ${id}`);
    entries[id]=model;
  }
  return entries;
}

function fromWorker(timeoutMs) {
  return new Promise((resolve,reject)=>{
    let worker,timer,settled=false;
    const finish=(error,result)=>{
      if(settled)return;settled=true;clearTimeout(timer);
      if(worker){worker.onmessage=worker.onerror=worker.onmessageerror=null;worker.terminate();}
      if(error)reject(error);else resolve(result);
    };
    try {
      if(typeof Worker==='undefined')throw new Error('Web Worker is unavailable');
      // Keep this literal form: Vite discovers and bundles the local worker.
      worker=new Worker(new URL('./relic-worker.js',import.meta.url),{type:'module'});
      timer=setTimeout(()=>finish(new Error(`Relic worker timed out after ${timeoutMs} ms`)),timeoutMs);
      worker.onerror=event=>{event.preventDefault();finish(new Error(event.message||'Relic worker failed'));};
      worker.onmessageerror=()=>finish(new Error('Relic worker response could not be deserialized'));
      worker.onmessage=event=>{
        const data=event.data;
        if(data?.type==='progress'){diagnostics={...diagnostics,completed:data.completed,current:data.id};return;}
        if(data?.type==='error'){finish(new Error(data.message||'Relic worker construction failed'));return;}
        if(data?.type!=='ready')return;
        try {
          const before=performance.now(),root=unpackRelicGroup(data.json),models=validate(root);
          diagnostics={...diagnostics,...data.metrics,parseMs:performance.now()-before,completed:5};
          finish(null,models);
        }catch(error){finish(error);}
      };
      worker.postMessage({type:'build'});
    }catch(error){finish(error);}
  });
}

async function synchronousFallback() {
  // Dynamic import keeps procedural building code out of the normal main path.
  const {createDetailedRelic}=await import('./relics.js'),models={};
  for(const id of IDS) {
    // Let the error/loading UI paint before each unavoidable synchronous asset.
    await new Promise(resolve=>setTimeout(resolve,0));
    models[id]=createDetailedRelic(id);
  }
  return models;
}

/**
 * Start once, in parallel with character downloads. Returns fresh Group
 * transforms with shared immutable geometry/material/texture resources.
 * Worker errors/timeouts default to a recoverable synchronous fallback;
 * pass {fallback:false} to reject explicitly and allow the caller to retry.
 * Options are applied only when starting a new load, not cached requests.
 * @returns {Promise<Record<'bird'|'jade'|'mask'|'tiger'|'sun', import('three').Group>>}
 */
export function loadDetailedRelics({timeoutMs=30000,fallback=true}={}) {
  if(!pending) {
    const start=performance.now();
    diagnostics={status:'loading',mode:'worker',completed:0};
    const timeout=Number.isFinite(timeoutMs)?Math.max(1,timeoutMs):30000;
    pending=fromWorker(timeout).catch(async error=>{
      diagnostics={...diagnostics,workerError:error.message};
      if(!fallback)throw error;
      diagnostics={...diagnostics,mode:'synchronous-fallback'};
      try{return await synchronousFallback();}catch(fallbackError){throw new AggregateError([error,fallbackError],'Worker and fallback relic construction failed');}
    }).then(models=>{
      diagnostics={...diagnostics,status:'ready',completed:5,elapsedMs:performance.now()-start};return models;
    }).catch(error=>{
      diagnostics={...diagnostics,status:'error',elapsedMs:performance.now()-start,error:error.message};
      pending=undefined;throw error;
    });
  }
  return pending.then(models=>Object.fromEntries(IDS.map(id=>[id,models[id].clone(true)])));
}
