const fs=require('fs');
const path=require('path');
const {spawn,spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const url='http://127.0.0.1:5188';
function sourcesNewer(target,stamp){
 const stat=fs.statSync(target);
 if(stat.isFile())return stat.mtimeMs>stamp;
 return fs.readdirSync(target).some(f=>sourcesNewer(path.join(target,f),stamp));
}
function buildIfNeeded(alreadyServing){
 const vite=path.join(root,'node_modules','vite','bin','vite.js'),entry=path.join(root,'dist','index.html');
 const haveBuild=fs.existsSync(entry),canBuild=fs.existsSync(vite);
 if(haveBuild){
  const stamp=fs.statSync(entry).mtimeMs;
  const inputs=['src','public','index.html','forest.html','vite.config.js','package-lock.json'];
  if(!canBuild||!inputs.some(f=>fs.existsSync(path.join(root,f))&&sourcesNewer(path.join(root,f),stamp)))return;
 }
 if(!canBuild)throw new Error('游戏文件尚未构建。请先在游戏目录运行 npm install。');
 // A tab may still need a previous build's lazy-loaded workbench.
 const args=alreadyServing?[vite,'build','--emptyOutDir=false']:[vite,'build'];
 const built=spawnSync(process.execPath,args,{cwd:root,windowsHide:true,stdio:'inherit'});
 if(built.status!==0)throw new Error('生产构建失败，请检查输出。');
 const compressed=spawnSync(process.execPath,[path.join(root,'scripts','precompress.cjs')],{cwd:root,windowsHide:true,stdio:'inherit'});
 if(compressed.status!==0)throw new Error('资源压缩失败。');
}
async function ready(){try{const r=await fetch(url,{signal:AbortSignal.timeout(800)});return (await r.text()).includes('JINSHA · REALM OF ANCIENT SHU');}catch{return false;}}
(async()=>{
 const alreadyServing=await ready();
 buildIfNeeded(alreadyServing);
 if(!alreadyServing&&!await ready()){
  const log=fs.openSync(path.join(root,'docs','launcher.log'),'a');
  const child=spawn(process.execPath,[path.join(root,'scripts','serve.cjs')],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',log,log]});child.unref();
  for(let i=0;i<30&&!await ready();i++)await new Promise(r=>setTimeout(r,300));
  if(!await ready())throw new Error('游戏未能启动，请检查端口5188或 docs/launcher.log。');
 }
 const opener=spawn('cmd.exe',['/c','start','',url],{windowsHide:true,detached:true,stdio:'ignore'});opener.unref();
 console.log('金沙：古蜀秘境已启动 '+url);
})().catch(e=>{console.error(e.message);process.exitCode=1});
