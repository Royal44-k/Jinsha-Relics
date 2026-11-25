// Verify the exact mobile release file, including full video/audio decoding.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const dir=path.join(root,'docs/v16/发布物料');
const name='金沙古蜀秘境_实机预告_竖屏.mp4';
const file=path.join(dir,name);
const ff=process.env.FFMPEG||'ffmpeg';
const test=spawnSync(ff,['-hide_banner','-nostats','-i',file,'-vf','blackdetect=d=0.24:pix_th=0.06','-af','ebur128=peak=true:framelog=verbose','-f','null','-'],{encoding:'utf8',maxBuffer:16e6});
if(test.status!==0)throw new Error(test.stderr);
const log=test.stderr;
const video=log.split('\n').find(l=>l.includes('Video: h264'));
const audio=log.split('\n').find(l=>l.includes('Audio: aac'));
assert.match(video,/1080x1920/);assert.match(video,/25 fps/);assert.match(video,/bt709/);
assert.match(audio,/48000 Hz, stereo/);
assert.ok(!log.includes('black_start:'));
const integrated=Number(log.match(/Integrated loudness:\s*I:\s*([-\d.]+) LUFS/)?.[1]);
const peak=Number(log.match(/True peak:\s*Peak:\s*([-\d.]+) dBFS/)?.[1]);
assert.ok(integrated>=-19&&integrated<=-13,integrated);assert.ok(peak<=-.8,peak);
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser=await chromium.launch({headless:true,executablePath:edge});
const cuts=[
 ['铜鸟支护','bronze',0],['沿河飞行','flight',3.96],['群鸟惊飞','birds',7],
 ['竹排掌舵','raft',10.48],['金箔透光','foil',14],['象牙摄影','ivory',19.72],
 ['观察证物','investigation',25.08],['配证研判','pair',28.96],['柱洞测绘','posts',33.24],['冬至候日','dawn',36.92]
];
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 await page.goto(pathToFileURL(file).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);
 const info=await page.locator('video').evaluate(async v=>{
  v.muted=true;v.currentTime=.05;await v.play();
  await new Promise(r=>setTimeout(r,550));v.pause();
  return {duration:v.duration,width:v.videoWidth,height:v.videoHeight,advanced:v.currentTime>.22};
 });
 assert.equal(info.width,1080);assert.equal(info.height,1920);assert.ok(Math.abs(info.duration-44.4)<.05);assert.ok(info.advanced);
 const takes=[];
 const rushes=process.env.JINSHA_RUSHES||path.join(tmpdir(),'jinsha-v16-rushes');
 for(const [title,take,start] of cuts){
  const sample=start+.56;
  const seen=await page.locator('video').evaluate(async(v,t)=>{const seek=new Promise(ok=>v.addEventListener('seeked',ok,{once:true}));v.currentTime=t;await seek;return {time:v.currentTime,ready:v.readyState};},sample);
  assert.ok(seen.ready>=2&&Math.abs(seen.time-sample)<.06);
  const cap=JSON.parse(await readFile(path.join(rushes,take,'frames.json'),'utf8'));
  takes.push({title,start,sample,source:take,captureFrames:cap.frames.length,captureSeconds:Number(cap.seconds.toFixed(2))});
 }
 const coverName='视频封面-铜鸟实机.jpg';
 await page.goto(pathToFileURL(path.join(dir,coverName)).href);
 const cover=await page.locator('img').evaluate(i=>({width:i.naturalWidth,height:i.naturalHeight}));
 assert.equal(cover.width,1080);assert.equal(cover.height,1440);
 const bytes=await stat(file);
 const proof={file:name,bytes:bytes.size,sha256:createHash('sha256').update(await readFile(file)).digest('hex'),seconds:info.duration,
 video:video.trim(),audio:audio.trim(),fullDecode:true,blackRunsLongerThan240ms:0,integratedLUFS:integrated,truePeakDbTP:peak,
 phone:{browser:'Edge',viewport:[390,844],advanced:info.advanced,seeks:cuts.length},cover:{file:coverName,...cover},
 audioSource:'实际游戏 Web Audio 河岸环境与配乐＋本项目旁白与烁羽语音 WAV。对白按句剪辑。',shots:takes};
 await writeFile(path.join(root,'docs/v16/实机预告验收.json'),JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify(proof));
}finally{await browser.close();}
