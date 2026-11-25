import { chromium } from 'playwright';
import { createServer } from 'vite';
import { existsSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// One camera, one exposure and one final crop keep growth stages comparable.
const cacheDir = await mkdtemp(join(tmpdir(), 'jinsha-portrait-vite-'));
const server = await createServer({
  configFile: false, root: process.cwd(), cacheDir, logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, hmr: false },
  optimizeDeps: { include: ['three', 'three/addons/loaders/GLTFLoader.js'] }
});
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const executablePath = process.env.BROWSER_PATH || (existsSync(edge) ? edge : undefined);
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath, headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage();
  await page.route('**/__river_portraits', route => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Shuoyu field portraits</title>'
  }));
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/__river_portraits');
  const portraits = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { RoomEnvironment } = await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js');
    const { createCharacter } = await import('/src/v2/character.js');
    const { applyRiverPlumage } = await import('/src/v10/river-plumage.js');
    const size = 1480;
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.setClearColor(0, 0);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .98;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;
    const scene = new T.Scene();
    const generator = new T.PMREMGenerator(renderer);
    const studio = new RoomEnvironment();
    const reflection = generator.fromScene(studio, .045);
    scene.environment = reflection.texture;
    scene.environmentIntensity = .26;
    studio.dispose();
    generator.dispose();
    const camera = new T.OrthographicCamera(-.94, .94, .94, -.94, .1, 15);
    camera.position.set(3.00, 1.02, -1.75);
    camera.lookAt(0, .64, .11);
    scene.add(new T.HemisphereLight('#d5e2ee', '#877252', .78));
    function lamp(color, intensity, x, y, z) {
      const light = new T.DirectionalLight(color, intensity);
      light.position.set(x, y, z);
      scene.add(light);
      return light;
    }
    const key = lamp('#fff0d8', 2.36, -.5, 3.8, -3.6);
    key.target.position.y = .68;
    scene.add(key.target);
    key.castShadow = true;
    Object.assign(key.shadow.camera, {left:-1, right:1, top:1, bottom:-1, near:1, far:9});
    key.shadow.mapSize.set(2048,2048);
    key.shadow.normalBias = .0035;
    key.shadow.bias = -.00018;
    key.shadow.intensity = .55;
    key.shadow.radius = 3;
    lamp('#c2dae4', .92, 3.5, 1.1, -1.0);
    lamp('#f9ddb5', 1.57, -2.3, 2.9, 3.4);
    const frames = [];
    let xmin=size,ymin=size,xmax=0,ymax=0;
    for (let level=0;level<3;level++) {
      const bird = await createCharacter({ plumage: applyRiverPlumage });
      scene.add(bird.group);
      for (let frame=0;frame<90;frame++) {
        bird.update(1/60, frame/60, { mode:'grounded', speed:0, attentionYaw:-.085, growth:{level} });
      }
      renderer.render(scene,camera);
      if (renderer.getContext().getError() || bird.getGrowth().level !== level) throw new Error('Incomplete portrait render');
      const shot = document.createElement('canvas');
      shot.width=shot.height=size;
      const ctx = shot.getContext('2d', {willReadFrequently:true});
      ctx.drawImage(renderer.domElement,0,0);
      const rgba = ctx.getImageData(0,0,size,size).data;
      for (let y=0;y<size;y++) for (let x=0;x<size;x++) {
        if (rgba[(y*size+x)*4+3]<16) continue;
        xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);
      }
      frames.push(shot);
      scene.remove(bird.group);
      bird.dispose();
    }
    if (xmin<4 || ymin<4 || xmax>size-5 || ymax>size-5 || ymax-ymin<size*.4) throw new Error('Character clipped or missing');
    const extent=Math.ceil(Math.max(xmax-xmin+1,ymax-ymin+1)*1.10);
    const left=(xmax+xmin+1-extent)/2,top=(ymax+ymin+1-extent)/2;
    const output=frames.map(frame=>{
      const image=document.createElement('canvas');image.width=image.height=900;
      const ctx=image.getContext('2d');
      ctx.imageSmoothingQuality='high';
      ctx.drawImage(frame,left,top,extent,extent,0,0,900,900);
      const url=image.toDataURL('image/webp',.97);
      if (!url.startsWith('data:image/webp;base64,')) throw new Error('WebP encoder unavailable');
      return url.split(',')[1];
    });
    reflection.dispose();
    renderer.dispose();
    return output;
  });
  for (let level=0;level<portraits.length;level++) {
    const file=resolve('public/assets/v10','growth-'+level+'.webp');
    const bytes=Buffer.from(portraits[level],'base64');
    await writeFile(file,bytes);
    console.log(file,bytes.length);
  }
} finally {
  await browser?.close();
  await server.close();
}
