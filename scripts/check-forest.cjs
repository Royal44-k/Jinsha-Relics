const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto('http://127.0.0.1:5186/forest-preview.html');
    await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
    const report = [];
    for (const [name, fraction] of [['entry', .015], ['root-vault', .09], ['river', .20], ['jade', .42], ['sun', .94]]) {
      report.push({ name, ...await page.evaluate(f => window.shot(f), fraction) });
      await page.screenshot({ path: 'docs/v2/forest-' + name + '.png' });
    }
    const routes = await page.evaluate(() => {
      const w = window.preview.world;
      const branchMaxErrors = w.sidePaths.map(curve => Math.max(...Array.from({ length: 101 }, (_, i) => {
        const p = curve.getPointAt(i / 100); return p.distanceTo(w.constrain(p));
      })));
      return { start: w.sample(0).toArray(), length: w.length, branchMaxErrors,
        landmarks: w.landmarks.map(l => ({ id: l.id, position: l.position.toArray() })), cameraColliders: w.cameraColliders.length,
        mainPathMaxError: Math.max(...Array.from({ length: 501 }, (_, i) => {
          const p = w.sample(i / 500 * w.length); return p.distanceTo(w.constrain(p));
        })) };
    });
    const sightlines = await page.evaluate(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const w = window.preview.world; w.group.updateMatrixWorld(true);
      return w.landmarks.map((landmark, i) => {
        const from = w.sample(i ? w.landmarks[i - 1].distance + 4 : 0).add(new THREE.Vector3(0, 2.2, 0));
        const to = landmark.object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, .65, 0));
        const direction = to.clone().sub(from), distance = direction.length();
        const ray = new THREE.Raycaster(from, direction.normalize(), .2, distance - 2);
        const hits = ray.intersectObjects(w.cameraColliders, false);
        return { id: landmark.id, distance, occludedByGeometry: hits.length > 0, firstHit: hits[0]?.object.name || hits[0]?.object.parent?.name || null };
      });
    });
    fs.writeFileSync('docs/v2/forest-check.json', JSON.stringify({ errors, report, routes }, null, 2));
    fs.writeFileSync('docs/v2/forest-sightlines.json', JSON.stringify(sightlines, null, 2));
    assert.deepEqual(errors, []);
    assert.deepEqual(routes.start, [0, 0, 12]);
    assert.deepEqual(routes.branchMaxErrors, [0, 0]);
    assert.equal(routes.mainPathMaxError, 0);
    assert.deepEqual(routes.landmarks.map(l => l.id), ['bird', 'jade', 'mask', 'tiger', 'sun']);
    assert.ok(sightlines.every(s => s.occludedByGeometry), 'A future chapter must be physically occluded from the previous chapter');
    console.log(JSON.stringify({ errors, routes, sightlines, render: report.map(r => ({ name: r.name, ...r.render })) }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
