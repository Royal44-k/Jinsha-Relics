import {encode,mergeArchive,restore} from '../v10/ledger.js';

const fields=['muted','quality','photos','fieldTriptych','inscription'];

// There is one writer per live journey document. Keep edited values and
// revisit increments until setItem succeeds, even when unrelated saves follow.
export function createJourneyWriter({record,key,storage,locks,onFailure=()=>{}}){
  const edits={},deltas=new Map(),pending=new Set();
  let failed=false;
  function merge(stored){
    const local={...record,...edits,revisits:{...record.revisits}};
    for(const [id,count] of deltas){
      local.revisits[id]=Math.max(local.revisits[id]||0,(stored.revisits[id]||0)+count);
    }
    const changed=Object.fromEntries(Object.keys(edits).map(field=>[field,true]));
    return mergeArchive(local,stored,changed);
  }
  function write(){
    const raw=storage.getItem(key);
    // Preferences may be inherited by a fresh journey on its first save.
    const next=merge(raw?restore(raw):{...record,revisits:{}});
    storage.setItem(key,encode(next));
    Object.assign(record,next);
    for(const field of Object.keys(edits))delete edits[field];
    deltas.clear();failed=false;
    return true;
  }
  async function commit(){
    try{return locks?await locks.request(key,write):write();}
    catch{failed=true;onFailure();return false;}
  }
  function save(changed={}){
    for(const field of fields)if(changed[field]){
      const value=record[field];edits[field]=Array.isArray(value)?value.slice():value;
    }
    if(changed.revisited)deltas.set(changed.revisited,(deltas.get(changed.revisited)||0)+1);
    const operation=commit();pending.add(operation);
    operation.then(()=>pending.delete(operation));
    return operation;
  }
  return {save,acceptStored:stored=>Object.assign(record,merge(stored)),async finish(){
    await Promise.all([...pending]);
    return !failed||save();
  }};
}
