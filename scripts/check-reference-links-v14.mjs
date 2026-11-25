import {mkdir,writeFile} from 'node:fs/promises';
import {entries} from './reference-catalog-v14.mjs';

const out=new URL('../docs/v14/references/',import.meta.url);
const items=[];
let next=0;
async function probe(href){
  const result={href};
  try{
    const r=await fetch(href,{
      signal:AbortSignal.timeout(14000),
      headers:{'User-Agent':'Mozilla/5.0 (compatible; JinshaReferenceCheck/1.0)','Accept':'text/html,application/pdf,*/*'}
    });
    result.status=r.status;
    if(r.url!==href)result.destination=r.url;
    await r.body?.cancel();
  }catch(error){result.error=error.cause?.code||error.name;}
  return result;
}
async function work(){
  while(next<entries.length){
    const {href}=entries[next++];
    items.push(await probe(href));
  }
}
await Promise.all(Array.from({length:10},work));
const counts={readable:0,restricted:0,unavailable:0};
for(const item of items){
  if(item.status>=200&&item.status<300)counts.readable++;
  else if([401,402,403,429].includes(item.status))counts.restricted++;
  else counts.unavailable++;
}
await mkdir(out,{recursive:true});
await writeFile(new URL('external-links.json',out),JSON.stringify({
  checkedAt:new Date().toISOString(),method:'HTTPS GET, follow redirects, stop after headers',counts,items:items.sort((a,b)=>a.href.localeCompare(b.href))
},null,2));
console.log(counts);
