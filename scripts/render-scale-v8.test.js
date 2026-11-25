import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPixelRatio,RENDER_PIXEL_BUDGET} from '../src/v8/render-scale.js';

test('balanced separates high detail assets from the measured 1080p pixel budget',()=>{
 const dimensions={width:1920,height:1080,dpr:1.5,quality:'high'};
 assert.equal(renderPixelRatio(dimensions),1);
 assert.equal(renderPixelRatio({...dimensions,mode:'detail'}),1.5);
 assert.equal(renderPixelRatio({...dimensions,mode:'balanced'}),1);
 assert.deepEqual(dimensions,{width:1920,height:1080,dpr:1.5,quality:'high'});
});

test('resize and high-density displays obey budget and existing quality caps',()=>{
 for(const quality of ['high','low'])for(const [width,height,dpr]of [[1440,900,2],[1280,720,2],[1920,1080,2],[3840,2160,1],[390,844,3],[768,1024,1]]){
  const ratio=renderPixelRatio({width,height,dpr,quality});
  assert.ok(ratio<=Math.min(dpr,quality==='low'?1:1.5));
  assert.ok(width*height*ratio*ratio<=RENDER_PIXEL_BUDGET+1e-6);
  assert.ok(ratio>=.5);
 }
 assert.equal(renderPixelRatio({width:3840,height:2160,dpr:2,quality:'low'}),.5);
 assert.equal(renderPixelRatio({width:390,height:844,dpr:3}),1.5);
});

test('native low-density displays are preserved while extreme windows retain a legibility floor',()=>{
 for(const dpr of [.25,.5,.8,1])assert.equal(renderPixelRatio({width:800,height:600,dpr}),dpr);
 assert.equal(renderPixelRatio({width:7680,height:4320,dpr:1}),.5);
 assert.equal(renderPixelRatio({width:7680,height:4320,dpr:1,mode:'detail'}),1);
 assert.equal(renderPixelRatio({width:1280,height:720,dpr:3,quality:'low',mode:'detail'}),1);
});

test('stored invalid modes and startup dimensions produce finite conservative defaults',()=>{
 assert.equal(renderPixelRatio({width:1920,height:1080,dpr:2,mode:'obsolete'}),1);
 for(const bad of [0,-1,NaN,Infinity]){
  assert.equal(renderPixelRatio({width:1920,height:1080,dpr:bad}),1);
  assert.ok(Number.isFinite(renderPixelRatio({width:bad,height:bad,dpr:1.5})));
 }
 assert.equal(renderPixelRatio(),1);
});
