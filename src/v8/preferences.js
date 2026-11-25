export const PREFERENCES_KEY='jinsha-preferences-v8';
const volumes=['master','music','voice','ambient'];
export function cleanPreferences(value){
 const p={};if(!value||typeof value!=='object')return p;
 if(['high','low'].includes(value.quality))p.quality=value.quality;
 if(['balanced','detail'].includes(value.resolution))p.resolution=value.resolution;
 if(typeof value.reduced==='boolean')p.reduced=value.reduced;
 for(const key of volumes)if(Number.isFinite(value[key]))p[key]=Math.max(0,Math.min(1,value[key]));
 return p;
}
export function readPreferences(storage){
 try{storage??=globalThis.localStorage;return cleanPreferences(JSON.parse(storage.getItem(PREFERENCES_KEY)||'null'));}catch{return {};}
}
export function savePreferences(value,storage){
 try{storage??=globalThis.localStorage;storage.setItem(PREFERENCES_KEY,JSON.stringify(cleanPreferences(value)));return true;}catch{return false;}
}
