import {chromium} from 'playwright';
import {createServer} from 'vite';
import {existsSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const server=await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});
await server.listen();
const executable='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:existsSync(executable)?executable:undefined});
try{
  const page=await browser.newPage();
  await page.route('**/check-corridors',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));
  await page.goto(server.resolvedUrls.local[0]+'check-corridors');
  const report=await page.evaluate(async()=>{
    const [T,{createSurveyWorld,origin,sites,ground},{createLandscape},{createStations},{createRiverHabitat},{createFieldTrails,FIELD_TRAILS},{planSurveyFlight,advanceSurveyFlight}]=await Promise.all([
      import('/node_modules/three/build/three.module.js'),import('/src/v10/geography.js'),import('/src/v10/landscape.js'),import('/src/v10/stations.js'),
      import('/src/v10/river-habitat.js'),import('/src/v11/field-trails.js'),import('/src/v10/survey-flight.js')
    ]);
    const scene=new T.Scene(),world=createSurveyWorld();createLandscape(scene,world);
    const stations=createStations(scene,world),habitat=createRiverHabitat(scene,world);createFieldTrails(scene,{},world);
    const points=[origin,...sites,...FIELD_TRAILS.map(f=>f.entry)].map(([x,z])=>new T.Vector3(x,Math.max(0,ground(x,z)),z));
    for(let i=0;i<points.length;i++){stations.update(i,9,points[i]);await habitat.prime(i,points[i]);}await stations.ready;
    const missing=[],blocked=[];let routes=0,furthest=0;
    for(let a=0;a<points.length;a++)for(let b=0;b<points.length;b++){
      if(a===b)continue;routes++;
      const start=points[a].clone(),end=points[b];
      const run=planSurveyFlight(world,start,end);if(!run){missing.push([a,b]);continue;}
      let status;do{status=advanceSurveyFlight(world,run,start,.06);}while(status==='moving');
      if(status!=='arrived')blocked.push([a,b,run.leg,start.toArray()]);
      else furthest=Math.max(furthest,start.distanceTo(end));
    }
    return {routes,missing,blocked,largestArrivalErrorMeters:furthest,colliders:world.colliders.length,registeredPerches:world.perches.length};
  });
  await mkdir('docs/v12/traversal',{recursive:true});await writeFile('docs/v12/traversal/corridors.json',JSON.stringify(report,null,2));
  console.log(report);assert.deepEqual(report.missing,[]);assert.deepEqual(report.blocked,[]);assert.ok(report.largestArrivalErrorMeters<.001);
}finally{await browser.close();await server.close();}
