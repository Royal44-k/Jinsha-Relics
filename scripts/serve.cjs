const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../dist');
const mime={
  '.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary',
  '.gltf':'model/gltf+json','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg',
  '.webp':'image/webp','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg',
  '.svg':'image/svg+xml','.webm':'video/webm','.mp4':'video/mp4'
};
function videoRange(header,size){
  const match=/^bytes=(\d*)-(\d*)$/.exec(header);
  if(!match||(!match[1]&&!match[2]))return null;
  const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
  const end=match[1]&&match[2]?Math.min(size-1,Number(match[2])):size-1;
  return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<=end&&start<size?{start,end}:null;
}
http.createServer((req,res)=>{
  let url;
  try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}
  catch{res.writeHead(400).end();return;}
  if(url.includes('\0')){res.writeHead(400).end('Invalid path');return;}
  const file=path.resolve(root,'.'+(url==='/'?'/index.html':url));
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const ext=path.extname(file),video=ext==='.webm'||ext==='.mp4';
  const accepted=video?'':req.headers['accept-encoding']||'';
  const encoding=accepted.includes('br')&&fs.existsSync(file+'.br')?'br':accepted.includes('gzip')&&fs.existsSync(file+'.gz')?'gzip':null;
  const physical=encoding?file+(encoding==='br'?'.br':'.gz'):file;
  fs.stat(physical,(error,stat)=>{
    if(error||!stat.isFile()){res.writeHead(404).end('Not found');return;}
    const headers={'Content-Type':mime[ext]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff',Vary:'Accept-Encoding'};
    if(encoding)headers['Content-Encoding']=encoding;
    if(video)headers['Accept-Ranges']='bytes';
    let range;
    if(video&&req.headers.range){
      range=videoRange(req.headers.range,stat.size);
      if(!range){res.writeHead(416,{'Content-Range':'bytes */'+stat.size}).end();return;}
      headers['Content-Range']='bytes '+range.start+'-'+range.end+'/'+stat.size;
      headers['Content-Length']=range.end-range.start+1;
    }
    res.writeHead(range?206:200,headers);
    if(req.method==='HEAD'){res.end();return;}
    const stream=fs.createReadStream(physical,range||undefined);
    res.on('close',()=>stream.destroy());stream.on('error',()=>res.destroy());stream.pipe(res);
  });
}).listen(5188,'127.0.0.1',()=>console.log('金沙：古蜀秘境 http://127.0.0.1:5188'));
