const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'../dist');let input=0,output=0,count=0;
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.(html|js|css|json|glb|wav)$/.test(file)){const data=fs.readFileSync(file),br=zlib.brotliCompressSync(data,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:5}});if(br.length<data.length*.95){fs.writeFileSync(file+'.br',br);fs.writeFileSync(file+'.gz',zlib.gzipSync(data,{level:6}));input+=data.length;output+=br.length;count++;}}}}
walk(root);console.log(JSON.stringify({precompressedFiles:count,sourceBytes:input,brotliBytes:output}));
