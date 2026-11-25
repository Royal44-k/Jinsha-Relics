const fs=require('fs'),path=require('path');
const files=fs.readdirSync('docs/v2').filter(x=>x.endsWith('.md'));
let missing=[];
for(const name of files){const text=fs.readFileSync(path.join('docs/v2',name),'utf8');for(const m of text.matchAll(/\]\(([^)]+)\)/g)){const ref=m[1];if(/^(https?:|#)/.test(ref))continue;const target=path.resolve('docs/v2',ref);if(!fs.existsSync(target))missing.push({file:name,target});}}
console.log(JSON.stringify({documents:files.length,missingLocalLinks:missing},null,2));
