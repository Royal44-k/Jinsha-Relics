const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{ chromium }=require('playwright');
const project=path.join(__dirname,'..');
async function bake(){
  const browser=await chromium.launch({executablePath:process.env.JINSHA_EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const page=await browser.newPage({viewport:{width:864,height:510}});
    const base=process.env.JINSHA_ORIGIN||'http://127.0.0.1:5197',url=base+'/__bake-autumnwood';
    const fixture='<!doctype html><style>*{margin:0}main{width:864px;height:510px}</style><main></main><script type=module>import * as T from "/node_modules/three/build/three.module.js";import {fieldStudio,mesh,mat,V} from "/src/v10/fieldwork-studio.js";import {buildRoots} from "/src/v10/fieldwork-roots.js";import {growCrown} from "/src/v10/fieldwork-canopy.js";window.libs={T,fieldStudio,mesh,mat,V,buildRoots,growCrown};</script>';
    await page.route(url,r=>r.fulfill({contentType:'text/html',body:fixture}));await page.goto(url);await page.waitForFunction(()=>window.libs);
    await page.evaluate(async()=>{
      const {T,fieldStudio,mesh,mat,V,buildRoots,growCrown}=window.libs;
      const ctx={view:document.querySelector('main'),onClose(){},closed:false};
      const studio=fieldStudio(ctx,{background:0x81937a,sky:0xe1ead0,bounce:0x748c61,key:0xffe7b3,fog:.025,zoom:3.75});
      studio.software=false;const {renderer,scene}=studio;
      renderer.setPixelRatio(1);renderer.setSize(864,510,false);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
      const light=scene.children.find(o=>o.isDirectionalLight);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-6,right:6,top:7,bottom:-7,far:34});light.shadow.bias=-.0005;
      buildRoots(ctx,studio);
      const hero=studio.texture('/assets/v10/fieldwork-autumnwood.webp');
      const backdrop=document.createElement('canvas');backdrop.width=4;backdrop.height=256;const bg=backdrop.getContext('2d'),mist=bg.createLinearGradient(0,0,0,256);
      mist.addColorStop(0,'#a2ab95');mist.addColorStop(.56,'#89947c');mist.addColorStop(1,'#66735d');bg.fillStyle=mist;bg.fillRect(0,0,4,256);
      scene.background=new T.CanvasTexture(backdrop);scene.background.colorSpace=T.SRGBColorSpace;
      const earth=mesh(scene,new T.PlaneGeometry(70,70),mat(0xa49f75,.97,{map:studio.texture('/assets/v5/ground/aerial_grass_rock_diff_1k.webp','color',[11,11])}),V(0,-.04,0));earth.rotation.x=-Math.PI/2;
      const grow=growCrown(studio);scene.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});
      // Grow uses vertex displacement. Standard shadow-depth materials would
      // report the final tree from the start, so omit its shadow during emergence.
      scene.traverse(n=>{if(n.isInstancedMesh)n.castShadow=false;});
      const camera=new T.PerspectiveCamera(45,864/510,.03,120),frame=document.createElement('canvas');frame.width=864;frame.height=510;const paint=frame.getContext('2d');
      window.frame=t=>{const k=T.MathUtils.smootherstep(t,0,1),a=.16+.25*k,r=6.9+6.3*k;
        grow(Math.min(1,t/.72));camera.position.set(Math.sin(a)*r,3.8+2.1*k,Math.cos(a)*r);camera.lookAt(0,.79+2.46*k,0);
        renderer.render(scene,camera);paint.globalAlpha=1;paint.drawImage(renderer.domElement,0,0);
        if(hero.image&&t>.70){const blend=T.MathUtils.smootherstep(t,.70,1);paint.globalAlpha=blend;const scale=1.07-.07*blend,w=864*scale,h=510*scale;
          paint.drawImage(hero.image,(864-w)*.42,(510-h)*.42,w,h);}
        return frame.toDataURL('image/jpeg',.93).split(',')[1];
      };
    });
    await page.waitForLoadState('networkidle');
    const ffmpeg=process.env.JINSHA_FFMPEG||path.join(process.env.LOCALAPPDATA,'ms-playwright/ffmpeg-1011/ffmpeg-win64.exe');
    const target=path.join(project,'public/assets/v10/fieldwork-autumnwood-growth.webm');
    const proc=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-c:v','mjpeg','-framerate','24','-i','pipe:0','-an','-c:v','libvpx','-b:v','1750k','-deadline','good','-cpu-used','3','-pix_fmt','yuv420p',target],{stdio:['pipe','ignore','inherit'],windowsHide:true});
    const done=new Promise((res,rej)=>{proc.on('error',rej);proc.on('exit',n=>n===0?res():rej(new Error('ffmpeg '+n)));});done.catch(()=>{});
    let pipeError;proc.stdin.on('error',e=>{pipeError=e;});
    const frames=108;
    for(let i=0;i<frames;i++){
      const t=Math.min(1,i/(frames-9)),jpg=Buffer.from(await page.evaluate(t=>window.frame(t),t),'base64');
      if(pipeError)throw pipeError;
      if(!proc.stdin.write(jpg))await require('node:events').once(proc.stdin,'drain');
      if(i===0||i===frames-1)fs.writeFileSync(path.join(project,'public/assets/v10/fieldwork-growth-'+(i?'crown':'root')+'.jpg'),jpg);
    }
    proc.stdin.end();await done;console.log(fs.statSync(target).size+' bytes, '+frames+' frames');
  }finally{await browser.close();}
}
bake().catch(e=>{console.error(e);process.exitCode=1;});
