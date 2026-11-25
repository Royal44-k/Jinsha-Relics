import {chromium} from 'playwright';
import {createServer} from 'vite';
import {existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const server = await createServer({server:{host:'127.0.0.1',port:0,strictPort:false},logLevel:'error'});
await server.listen();
let browser;
try {
  browser = await chromium.launch({headless:true,executablePath:existsSync(edge)?edge:undefined,
    args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page = await browser.newPage();
  page.on('pageerror',error=>console.error(error.message));
  page.on('requestfailed',request=>console.error(request.url(),request.failure()));
  await page.route('**/__form-studio',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0"></body>'}));
  await page.goto(server.resolvedUrls.local[0]+'__form-studio',{waitUntil:'domcontentloaded',timeout:120000});
  console.log('Studio ready');
  const portraits = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const {createCharacter} = await import('/src/v2/character.js');
    const {forms} = await import('/src/v11/collection-data.js');
    const {applyCollectionLook} = await import('/src/v11/collection-look.js');
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(26,1,.02,20);
    const renderer = new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(560,560); renderer.setClearColor(0,0);
    renderer.toneMapping=T.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.07;
    camera.position.set(2.32,1.12,-1.86);
    camera.lookAt(0,.65,.04);
    scene.add(new T.HemisphereLight('#d4e8e2','#736956',1.40));
    const key = new T.DirectionalLight('#ffe8cc',2.65);
    key.position.set(2.1,3.2,-2.6); scene.add(key);
    const rim = new T.DirectionalLight('#b5deda',1.5);
    rim.position.set(-2.6,2,2.5); scene.add(rim);
    const character = await createCharacter();
    scene.add(character.group);
    for (let frame=0;frame<80;frame++) character.update(1/60,frame/60,{mode:'grounded',speed:0,growth:{level:0}});
    const result = [];
    for (const form of forms) {
      for(let level=1;level<=3;level++) {
        applyCollectionLook(character,{...form,level});
        renderer.render(scene,camera);
        if (renderer.getContext().getError()) throw Error('WebGL render error');
        const id='form-'+form.id+(level===3?'':'-'+level);
        const miniature=document.createElement('canvas');miniature.width=miniature.height=80;
        const brush=miniature.getContext('2d');brush.imageSmoothingQuality='high';
        brush.drawImage(renderer.domElement,0,0,80,80);
        result.push({id,uri:renderer.domElement.toDataURL('image/webp',.89),miniature:miniature.toDataURL('image/webp',.54)});
      }
    }
    character.dispose(); renderer.dispose();
    const {createArtifactStage} = await import('/src/v11/collection-inspection.js');
    for(const [id,file] of [['sun','sun'],['jade','jade'],['bird','bronze']]){
      const canvas=document.createElement('canvas');document.body.append(canvas);
      const stage=await createArtifactStage(canvas,id,430);
      result.push({id:file,uri:canvas.toDataURL('image/webp',.89)});
      stage.dispose();canvas.remove();
    }
    return result;
  });
  const previews={};
  for (const {id,uri,miniature} of portraits) {
    if(miniature)previews[id]=miniature;
    const result = Buffer.from(uri.split(',')[1],'base64');
    await writeFile('public/assets/v11/collections/'+id+'.webp',result);
    console.log(id,result.byteLength);
  }
  await writeFile('src/v11/collection-form-previews.json',JSON.stringify(previews,null,2)+'\n');
} finally {
  await browser?.close();
  await server.close();
}

