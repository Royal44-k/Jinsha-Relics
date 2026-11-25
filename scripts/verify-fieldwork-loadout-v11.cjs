const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const base=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5197',url=base+'/__raft-loadout-verify';
const fixture='<!doctype html><style>*{box-sizing:border-box}html,body,main{width:100%;height:100%;margin:0;overflow:hidden}</style><main></main><script type=module>import {mountFieldwork} from "/src/v10/fieldwork.js";import {forms} from "/src/v11/collection-data.js";let close;window.visit=(id,level,growth)=>{close?.();window.scenes.length=0;const form=forms.find(f=>f.id===id);const traits=form?{...form,level}:null;close=mountFieldwork("paleochannel",document.querySelector("main"),{traits,growthLevel:growth});};</script>';
async function run(soft){
 const browser=await chromium.launch({headless:true,executablePath:process.env.JINSHA_EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',args:soft?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
 const page=await browser.newPage({viewport:{width:1040,height:650}});const assets=[],errors=[],rows=[];
 page.on('request',r=>{if(/fieldwork-raft-.*webp/.test(r.url()))assets.push(r.url().split('/').pop());});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.addInitScript(()=>{window.scenes=[];window.__THREE_DEVTOOLS__=new EventTarget();window.__THREE_DEVTOOLS__.addEventListener('observe',e=>{if(e.detail?.isScene)window.scenes.push(e.detail);});});
 await page.route(url,r=>r.fulfill({contentType:'text/html',body:fixture}));
 await page.route('**/@vite/client',r=>r.fulfill({contentType:'text/javascript',body:"export const createHotContext=()=>({accept(){},dispose(){},prune(){},on(){},off(){},data:{}});export const updateStyle=(id,text)=>{const s=document.createElement('style');s.textContent=text;document.head.append(s)};export const removeStyle=()=>{};export const injectQuery=x=>x;"}));
 try{
  await page.goto(url);await page.waitForFunction(()=>window.visit);
  const choices=soft?[['',0],...['reed','jade','sun'].flatMap(id=>[1,2,3].map(rank=>[id,rank]))]:[['',0],['reed',1],['jade',2],['sun',3]];
  for(const [id,rank] of choices){
   const growth=id?rank-1:2,expected=id?id+'-'+rank:'plumage',start=assets.length;
   await page.evaluate(([id,rank,growth])=>window.visit(id,rank,growth),[id,rank,growth]);
   await page.waitForFunction(({expected,soft})=>{
     if(document.querySelector('canvas')?.dataset.equipped!==expected)return false;
     if(!soft)return window.scenes.some(s=>s.getObjectByName('Shuoyu'));
     return window.scenes.some(s=>{let sprite;s.traverse(n=>{if(n.isSprite)sprite=n;});return sprite?.material.map.image?.complete;});
   },{expected,soft},{timeout:40000});
   if(id==='jade'&&rank===2){
     await page.getByRole('button',{name:'解缆出发',exact:true}).click();
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   }
   const result=await page.evaluate(({id,soft})=>{
     const c=document.querySelector('canvas'),gl=c.getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');
     const renderer=e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
     if(!soft){
       const bird=window.scenes.map(s=>s.getObjectByName('Shuoyu')).find(Boolean),accessories=[];
       bird.traverse(n=>{if(n.name.startsWith('Collection_'))accessories.push({name:n.name,vertices:n.children[0].geometry.attributes.position.count});});
       const color=bird.getObjectByName('Shuoyu_plumage').geometry.attributes.color;
       let pigment=0;for(let i=0;i<color.count;i+=13)pigment+=7*color.getX(i)+11*color.getY(i)+19*color.getZ(i);
       return {renderer,model:bird.userData.collectionForm||null,accessories,pigment:Math.round(pigment*100)};
     }
     let sprite;for(const s of window.scenes)s.traverse(n=>{if(n.isSprite)sprite=n;});
     const map=sprite.material.map,tmp=document.createElement('canvas');tmp.width=1040;tmp.height=624;const g=tmp.getContext('2d');g.drawImage(map.image,0,0);
     const pixels=g.getImageData(2*208+65,208+65,80,94).data,mean=[0,0,0];let count=0;
     for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>200){for(let j=0;j<3;j++)mean[j]+=pixels[i+j];count++;}
     return {renderer,image:map.image.src.split('/').pop(),size:[map.image.width,map.image.height],row:map.offset.y,pigment:mean.map(x=>Math.round(x/count))};
   },{id,soft});
   if(soft){
     assert.match(result.renderer,/SwiftShader|llvmpipe|software/i);assert.deepEqual(assets.slice(start),['fieldwork-raft-'+expected+'.webp']);
     assert.equal(result.image,'fieldwork-raft-'+expected+'.webp');assert.deepEqual(result.size,[1040,624]);assert.ok(Math.abs(result.row-(2-growth)/3)<.001);
   }else{
     assert.doesNotMatch(result.renderer,/SwiftShader|llvmpipe|software/i);assert.deepEqual(assets.slice(start),[]);assert.deepEqual(result.model,id?{id,level:rank}:null);
     assert.deepEqual(result.accessories.map(n=>n.vertices),id?[rank*125,rank*125]:[]);
     if(id)assert.deepEqual(result.accessories.map(n=>n.name).sort(),['Collection_'+id+'_L','Collection_'+id+'_R']);
   }
   rows.push({outfit:expected,growth,underway:id==='jade'&&rank===2,...result,selectedImages:assets.slice(start)});
  }
  assert.deepEqual(errors,[]);
  if(!soft)assert.equal(new Set(rows.map(x=>x.pigment)).size,rows.length);
  else{const jade=rows.find(x=>x.outfit==='jade-2').pigment,sun=rows.find(x=>x.outfit==='sun-2').pigment;assert.ok(jade[1]-jade[0]>sun[1]-sun[0]+10);}
  return {soft,rows,errors};
 }finally{await browser.close();}
}
(async()=>{const results=[await run(false),await run(true)];fs.writeFileSync('docs/v10/fieldwork/raft-loadouts-v11.json',JSON.stringify(results,null,2));console.log(results.map(r=>[r.soft?'Software':'Hardware',r.rows.length,r.errors.length]));})().catch(e=>{console.error(e);process.exitCode=1;});
