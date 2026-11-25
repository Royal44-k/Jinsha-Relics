import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

// Isolated asset/pose verification; deliberately not a frame-rate benchmark.
const out = 'docs/v3';
await fs.mkdir(out, { recursive: true });
const server = await createServer({ root: process.cwd(), server: { port: 5193, strictPort: true, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 960 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/__character-v3', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body style="margin:0;background:#10201e;color:#d5e7d9;font:17px sans-serif"></body></html>' }));
try {
  await page.goto('http://127.0.0.1:5193/__character-v3');
  const rear = process.env.CHARACTER_VIEW === 'rear';
  const report = await page.evaluate(async rear => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { createCharacter } = await import('/src/v2/character.js');
    const character = await createCharacter();
    const scene = new T.Scene(); scene.background = new T.Color('#162d29');
    const camera = new T.PerspectiveCamera(34, 400 / 480, .01, 30);
    camera.position.set(1.8, 1.12, -2.8); camera.lookAt(0, .66, .03);
    const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(1600, 960); renderer.setPixelRatio(1); renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25; renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);
    scene.add(new T.HemisphereLight('#c1e6de', '#7d6e4d', 1.3));
    const key = new T.DirectionalLight('#ffe6bf', 3.4); key.position.set(-2, 4, -3); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -2; key.shadow.camera.right = 2;
    key.shadow.camera.top = 2; key.shadow.camera.bottom = -2; key.shadow.normalBias = .008; scene.add(key);
    const rim = new T.DirectionalLight('#9cc9c4', 2.3); rim.position.set(2, 1.5, 3); scene.add(rim);
    const floor = new T.Mesh(new T.CircleGeometry(4, 48), new T.MeshStandardMaterial({ color: '#25443b', roughness: .96 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0; floor.receiveShadow = true; scene.add(floor);
    const branch = new T.Mesh(new T.CylinderGeometry(.065, .085, 1.3, 9), new T.MeshStandardMaterial({ color: '#665743', roughness: .92 }));
    branch.rotation.z = Math.PI / 2; branch.position.set(0, -.065, -.035); branch.castShadow = true; branch.receiveShadow = true; branch.visible = false; scene.add(branch);
    scene.add(character.group);
    const bones = {}; character.group.traverse(node => { if (node.isBone) bones[node.name] = node; });
    const skin = character.group.getObjectByName('Shuoyu_skin');
    const footIndices = {};
    for (const side of ['L', 'R']) {
      const index = skin.skeleton.bones.indexOf(bones[`Foot${side}`]);
      footIndices[side] = [];
      for (let i = 0; i < skin.geometry.attributes.position.count; i++) {
        if (skin.geometry.attributes.skinIndex.getX(i) === index) footIndices[side].push(i);
      }
    }
    const sample = new T.Vector3();
    const soleHeight = side => {
      let min = Infinity;
      for (const i of footIndices[side]) { skin.getVertexPosition(i, sample); min = Math.min(min, sample.y); }
      return min;
    };
    let t = 0, finite = true, maxBlink = 0;
    const step = (state, frames) => {
      for (let j = 0; j < frames; j++) {
        t += 1 / 60; character.update(1 / 60, t, state); character.group.updateMatrixWorld(true);
        for (const bone of Object.values(bones)) finite &&= bone.matrixWorld.elements.every(Number.isFinite);
        maxBlink = Math.max(maxBlink, character.group.getObjectByName('Eyelids').morphTargetInfluences[0]);
      }
    };
    step({ mode: 'grounded', speed: 0 }, 360);
    const idleSoles = [soleHeight('L'), soleHeight('R')];
    let walkMin = Infinity, walkSupportMax = -Infinity;
    const gait = [];
    for (const speed of [.6, 1.9, 3.3]) {
      step({ mode: 'grounded', speed }, 90);
      let min = Infinity, supportMax = -Infinity, plantedSlip = 0, previousFootZ = null, previousPhase = null;
      const stride = T.MathUtils.lerp(.66, .86, T.MathUtils.clamp((speed - 1.2) / 2.1, 0, 1));
      for (let frame = 0; frame < 180; frame++) {
        step({ mode: 'grounded', speed }, 1);
        const support = Math.min(soleHeight('L'), soleHeight('R'));
        min = Math.min(min, support); supportMax = Math.max(supportMax, support);
        const phase = character.group.userData.motion?.phase;
        bones.FootL.getWorldPosition(sample);
        if (phase < .61 && phase > .08 && previousPhase < .61 && previousPhase > .02 && phase > previousPhase) {
          plantedSlip = Math.max(plantedSlip, Math.abs(sample.z - previousFootZ - speed / 60));
        }
        previousFootZ = sample.z; previousPhase = phase;
      }
      gait.push({ speed, cycleDistance: stride, minSole: min, highestSupportSole: supportMax, maximumStanceSlipPerFrame: plantedSlip });
      walkMin = Math.min(walkMin, min); walkSupportMax = Math.max(walkSupportMax, supportMax);
    }
    // A translated and yawed character catches accidental local/world sampling.
    character.group.position.set(2, .4, -3); character.group.rotation.y = 1.1;
    let terrainQueries = 0;
    const slopeHeight = p => .4 + (p.x - 2) * .18 + (p.z + 3) * .12;
    const sampleGround = p => { terrainQueries++; return slopeHeight(p); };
    step({ mode: 'grounded', speed: 0, sampleGround }, 120);
    const slopeAnkleErrors = ['L', 'R'].map(side => {
      bones[`Foot${side}`].getWorldPosition(sample);
      return Math.abs(sample.y - slopeHeight(sample) - .07);
    });
    const beforePerch = terrainQueries; step({ mode: 'perched', sampleGround }, 30);
    const perchSkipsTerrain = terrainQueries === beforePerch;
    character.group.position.set(0, 0, 0); character.group.rotation.y = 0;
    const modes = [
      ['IDLE · BREATH / GAZE', { mode: 'grounded', speed: 0 }, 90],
      ['WALK · CONTACT / WEIGHT', { mode: 'grounded', speed: 1.9 }, 47],
      ['RISE · SHOULDER / WRIST', { mode: 'rising', speed: 2.2, verticalSpeed: 3, wingbeat: 1 }, 36],
      ['GLIDE · BANK / FEATHER FLEX', { mode: 'gliding', speed: 5.4, bank: .22, pitch: -.06, wingbeat: .08 }, 100],
      ['LAND · COMPRESSION', { mode: 'grounded', speed: .2 }, 8],
      ['PERCH · BALANCE / CLAW', { mode: 'perched', perchId: 'preview' }, 90],
      ['SWIM · PADDLE / WET', { mode: 'swimming', speed: 1, wetness: 1 }, 130],
      ['DIVE · STREAMLINE', { mode: 'diving', speed: 2, pitch: -.35, wetness: 1 }, 100],
    ];
    renderer.setScissorTest(true);
    const poses = [];
    for (let i = 0; i < modes.length; i++) {
      const [label, state, frames] = modes[i]; step(state, frames);
      // Keep the pose sheet readable; blinking is independently sampled above.
      if (character.group.getObjectByName('Eyelids').morphTargetInfluences[0] > .4) step(state, 12);
      const x = (i % 4) * 400, y = i < 4 ? 480 : 0;
      renderer.setViewport(x, y, 400, 480); renderer.setScissor(x, y, 400, 480);
      floor.visible = !['rising', 'gliding', 'swimming', 'diving', 'perched'].includes(state.mode);
      branch.visible = state.mode === 'perched';
      camera.position.set(rear ? .1 : 1.8, 1.12, rear ? 3.0 : -2.8); camera.lookAt(0, .66, .03);
      if (state.mode === 'diving') { camera.position.set(1.65, 1.0, -3.0); camera.lookAt(0, .40, -.45); }
      renderer.render(scene, camera);
      const caption = document.createElement('div'); caption.textContent = label;
      caption.style.cssText = `position:absolute;left:${x + 20}px;top:${960 - y - 460}px;font-size:13px;letter-spacing:1px;color:#cce1c6;`; document.body.appendChild(caption);
      poses.push({ mode: state.mode, leftWing: bones.WingL.quaternion.toArray(), leftFoot: bones.FootL.quaternion.toArray(), debug: { ...character.group.userData.motion } });
    }
    renderer.setScissorTest(false);
    const wetRoughness = character.group.getObjectByName('Shuoyu_plumage').material.roughness;
    step({ mode: 'grounded', speed: 0, wetness: 0 }, 300);
    const dryRoughness = character.group.getObjectByName('Shuoyu_plumage').material.roughness;
    step({ gliding: true, speed: 4 }, 90);
    const legacyGlide = character.group.userData.motion?.mode === 'gliding';
    character.update(NaN, NaN, { speed: NaN, bank: NaN, pitch: Infinity });
    character.group.updateMatrixWorld(true);
    for (const bone of Object.values(bones)) finite &&= bone.matrixWorld.elements.every(Number.isFinite);
    const gripMorph = skin.morphTargetDictionary?.PerchGrip === 0;
    const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    character.dispose(); character.dispose();
    return { method: 'GLB runtime imported and real skinned vertex positions sampled, eight posed WebGL renders; no performance claim', renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), finite, maxBlink, idleSoles, walkMin, walkSupportMax, gait, slopeAnkleErrors, terrainQueries, perchSkipsTerrain, wetRoughness, dryRoughness, legacyGlide, gripMorph, disposed: !character.group.parent, poses };
  }, rear);
  report.pageErrors = errors;
  const baseline = process.env.CHARACTER_BASELINE === '1';
  await page.screenshot({ path: `${out}/character-${baseline ? 'baseline' : 'contact-sheet'}${rear ? '-rear' : ''}.png` });
  await fs.writeFile(`${out}/character-${baseline ? 'baseline' : 'verification'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!baseline && (!report.finite || errors.length || report.walkMin < -.008 || report.walkSupportMax > .018 || report.maxBlink < .95 || report.wetRoughness >= report.dryRoughness || !report.legacyGlide || !report.gripMorph || !report.disposed || !report.perchSkipsTerrain || report.slopeAnkleErrors.some(error => error > .008) || report.gait.some(g => g.maximumStanceSlipPerFrame > .007))) throw new Error('Character pose verification failed');
} finally { await browser.close(); await server.close(); }
