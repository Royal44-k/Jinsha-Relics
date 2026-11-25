import {restore,saveKey} from '../v10/ledger.js';

export const firstJourney='first';
const metadata='jinsha-journeys-v14.slot.';
const recent='jinsha-journeys-v14.recent';
const legacyKey='jinsha-river-survey-v10';
const validId=id=>typeof id==='string'&&/^j-[0-9a-f]{32}$/.test(id);

export function journeyKey(id,key){
  if(id===firstJourney)return key;
  if(!validId(id))throw new Error('旅程编号无效');
  return 'jinsha-trip.'+id+'.'+key;
}

function makeId(){
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  return 'j-'+Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
}

// The directory has one immutable entry per journey. Simultaneous creations
// never rewrite a shared array. The recent pointer is only a landing default.
export function createJourneyBook(storage){
  function read(key){try{return storage?.getItem(key)??null;}catch{return null;}}
  function descriptor(id){
    if(id===firstJourney)return {id,created:0};
    if(!validId(id))return null;
    let meta;try{meta=JSON.parse(read(metadata+id));}catch{}
    if(!Number.isSafeInteger(meta?.created)||meta.created<=0||!Number.isFinite(new Date(meta.created).getTime()))return null;
    return {id,created:meta.created,muted:meta.muted===true,quality:meta.quality};
  }
  function resolve(requested){
    return descriptor(requested)?.id??descriptor(read(recent))?.id??firstJourney;
  }
  function load(id){
    const raw=read(journeyKey(id,saveKey)),state=restore(raw);
    if(!raw&&id!==firstJourney){
      const meta=descriptor(id);
      state.muted=meta?.muted===true;
      if(['high','economy'].includes(meta?.quality))state.quality=meta.quality;
    }
    return state;
  }
  function list(){
    const slots=[descriptor(firstJourney)];
    try{
      for(let i=0;i<(storage?.length??0);i++){
        const key=storage.key(i);
        if(!key?.startsWith(metadata))continue;
        const meta=descriptor(key.slice(metadata.length));
        if(meta)slots.push(meta);
      }
    }catch{}
    return slots.sort((a,b)=>a.created-b.created||a.id.localeCompare(b.id));
  }
  function select(id){
    if(!descriptor(id))throw new Error('旅程不存在');
    try{storage?.setItem(recent,id);}catch{}
  }
  function create(settings){
    if(!storage)throw new Error('此浏览器未开放旅程存储');
    let id=makeId();while(storage.getItem(metadata+id)!==null)id=makeId();
    storage.setItem(metadata+id,JSON.stringify({created:Date.now(),muted:settings.muted,quality:settings.quality}));
    select(id);return id;
  }
  return {resolve,load,list,create,select,legacy:()=>restore(read(legacyKey))};
}
