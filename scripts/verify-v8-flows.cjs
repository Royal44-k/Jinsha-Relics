// Deliberately sequential: these checks must never compete for the same GPU.
const {spawnSync}=require('node:child_process'),fs=require('node:fs');
const jobs=[
 ['render scale','check-render-scale-v8.cjs',{}],
 ['audio','verify-audio-v8.cjs',{}],
 ['five chapter journey','playthrough-v5.cjs',{JINSHA_OUTPUT:'docs/v8/mainline'}],
 ['ecological encounters','playthrough-living-v8.cjs',{}],
 ['pottery in the complete world','review-pottery-integration-v8.cjs',{}]
];
const report={startedAt:new Date().toISOString(),results:[]};fs.mkdirSync('docs/v8/flows',{recursive:true});
for(const [name,script,env]of jobs){
 const started=Date.now();console.log('Checking '+name);
 const r=spawnSync(process.execPath,['scripts/'+script],{encoding:'utf8',env:{...process.env,...env},timeout:480000,maxBuffer:8*1024*1024});
 fs.writeFileSync('docs/v8/flows/'+script+'.log',(r.stdout||'')+'\n'+(r.stderr||''));report.results.push({name,script,seconds:(Date.now()-started)/1000,exitCode:r.status,error:r.error?.message});fs.writeFileSync('docs/v8/flows/results.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report.results.at(-1)));if(r.status!==0){process.exitCode=1;break;}
}
report.endedAt=new Date().toISOString();fs.writeFileSync('docs/v8/flows/results.json',JSON.stringify(report,null,2));
