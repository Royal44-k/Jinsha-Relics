const fs=require('node:fs'),{chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.JINSHA_EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage();
    const base=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5197',url=base+'/__bake-raft-pose';
    const fixture='<!doctype html><script type=module>import * as T from "/node_modules/three/build/three.module.js";import {createCharacter} from "/src/v2/character.js";import {applyRiverPlumage} from "/src/v10/river-plumage.js";import {forms} from "/src/v11/collection-data.js";import {applyCollectionLook} from "/src/v11/collection-look.js";window.libs={T,createCharacter,applyRiverPlumage,forms,applyCollectionLook};</script>';
    await page.route(url,r=>r.fulfill({contentType:'text/html',body:fixture}));await page.goto(url);await page.waitForFunction(()=>window.libs);
    const ids=await page.evaluate(async()=>{
      const {T,createCharacter,applyRiverPlumage,forms,applyCollectionLook}=window.libs;
      const crop=208,scale=.89,renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
      renderer.setSize(crop,crop);renderer.setClearColor(0x000000,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.07;
      const scene=new T.Scene(),cam=new T.OrthographicCamera(-scale,scale,scale,-scale,.05,32);
      const sun=new T.DirectionalLight(0xffde9c,2.35);sun.position.set(-9,13,7);scene.add(sun,new T.HemisphereLight(0xf7e7c5,0x5b705f,1.35));
      const fill=new T.DirectionalLight(0x91bbb0,.45);fill.position.set(9,5,-7);scene.add(fill);
      cam.position.set(1.75,8.60,11.8);cam.lookAt(0,.55,0);
      const actor=await createCharacter({lod:1,plumage:applyRiverPlumage});scene.add(actor.group);
      const atlas=document.createElement('canvas');atlas.width=crop*5;atlas.height=crop*3;const g=atlas.getContext('2d');
      window.renderPlumage=({id,level})=>{
        const form=forms.find(item=>item.id===id);if(form)applyCollectionLook(actor,{...form,level});
        g.clearRect(0,0,atlas.width,atlas.height);
        for(let row=0;row<3;row++)for(let col=0;col<5;col++){
          actor.group.rotation.y=(col-2)*.20;actor.update(.016,3,{mode:'grounded',speed:0,attentionYaw:(col-2)*.07,growth:{level:row}});
          renderer.render(scene,cam);g.drawImage(renderer.domElement,col*crop,row*crop);
        }
        return atlas.toDataURL('image/webp',.96).split(',')[1];
      };
      return forms.map(form=>form.id);
    });
    const jobs=ids.flatMap(id=>[1,2,3].map(level=>({id,level})));
    if(process.argv.includes('--legacy'))jobs.unshift({id:'plumage',level:0});
    for(const job of jobs){
      const data=await page.evaluate(job=>window.renderPlumage(job),job);
      const name=job.level?job.id+'-'+job.level:'plumage';
      fs.writeFileSync('public/assets/v10/fieldwork-raft-'+name+'.webp',Buffer.from(data,'base64'));
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
