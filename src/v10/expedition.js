import {chapterIds,restore,encode,secureRecord,saveKey as defaultSaveKey,phases,rankNames,skillLevel,travelLines,siteFacts,validFilm} from './ledger.js';
import {createSurveyAudio} from './survey-audio.js';
import {bindListeningRoom} from '../v15/listening.js';
import {bindFullscreen} from '../v16/fullscreen.js';
import {observations} from './observations.js';

import {createCollection} from '../v11/collection.js';
import {collectionKey} from '../v11/collection-state.js';
import {createJourneyBook,journeyKey} from '../v14/journeys.js';
import {createJourneyWriter} from '../v14/journey-writer.js';
import {bindJourneyMenu} from '../v14/journeys-menu.js';
import {makeReviewDesk,reviewConnection} from '../v13/review.js';
import {holdField,whenFieldResumes} from '../v13/review-clock.js';
import {FIELD_TRAILS} from '../v11/field-locations.js';
import {renderFieldTriptych} from '../v14/field-triptych.js';
import {narratorIntro,firstWords,endingWords,witnesses,prompts} from '../v11/story.js';

const $=id=>document.getElementById(id);
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const westCourt=FIELD_TRAILS.find(place=>place.id==='carbon-rice');
const guest=reviewConnection();
bindFullscreen(guest ? window.parent.document : document);
let storage;try{storage=localStorage;}catch{}
const book=createJourneyBook(storage);
const address=new URL(location.href);
const requested=address.searchParams.get('journey');
const journeyId=guest?.journeyId??book.resolve(requested??history.state?.jinshaJourney);
const embark=!guest&&requested===journeyId&&address.searchParams.get('embark')==='1';
if(!guest){
  address.searchParams.delete('embark');
  if(requested&&requested!==journeyId)address.searchParams.delete('journey');
  history.replaceState({...history.state,jinshaJourney:journeyId},'',address);
}
const saveKey=journeyKey(journeyId,defaultSaveKey);
const record=guest?restore(guest.initialRecord):book.load(journeyId);
const audio=createSurveyAudio({onSpeechStart(text,role,seconds){
  if(mode==='travel'&&role==='spirit'&&$('travel-message').textContent==='烁羽　'+text){
    message('烁羽　'+text,Math.ceil(seconds*1000)+750);
  }
},onSpeechEnd(role){listening?.finished(role);}});audio.setMuted(record.muted);
const listening=bindListeningRoom({audio,storage,roleLines:{narrator:narratorIntro,spirit:firstWords},
  isMuted:()=>record.muted,toggleMute:toggleSound});
$('cover-sound').onclick=()=>listening.open();
let view=null,mode='title',chapters=[],stationType=[],stationSession=null,current=null,readyPromise=null;
let near=false,offerPerch=false,replay=false,toastTimer=0,returnFocus=null,previousMode='travel';
let chapterModules=null;
const collection=createCollection({
  key:journeyKey(journeyId,collectionKey),
  getCompleted:()=>record.completed,
  onNotice:text=>message(text),
  onEquip:traits=>{view?.setTraits?.(traits);audio.cue('plumage');}
});
const titleText=record.started?'继续探索':'开始探索';
$('enter').firstChild.textContent=titleText+' ';
function locationLabel(){
  if(mode==='activity')return current.site;
  if(mode==='finale')return '冬至候日';
  if(mode==='receipt')return '归档 · '+($('folio-title')?.textContent||current?.site||'冬至候日');
  if(mode==='journal')return $('folio-title')?.textContent||'田野手册';
  return $('place').textContent||chapters[view?.target??0]?.site||'河岸';
}
function holdExpedition(value,{keepSound=false}={}){
  document.body.toggleAttribute('data-review-paused',value);
  holdField(value);
  view?.pauseForReview(value);
  if(!keepSound)audio.pauseForReview(value);
}
function terraceSound(flotation=false){
  if(flotation){audio.setLocality?.('flotation',1);return;}
  if(!view||!westCourt||mode!=='travel'){audio.setLocality?.(null);return;}
  const position=view.position;
  const distance=Math.hypot(position.x-westCourt.x,position.z-westCourt.z);
  const proximity=Math.max(0,Math.min(1,(24-distance)/16));
  audio.setLocality?.(proximity?'west-court':null,proximity);
}
function holdFlotation(open){
  holdExpedition(open,{keepSound:true});
  terraceSound(open);
}
const desk=guest?null:makeReviewDesk({
  journeyId,
  getRecord:()=>record,siteName:id=>chapters[chapterIds.indexOf(id)].site,locationLabel,hold:holdExpedition,
  async commit(raw,changed){
    const result=restore(raw);
    if(changed.muted){record.muted=result.muted;syncMute();audio.setMuted(record.muted);}
    if(changed.photos&&result.photos.length)record.photos=result.photos;
    if(changed.revisited&&record.completed.includes(changed.revisited)){
      record.revisits[changed.revisited]=(record.revisits[changed.revisited]||0)+1;
    }
    const saved=await writer.save(changed);
    return {saved,archive:encode(record)};
  }
});
function openReplayLibrary(){if(guest)guest.choose();else desk.show();}
function repeatStation(index){if(guest)guest.again();else desk.play(chapterIds[index]);}
$('review-travel').onclick=$('review-sheet').onclick=openReplayLibrary;
const writer=createJourneyWriter({record,key:saveKey,storage,locks:navigator.locks,
  onFailure:()=>message('浏览器未能写入存档。当前页面内仍可继续。')});
async function persist(changed={}){
  if(!guest)return writer.save(changed);
  // The parent's Web Lock survives an immediate exit from the historical bench.
  const reply=await guest.commit(encode(record),changed);
  if(!reply)return false;
  Object.assign(record,restore(reply.archive));
  return reply.saved;
}
async function finishSaves(){
  await collection.finishPurchases();
  return writer.finish();
}
function message(value,ms=3400){
  clearTimeout(toastTimer);if(!value)return;$('travel-message').textContent=value;$('travel-message').hidden=false;
  toastTimer=setTimeout(()=>{$('travel-message').hidden=true;},ms);
}
function audioScene(m){
  const station=m==='activity'&&current?chapterIds.indexOf(current.id):view?.target??record.completed.length;
  audio.setScene(Math.min(Math.max(station,0),8),m);
}
function enterMode(m) {
  mode=m;document.body.dataset.mode=m;
  if(m!=='travel')audio.setLocality?.(null);
  $('transcript').open=false;
  $('cover').hidden=m!=='title'&&m!=='launching';
  $('overlay').hidden=m!=='travel';$('sheet').hidden=m!=='activity'&&m!=='finale';
  view?.setActive(m==='travel');if(m==='travel')view?.focus();audioScene(m);
}
let currentLine=null;
function speak(text,role){
  audio.speak(text,role);
  if(mode==='activity'||mode==='finale'){
    currentLine={text,role};
    $('transcript').querySelector('p').textContent=text;
  }
}
$('voice-replay').onclick=()=>{
  if(!currentLine)return;
  if(record.muted)toggleSound();else audio.unlock();
  audio.speak(currentLine.text,currentLine.role);
};
function toggleSound(){
  record.muted=!record.muted;audio.setMuted(record.muted);if(!record.muted)audio.unlock();
  syncMute();persist({muted:true});
}
function syncMute(){for(const id of ['mute','sheet-mute']){const b=$(id);b.textContent=record.muted?'声音 关':'声音 开';b.setAttribute('aria-pressed',String(!record.muted));}}
syncMute();$('mute').onclick=$('sheet-mute').onclick=toggleSound;
function part(tag,text,cls){const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;}
let closeExhibit=null;
function leaveExhibit(){closeExhibit?.();closeExhibit=null;}
$('folio').addEventListener('close',()=>{if(!$('folio').open)leaveExhibit();});
function folio(over,title,paragraphs,buttons,extra=null,layout=null) {
  leaveExhibit();
  $('folio').classList.remove('closing-plate','object-plate','bird-plate','ledger-open','prologue-open','receipt-open','collection-open');
  const body=$('folio-body'),isMap=layout==='map';
  body.replaceChildren();
  const header=isMap?part('header',null,'ledger-heading'):body;
  if(isMap){
    $('folio').classList.add('ledger-open');
    body.append(header);
    extra.classList.add('ledger-content');
    extra.tabIndex=0;extra.setAttribute('role','region');extra.setAttribute('aria-label','调查地图与现场记录');
  }
  header.append(part('span',over,'folio-over'));
  const heading=part('h2',title);heading.id='folio-title';header.append(heading);
  for(const p of paragraphs)if(p)header.append(part('p',p));
  if(extra)body.append(extra);
  const row=part(isMap?'nav':'div','','folio-buttons');
  if(isMap)row.setAttribute('aria-label','手册导航');
  for(const [label,run] of buttons){const b=part('button',label);b.onclick=run;row.append(b);}
  body.append(row);if(!$('folio').open){returnFocus=document.activeElement;$('folio').showModal();}else $('folio').scrollTop=0;
  row.firstElementChild?.focus({preventScroll:true});
}
function closeFolio(){
  if($('folio').open)$('folio').close();
  if(mode==='journal'){enterMode(previousMode);returnFocus?.focus({preventScroll:true});}
  else if(mode==='receipt'){if(guest)guest.back();else{replay=false;resumeTravel(true);}}
  else if(mode==='launching'&&!starting){enterMode('title');$('enter').focus();}
}
$('folio-close').onclick=closeFolio;
$('folio').addEventListener('cancel',e=>{e.preventDefault();if(!starting)closeFolio();});
function sources(){
  const list=part('div');list.innerHTML='<p>古河道、树根、分层埋藏的象牙和九处柱洞都有考古依据。烁羽、地图路线及古代建筑上部是游戏创作。</p><p><a href="https://www.jinshasitemuseum.com/node/216" target="_blank" rel="noopener">金沙遗迹馆 ↗</a>　<a href="https://www.jinshasitemuseum.com/seardetail/2191" target="_blank" rel="noopener">树种鉴定研究 ↗</a>　<a href="https://www.jinshasitemuseum.com/seardetail/681" target="_blank" rel="noopener">太阳神鸟金饰 ↗</a></p><p><a href="https://www.nopss.gov.cn/n/2015/0727/c358567-27367530.html" target="_blank" rel="noopener">九柱建筑的方位研究 ↗</a>　<a href="/credits-v10.html" target="_blank" rel="noopener">美术、声音与素材署名 ↗</a></p>';
  folio('成都平原　／　商周金沙','烁羽的来处',['烁羽取意于金沙铜鸟。它可以从空中看见地面的线条，也可以潜入水下看见河床的遗存。它的形态和能力，是你对这片土地的了解在游戏里的回响。'],[['合上',closeFolio]],list);
}
$('credits').onclick=sources;
function markStation(index){
  replay=index<record.completed.length;
  view.setTarget(record.completed.length,index);
  resumeTravel(false,true);
}
function markTrail(trail){
  replay=false;resumeTravel();view.trackSide(trail.id);message(trail.hint,8200);
}
function mapPlate(){
  const container=part('div');
  container.append(drawMap({count:record.completed.length,chapters,position:view.position,
    found:collection.snapshot().fieldFinds,selectedId:view.trackedTrail??chapterIds[view.target],markStation,markTrail,review:repeatStation}));
  const toolsRow=part('div','','field-tools');
  const compare=part('button','证据推理台','revisit'),cameraButton=part('button','河岸摄影','revisit');
  compare.onclick=async()=>{
    const {openInvestigation}=await import('../v16/investigation.js');
    if(!compare.isConnected||!$('folio').open)return;
    openInvestigation({completedCount:record.completed.length,storageKey:journeyKey(journeyId,'jinsha-evidence-desk-v16'),photos:record.photos,sound:(name,volume)=>audio.cue(name,volume)});
  };
  cameraButton.onclick=openRiverCamera;
  toolsRow.append(compare,cameraButton);container.append(toolsRow);
  const list=part('ol','','ledger-list');
  chapters.forEach((item,i)=>{const done=i<record.completed.length,known=i<=record.completed.length,li=part('li','',''+(known?'known':'locked'));
    li.append(part('small','0'+(i+1)+' / '+(done?'已归档':known?'待踏查':'未踏查')),part('b',known?item.site:'河雾之中'),part('small',done?item.reward:known?'当前地点':'—'));list.append(li);});
  container.append(list);return container;
}
function objectPlate(index){
  const plate=part('div','','field-plate');plate.append(makePlate(index));
  if(index===0)plate.append(lensButton());
  if(index===6&&record.photos.length===3){
    const film=part('div','','film-strip');
    ['叠压','断口','泥层'].forEach((name,i)=>{
      const frame=part('figure'),img=part('img');img.src=record.photos[i];img.alt='烁羽在现场记录的'+name;
      frame.append(img,part('figcaption','0'+(i+1)+'　'+name));film.append(frame);
    });
    plate.append(film);
  }
  return plate;
}
function lensButton(){
  const button=part('button','打开剖面放大镜','revisit lens-launch');
  button.type='button';button.onclick=()=>openLens(button);
  return button;
}
function flumeButton(){
  const trigger=part('button','进入古河水槽','revisit flume-launch');
  trigger.type='button';trigger.onclick=()=>openFlume(trigger);return trigger;
}
async function openFlume(trigger){
  if(!record.completed.length||document.getElementById('flume-room'))return;
  audio.unlock();
  const dialog=part('dialog'),host=part('section');
  dialog.id='flume-room';dialog.setAttribute('aria-label','古河水槽复勘室');
  const pending=part('p','正在布置水槽…'),close=part('button','返回','revisit');
  pending.setAttribute('role','status');host.append(pending,close);
  dialog.append(host);document.body.append(dialog);dialog.showModal();
  const controller=new AbortController();
  let dispose;
  close.onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{
    controller.abort();dispose?.();dialog.remove();if(trigger.isConnected)trigger.focus({preventScroll:true});
  },{once:true});
  try{
    const {mountFlume}=await import('../v12/flume.js');
    if(!dialog.open)return;
    host.replaceChildren();dispose=mountFlume(host,{completedCount:record.completed.length,storageKey:journeyKey(journeyId,'jinsha-flume-v1'),signal:controller.signal,sound:(name,volume)=>audio.cue(name,volume),onClose:()=>dialog.close()});
  }catch(e){
    if(dialog.open){host.replaceChildren(pending,close);pending.textContent='水槽未能展开。可返回手册，稍后再试。';console.warn('Water flume could not open',e);}
  }
}
async function openLens(trigger){
  if(document.getElementById('strata-dialog'))return;
  const dialog=part('dialog'),host=part('section'),close=part('button','返回观察','lens-close');
  dialog.id='strata-dialog';dialog.setAttribute('aria-label','探方剖面放大镜');
  dialog.append(close,host);document.body.append(dialog);
  let cleanup;
  dialog.addEventListener('close',()=>{cleanup?.();dialog.remove();if(trigger.isConnected)trigger.focus({preventScroll:true});},{once:true});
  close.onclick=()=>dialog.close();host.textContent='正在照亮剖面…';dialog.showModal();
  try{
    const {mountStrataLens}=await import('../v11/strata-lens.js');
    if(!dialog.open)return;
    host.replaceChildren();cleanup=mountStrataLens(host);
  }catch{if(dialog.open)host.textContent='图版暂未载入。可返回剖面继续取样，稍后再试。';}
}
function openCollection(page='gallery'){
  const fromHome=mode==='title';
  if(!fromHome && mode!=='journal'){previousMode='travel';enterMode('journal');}
  const panel=part('section');
  const gallery=page==='gallery';
  folio('烁羽　／　随身图鉴',gallery?'金沙珍藏':'羽装与能力',gallery?[]:['烁羽是取意于古蜀鸟形铜器的原创羽灵。观察器物、完成鉴定或在地图上发现遗物，都能积累成长经验。'],
    [[gallery?'查看羽装':'查看珍藏',()=>openCollection(gallery?'wardrobe':'gallery')],[fromHome?'回到标题':'回到地图',fromHome?closeFolio:journal]],panel);
  $('folio').classList.add('collection-open');
  if(gallery)collection.mountGallery(panel);
  else{
    const study=part('button','观察烁羽 · 三维角色志','revisit portrait-launch');
    study.id='observe-guide';study.type='button';study.onclick=openBirdPortrait;
    const line=part('p','','dossier-line');line.hidden=true;line.setAttribute('aria-live','polite');
    const listen=part('button','听烁羽说话','revisit');listen.type='button';
    listen.onclick=()=>{
      if(record.muted)toggleSound();else audio.unlock();
      line.hidden=false;line.textContent='烁羽　「'+firstWords+'」';audio.speak(firstWords,'spirit');
      closeExhibit=()=>audio.stopSpeech();
    };
    panel.append(study,listen,line);collection.mountWardrobe(panel);
  }
}
async function openBirdPortrait(){
  const fromHome=mode==='title';
  const host=part('section');
  function back(){
    openCollection('wardrobe');$('observe-guide')?.focus({preventScroll:true});
  }
  folio('随身图鉴　／　羽灵观察','烁羽',[],[
    ['返回羽装',back],[fromHome?'回到标题':'回到地图',fromHome?closeFolio:journal]
  ],host);
  $('folio').classList.add('collection-open');
  const controller=new AbortController();
  let dispose;
  closeExhibit=()=>{controller.abort();dispose?.();};
  const status=part('p','正在展开羽灵图版…');status.setAttribute('role','status');host.append(status);
  try{
    const {mountBirdPortrait}=await import('../v11/bird-portrait.js');
    if(controller.signal.aborted||!host.isConnected||!$('folio').open)return;
    host.replaceChildren();dispose=mountBirdPortrait(host,{traits:collection.traits(),reduced,signal:controller.signal});
  }catch{
    if(!controller.signal.aborted)host.replaceChildren(part('p','角色图版暂时未能展开。可返回羽装查看当前外形，再次打开观察。'));
  }
}
async function openGoldMask(){
  if(!record.ending)return;
  if(mode!=='journal'){previousMode='travel';enterMode('journal');}
  const host=part('section');
  folio('冬至之后　／　特别展品','商周大金面具',[],[['回到金沙图鉴',journal],['返回河岸',()=>resumeTravel(false)]],host);
  $('folio').classList.add('collection-open');
  const status=part('p','正在点亮展柜…');status.setAttribute('role','status');host.append(status);
  try{
    const {mountGoldMask}=await import('../v11/gold-mask.js');
    if(!host.isConnected||!$('folio').open)return;
    host.replaceChildren();closeExhibit=mountGoldMask(host);
  }catch{
    if(!host.isConnected)return;
    status.textContent='展柜未能载入。可从馆藏记录查看器形和尺寸。';
    const link=part('a','金沙遗址博物馆 · 商周大金面具 ↗');
    link.href='https://www.jinshasitemuseum.com/node/197';link.target='_blank';link.rel='noopener';host.append(link);
  }
}
function journal(){
  if(mode!=='journal'){previousMode=mode;enterMode('journal');}
  const n=record.completed.length,buttons=[['回到河岸',closeFolio],['声音设置',()=>listening.open()],['操作与无障碍',help],['羽灵档案',profile],['返回标题',toTitle]];
  buttons.splice(1,0,['回顾章节',openReplayLibrary]);
  if(n===9)buttons.splice(1,0,['重看终章',startFinale]);
  buttons.splice(1,0,['珍藏与鉴定',()=>openCollection()]);
  if(record.ending)buttons.splice(1,0,['金面具特展',openGoldMask]);
  if(record.fieldTriptych?.length===3)buttons.splice(1,0,['我的终章展签',()=>{
    folio('冬至之后　／　田野记录','我的终章展签',[],[['回到手册',journal]],renderFieldTriptych(record.fieldTriptych,record.photos));
  }]);
  const content=mapPlate();
  if(n)content.prepend(flumeButton());
  const trails=part('details','','margin-notes'),choices=part('div','','trail-options');
  trails.append(part('summary','地图支线　'+collection.snapshot().fieldFinds.length+' / '+FIELD_TRAILS.length),part('p','选一个地点标在罗盘上。循迹领航可带你抵达入口，到场后由你完成搜索。'),choices);
  for(const trail of FIELD_TRAILS){
    const found=collection.snapshot().fieldFinds.includes(trail.id);
    const canRepeat=trail.id==='carbon-rice';
    const button=part('button',(found?(canRepeat?'重访 · ':'已发现 · '):'标记 · ')+trail.title);
    button.disabled=found&&!canRepeat;button.title=trail.hint;
    button.onclick=()=>markTrail(trail);
    choices.append(button);
  }
  const resetTrail=part('button','追踪主线');resetTrail.onclick=()=>{replay=false;view.trackSide(null);resumeTravel();};choices.append(resetTrail);
  content.append(trails);
  if(n){const review=part('select');review.setAttribute('aria-label','翻看已获得的记录');
    for(let i=0;i<n;i++){const o=part('option',(i+1)+'　'+chapters[i].reward);o.value=String(i);review.append(o);}
    review.value=String(n-1);const fact=part('p',siteFacts[n-1]),plate=part('div');plate.append(objectPlate(n-1));
    review.onchange=()=>{const i=Number(review.value);fact.textContent=siteFacts[i];plate.replaceChildren(objectPlate(i));};content.append(review,plate,fact);
    const visit=part('button','重访选中地点 ↗','revisit');visit.onclick=()=>markStation(Number(review.value));content.append(visit);}
  if(n>=2){
    const aside=part('details','','margin-notes');aside.append(part('summary','野外旁注　'+record.observations.length+' / 3'));
    for(const note of observations.filter(o=>o.count<=n)){
      const known=record.observations.includes(note.id);
      aside.append(part('strong',known?note.title:note.at+' · 线索'),part('p',known?note.entry:note.hint));
    }
    content.append(aside);
  }
  const options=part('details','','margin-notes');options.append(part('summary','画面与性能'));
  const quality=part('select');quality.setAttribute('aria-label','地图画面质量');
  for(const [value,label] of [['auto','自动调节'],['high','清晰优先'],['economy','流畅优先']]){
    const item=part('option',label);item.value=value;quality.append(item);
  }
  quality.value=record.quality;quality.onchange=()=>{record.quality=quality.value;view.setQuality(quality.value);persist({quality:true});};
  options.append(part('p','调整河岸的三维渲染分辨率和动态阴影。手册文字与工作台保持清晰。'),quality);content.append(options);
  folio('田野手册　／　'+n+' · 9','古蜀探险地图',[n===9?'九处遗存都已辨认。可重访、鉴定珍藏或寻找地图支线。':'当前线索 · '+prompts[n][0]],buttons,content,'map');
}
function help(){folio('操作与辅助','在河岸行动',['W / S 前进与后退，A / D 或左右箭头控制烁羽转身。拖动画面环顾。Shift 快走，Alt 或 X 闪身。','空格轻跃、长按展翼，R 切换持续飞行，C 或 Ctrl 下降或入水，T 靠近枝头停栖。E 在工作点开始调查。','触屏左摇杆控制行走转向，右侧可跳、飞、潜。循迹领航会带你飞抵当前现场，途中可接管。各工作台提供各自的操作方法。'],[['回到手册',journal]]);}
function profile(){openCollection('wardrobe');}
$('cover-profile').onclick=profile;
$('notebook').onclick=journal;$('field-menu').onclick=journal;
function toTitle(){if($('folio').open)$('folio').close();replay=false;enterMode('title');$('enter').disabled=false;$('enter').firstChild.textContent=record.started?'继续探索 ':'开始探索 ';$('boot-state').textContent='';refreshJourneys?.();}
function updateMission(){
  const index=view.target,item=chapters[index],n=record.completed.length;
  $('act').textContent=record.ending?'重访 · '+phases[Math.floor(index/3)]:phases[Math.floor(index/3)]+'　／　'+(index+1)+' · 9';
  $('place').textContent=n===9&&!replay?'冬至候日':item.site;$('task').textContent=missionHint(index);$('guide').textContent='循迹领航';
  $('interact').hidden=true;near=false;$('waypoint').hidden=true;$('distance').textContent='';
  $('trace').hidden=n<1;$('trace').setAttribute('aria-pressed',String(view.tracing));
}
function missionHint(index){
  if(record.completed.length===9&&!replay)return record.ending?'九处现场已归档。按 J 选择重访、珍藏鉴定或野外拾遗。':'九处遗存已经辨认，回到九柱轴线，在东南地平线等候日出。';
  return prompts[index][1];
}
function trace(){
  if(!record.completed.length||mode!=='travel')return;
  const active=view.trace();$('trace').setAttribute('aria-pressed',String(active));
  if(active)audio.cue('measure');
  message(active?'辨迹已展开。青线勾出旧岸的推想位置。':'已合上测绘图。');
}
function observation(id){
  if(record.observations.includes(id))return;
  record.observations.push(id);persist();audio.cue('record');
  message('野外旁注 · '+observations.find(n=>n.id===id).title+'　已收入手册。',5500);
}
$('trace').onclick=trace;
function resumeTravel(advance=false,keepTarget=false){
  if($('folio').open)$('folio').close();
  if(!keepTarget)view.setTarget(record.completed.length);
  updateMission();enterMode('travel');$('travel-message').hidden=true;
  if(advance){const text=record.completed.length===9&&!replay?missionHint(view.target):travelLines[view.target];message('烁羽　'+text,6500);if(record.completed.length<9||replay)speak(text,'spirit');}
}
let arrivalStatus=null;
function renderStatus(status){
  if(mode==='travel'){paintStatus(status);terraceSound();}
  else if(starting)arrivalStatus=status;
}
function paintStatus({dist,relative,near:inside,mark,mode:movement,resource,guided,perch,perchLabel,sideHint,sideNear,sideId,nearbySideId,nearbySideHint}){
  near=inside;offerPerch=perch;
  const trail=FIELD_TRAILS.find(t=>t.id===sideId);
  const chapter=view.target;
  const heading=trail?.title||(record.completed.length===9&&!replay?'冬至候日':chapters[chapter].site);
  const act=trail?'支线　／　野外踏查':record.ending?'重访 · '+phases[Math.floor(chapter/3)]:phases[Math.floor(chapter/3)]+'　／　'+(chapter+1)+' · 9';
  if($('place').textContent!==heading)$('place').textContent=heading;
  if($('act').textContent!==act)$('act').textContent=act;
  const direction=Math.abs(relative)<.35?'↑ 向前':Math.abs(relative)>2.6?'↶ 身后':relative>0?'← 左方':'右方 →';
  const routeLabel=trail?'野外拾遗':replay?'重访记录':record.ending?'自由踏查':'沿岸调查';
  $('distance').textContent=(near?'已抵达':direction+'　'+Math.round(dist)+' 米')+'　·　'+routeLabel;
  $('energy').value=resource;$('motion-name').textContent=movement;$('guide').textContent=guided?'接管飞行':'循迹领航';
  const grip=$('perch');grip.hidden=!perch||guided;grip.textContent=perchLabel==='离枝展翼'?'离枝展翼 T':'停栖 · '+(perchLabel||'横枝')+' T';
  const e=$('interact');e.hidden=!near&&!sideNear;
  const hint=sideHint||missionHint(view.target);
  if($('task').textContent!==hint)$('task').textContent=hint;
  if(near)e.textContent='E　'+(record.completed.length===9&&!replay&&view.target===8?(record.ending?'重看冬至':'进入冬至候日'):'进入'+chapters[view.target].site);
  if(sideNear){
    const nearby=FIELD_TRAILS.find(t=>t.id===nearbySideId);
    e.textContent='E　调查'+(nearby?.title||'遗存');e.title=nearbySideHint||'';
  }else e.removeAttribute('title');
  const wp=$('waypoint');wp.hidden=near||guided||mark.z<0||mark.z>1||Math.abs(mark.x)>.91||Math.abs(mark.y)>.73;
  if(!wp.hidden){wp.style.transform='translate('+((mark.x+1)*innerWidth/2)+'px,'+((1-mark.y)*innerHeight/2)+'px) translate(-50%,-100%)';wp.lastElementChild.textContent=trail?trail.title:dist<17?chapters[view.target].site:'岸线线索';}
}
let starting=false,needsFreshPage=false;
function loadingStep(text,step){
  const meter=$('boot-meter');meter.setAttribute('aria-valuenow',step);meter.setAttribute('aria-valuetext',text);
  $('embark').style.setProperty('--bank-reveal',step*25+'%');$('boot-detail').textContent=text;
}
function prepareChapters(){
  if(!chapterModules)chapterModules=(async()=>{
    const [fields,shops,sacred,atlas,plates]=await Promise.all([import('./fieldwork.js'),import('./workshops.js'),import('./sanctuary.js'),import('./cartography.js'),import('./evidence-plates.js')]);
    drawMap=atlas.fieldNavigator;makePlate=plates.evidencePlate;
    chapters=[...fields.fieldwork,...shops.workshops,...sacred.sanctuary];
    if(chapters.some((c,i)=>c.id!==chapterIds[i])||chapters.length!==9)throw Error('章节次序有误');
    stationType=[fields.mountFieldwork,shops.mountWorkshops,sacred.mountSanctuary];finalMaker=sacred.mountFinale;
  })().catch(e=>{chapterModules=null;throw e;});
  return chapterModules;
}
async function prepare(){
  if(!readyPromise)readyPromise=(async()=>{
    const [terrain]=await Promise.all([import('./traverse.js'),prepareChapters()]);
    view=await terrain.createTraverse($('world-view'),{holdActivity:holdFlotation,cue:(s,v)=>audio.cue(s,v),birdSpeech:audio.birdSpeech,message,status:renderStatus,interact,observation,sideFind:id=>{const found=collection.discover(id);if(found)audio.cue('discovery');return found;},sideFinds:()=>collection.snapshot().fieldFinds,loadout:()=>collection.traits(),loading:loadingStep});view.setQuality(record.quality);
  })().catch(e=>{readyPromise=null;throw e;});
  return readyPromise;
}
let finalMaker,drawMap,makePlate;
async function revealRiver(){
  const sheet=$('embark');$('cover').hidden=true;
  if(reduced||!sheet.animate){
    sheet.hidden=true;view.presentShore(0);
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return;
  }
  // The first visible terrain, bird and river can be composited while the
  // engraved loading plate dissolves. The movement controller still rests.
  const fade=sheet.animate([{opacity:1},{opacity:0}],{duration:680,easing:'cubic-bezier(.37,0,.3,1)',fill:'forwards'});
  let frame,previous=performance.now();
  function reveal(stamp){
    view.presentShore(Math.min(.05,Math.max(0,(stamp-previous)/1000)));previous=stamp;
    frame=requestAnimationFrame(reveal);
  }
  frame=requestAnimationFrame(reveal);
  try{await fade.finished;}
  finally{cancelAnimationFrame(frame);sheet.hidden=true;fade.cancel();}
}
async function start(){
  if(starting)return;starting=true;audio.unlock();$('enter').disabled=true;$('boot-state').textContent='';
  arrivalStatus=null;
  $('embark').hidden=false;$('cover').inert=true;loadingStep('展开踏查手册',0);
  try{
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    await prepare();loadingStep('显影烁羽眼前的第一幅现场',3);
    await view.prime(record.completed.length);loadingStep('河岸已就绪',4);
    replay=false;updateMission();if(arrivalStatus)paintStatus(arrivalStatus);
    const line=record.completed.length?travelLines[view.target]:firstWords;
    message(record.ending?'九处遗存已经辨认。按 J 可重访现场、鉴定珍藏或更换羽装。':'烁羽　'+line,7700);
    $('overlay').inert=true;$('overlay').hidden=false;
    await revealRiver();record.started=true;persist();enterMode('travel');
    if(record.completed.length===9&&!record.ending)startFinale();
    else if(!record.ending)speak(line,'spirit');
  }catch(error){
    console.error(error);if($('folio').open)$('folio').close();enterMode('title');
    needsFreshPage=/dynamically imported|module script|loading chunk|preload css/i.test(error?.message||'');
    $('boot-state').textContent=needsFreshPage?'现场模块未能载入。刷新游戏以读取当前版本。':'三维资源未能就绪。请重试；若仍失败，请检查浏览器硬件加速。';
    if(needsFreshPage)$('enter').firstChild.textContent='刷新游戏 ';
  }
  finally{starting=false;arrivalStatus=null;$('embark').hidden=true;$('cover').inert=false;$('overlay').inert=false;$('enter').disabled=false;if(mode==='title')$('enter').focus();}
}
function expeditionBrief(){
  const leads=[...witnesses,{name:'西台烟火',plate:'/assets/v14/west-terrace-dawn.webp',where:'河岸居址 · 场景推想',detail:'到西台的小院，试着从灰坑土样里浮选一粒炭化稻。金沙黄忠小学地点的植物遗存，为理解古蜀人的食物提供了线索。'}];
  const figure=part('figure','','witness'),picture=part('img'),caption=part('figcaption'),nav=part('nav'),detail=part('p');
  nav.setAttribute('aria-label','选择勘探线索');detail.setAttribute('aria-live','polite');
  const show=i=>{
    const clue=leads[i];picture.src=clue.plate||(i===2?'/assets/v11/solstice.webp':'/assets/v10/'+clue.image+'.webp');picture.alt=clue.where;caption.textContent=clue.where;detail.textContent=clue.detail;
    [...nav.children].forEach((button,n)=>button.setAttribute('aria-pressed',String(n===i)));
  };
  leads.forEach((clue,i)=>{const b=part('button',clue.name);b.onclick=()=>{show(i);audio.cue('measure',.55);};nav.append(b);});
  figure.append(picture,caption,nav,detail);show(0);return figure;
}
$('enter').onclick=()=>{
  if(needsFreshPage){location.reload();return;}
  book.select(journeyId);
  audio.unlock();if(record.started){start();return;}
  enterMode('launching');speak(narratorIntro,'narrator');
  const buttons=[['落到探方边',()=>{$('folio').close();start();}]];
  const prior=journeyId==='first'?book.legacy():null;
  if(prior?.completed.length)buttons.push(['承接旧版 '+prior.completed.length+' 处记录',()=>{Object.assign(record,prior,{ending:false,inscription:''});collection.sync();$('folio').close();start();}]);
  folio('序章　／　成都 · 金沙','木柱消失之后',[narratorIntro,'沿水而行，你将取得九份现场证据。烁羽负责越河、上树与潜水，你负责判断每件遗存能够说明什么。选看一条线索，或直接飞往探方。'],buttons,expeditionBrief());
  $('folio').classList.add('prologue-open');
};
let refreshJourneys=null;
if(!guest){
  window.addEventListener('storage',event=>{
    if(event.key!==saveKey||!event.newValue||mode!=='title')return;
    const current=storage?.getItem(saveKey);if(!current)return;
    writer.acceptStored(restore(current));
    $('enter').firstChild.textContent=record.started?'继续探索 ':'开始探索 ';
    audio.setMuted(record.muted);syncMute();collection.sync();
  });
  refreshJourneys=bindJourneyMenu({id:journeyId,book,getCurrent:()=>record,enter:()=>$('enter').click(),finishSaves});
  if(embark){
    // Some browsers grant playback to the new document on its first gesture.
    window.addEventListener('pointerdown',()=>audio.unlock(),{once:true,capture:true});
    window.addEventListener('keydown',()=>audio.unlock(),{once:true,capture:true});
    queueMicrotask(()=>$('enter').click());
  }
}
function options(session,complete){
  return {
    signal:session.controller.signal,reduced,complete,variant:session.variant||0,
    photos:record.photos,fieldTriptych:record.fieldTriptych,
    growthLevel:skillLevel(record.completed.length),traits:collection.traits(),birdSpeech:audio.birdSpeech,
    stopSpeech:audio.stopSpeech,sound:(s,v)=>audio.cue(s,v),
    get volume(){return record.muted?0:1;},
    get audioContext(){return audio.context;},
    get audioDestination(){return audio.effectsDestination;}
  };
}
function closeStation(){if(!stationSession)return;const s=stationSession;stationSession=null;s.controller.abort();s.clean?.();$('station-body').replaceChildren();}
const leaveButton=$('leave'),leaveNote=part('small');
leaveNote.style.cssText='display:block;font-size:max(.83em,10px);line-height:1.15;letter-spacing:0';
leaveButton.append(leaveNote);
function showLeaveButton(finale=false){
  leaveButton.firstChild.textContent=guest?'返回当前探索 ':'回到河岸 ';
  leaveNote.textContent=guest?'退出本次回顾':finale?'可从头重看':'未归档将重做';
  leaveButton.title=guest?'结束本次回顾，返回'+guest.origin:finale?'回到河岸。终章可从手册里重新观看。':'回到河岸。下次进入时，本次未归档的操作需要重做。手册中的记录保留。';
  $('review-status').hidden=!guest;
  if(guest)$('review-status').textContent='正在回顾 · 返回后继续'+guest.origin;
  leaveButton.hidden=false;
}
function failStation(error){
  console.error(error);closeStation();
  if(guest){guest.fail();}
  else if(!view){toTitle();$('boot-state').textContent='现场未能展开，可重新进入。';}
  else{resumeTravel(false,true);message('本次观察未能展开，可在此处重新进入。');}
}
function interact(){
  if(mode!=='travel')return;
  if(view.interactSide?.())return;
  if(!near){if(offerPerch)view.perch();return;}
  if(record.completed.length===9&&!replay&&view.target===8){startFinale();return;}
  enterStation(view.target);
}
function enterStation(index){
  closeStation();
  current=chapters[index];
  let variant=0;
  if(replay)variant=(record.revisits[current.id]||0)%2+1;
  const session={controller:new AbortController(),variant};stationSession=session;
  $('sheet-label').textContent=phases[Math.floor(index/3)]+'　／　'+current.site;
  showLeaveButton();enterMode('activity');audio.cue('arrive');speak(current.prologue,'narrator');
  try{
    session.clean=stationType[Math.floor(index/3)](current.id,$('station-body'),options(session,result=>whenFieldResumes(()=>finishStage(index,session,result),session.controller.signal)));
    if(index===0)$('station-body').querySelector('.js-field-panel header')?.append(lensButton());
  }catch(e){failStation(e);}
}
async function finishStage(index,session,result){
  if(session!==stationSession||session.submitting||mode!=='activity')return;
  session.submitting=true;
  const item=chapters[index],added=secureRecord(record,item.id);
  session.advanced=added;
  if(added){
    leaveNote.textContent='本次调查已完成';
    leaveButton.title='回到河岸，追踪下一处现场。';
  }
  const photos=index===6?validFilm(result?.photos):[];
  const firstFilm=photos.length>0&&(added||!record.photos.length);
  if(firstFilm)record.photos=photos;
  const revisited=!added&&session.variant?item.id:null;
  if(revisited)record.revisits[revisited]=(record.revisits[revisited]||0)+1;
  const saved=added||firstFilm||revisited?await persist({photos:firstFilm,revisited}):true;
  whenFieldResumes(()=>renderReceipt(index,session,added,photos,firstFilm,saved),session.controller.signal);
}
function renderReceipt(index,session,added,photos,firstFilm,saved){
  if(session!==stationSession)return;
  const item=chapters[index];
  closeStation();enterMode('receipt');audio.cue(added?'record':'reveal');
  collection.sync();
  const next=Math.min(record.completed.length,8),last=record.completed.length===9;
  const lead=part('section','','field-handoff');
  lead.append(part('small',last?'最终目的地':'下一站　／　'+chapters[next].site),part('strong',last?'冬至 · 九柱候日':prompts[next][0]),part('p',last?'把测得的轴向带到黎明的地平线。':prompts[next][1]));
  const content=part('div'),loot=part('div');content.append(lead,loot);
  if([0,2,8].includes(index)){
    const lab=part('section','','flume-invitation');lab.append(part('strong','复勘 · 古河水槽'),part('p','把粗砂和细泥倒进同一股水流。改变闸高，试着在采样窗沉出指定的层序。'),flumeButton());content.append(lab);
  }
  if(photos.length&&!firstFilm){
    const film=part('div','','film-strip');
    photos.forEach((source,i)=>{const figure=part('figure'),image=part('img');image.src=source;image.alt=['重拍的叠压','重拍的断口','重拍的泥层'][i];figure.append(image);film.append(figure);});
    const replace=part('button','用本次三张底片更新图鉴','revisit');
    replace.onclick=async()=>{replace.disabled=true;record.photos=photos;const success=await persist({photos:true});replace.textContent=success?'本次底片已收入图鉴':'本次底片已在当前页面更新';};
    content.append(film,replace);
  }
  const note=part('details','','margin-notes');note.append(part('summary','现场图版与考古依据'),objectPlate(index),part('p',siteFacts[index]));content.append(note);
  const go=()=>{replay=false;if(last){startFinale();return;}resumeTravel(true);view.trackSide?.(null);view.guided();};
  const routes=guest?
    [['返回 · '+guest.origin,()=>guest.back()],['选择其他章节',openReplayLibrary]]:
    added?[[last?'进入冬至候日':'随烁羽前往'+chapters[next].site,go],['自行探索',()=>{replay=false;resumeTravel(true);}],['回顾章节',openReplayLibrary]]:
    [['回到主线',()=>{replay=false;resumeTravel(true);}],['回顾章节',openReplayLibrary]];
  routes.push(['再玩本关',()=>repeatStation(index)]);
  if(!added)lead.replaceChildren(part('small','本次复勘'),part('strong',item.site),part('p','本站已完成 '+(record.revisits[item.id]||0)+' 次复勘。原有主线与阅历已保留。'));
  folio(added?'发现已入档　／　'+record.completed.length+' · 9':'重访　／　调查完成',item.reward,[added?item.transition:siteFacts[index],saved?'':'本次记录只存于当前页面。'],routes,content);
  $('folio').classList.add('receipt-open');collection.mountReward(loot,item.id,added);
  if(guest){
    const [back,choose]=$('folio-body').querySelectorAll('.folio-buttons button');
    back.id='review-finish-return';choose.id='review-finish-library';
  }
  if(added&&index<8)requestAnimationFrame(()=>setTimeout(()=>view?.warmStation(index+1),0));
}
function startFinale(){
  if(!view||record.completed.length!==9)return;
  if($('folio').open)$('folio').close();closeStation();
  const s={controller:new AbortController()};stationSession=s;
  $('sheet-label').textContent='终章　／　古河岸 · 将明';showLeaveButton(true);enterMode('finale');speak(endingWords,'narrator');
  try{s.clean=finalMaker($('station-body'),options(s,async result=>{
    if(stationSession!==s||!result?.dawnAligned)return;
    s.advanced=true;leaveNote.textContent='终章已完成';
    record.ending=true;record.fieldTriptych=result.fieldTriptych;
    const saved=await persist({fieldTriptych:true});
    whenFieldResumes(()=>{
      if(stationSession!==s)return;closeStation();replay=false;enterMode('receipt');audio.cue('solstice');
      folio('终章　／　冬至候日','九柱之间，太阳升起',[endingWords,'木柱的上部是推想复原，洞心的位置仍可丈量。回到今天的展厅，入口处那张金色的脸，正等着你从背面再看一次。',saved?'九站记录、鉴定和羽装已留在本机。':'本次结局只存于当前页面。'],[['进入金面具特展',openGoldMask],['回顾章节',openReplayLibrary],['查看金沙珍藏',()=>openCollection()],['回到河岸',()=>resumeTravel(false)]],renderFieldTriptych(record.fieldTriptych,record.photos));
      $('folio').classList.add('closing-plate');
    },s.controller.signal);
  }));}catch(e){failStation(e);}
}
$('interact').onclick=interact;$('guide').onclick=()=>view?.guided();
$('perch').onclick=()=>view?.perch();
leaveButton.onclick=()=>{
  if(guest){guest.back();return;}
  const wasFinale=mode==='finale';
  const advanced=stationSession?.advanced;
  closeStation();
  if(advanced){
    replay=false;resumeTravel(!wasFinale);
    if(wasFinale)message('太阳已经升起。九处遗存可在手册里回顾。');
    return;
  }
  resumeTravel(false,true);
  message(wasFinale?'已回到河岸。打开手册，可从头重看终章。':'已回到河岸。再次进入时，将从头进行这项调查。');
};
let cameraOpening=false;
async function openRiverCamera(){
  if(!view||cameraOpening||document.querySelector('.field-photo[open]'))return;
  const originMode=mode;
  cameraOpening=true;
  try{
    const {openFieldPhoto}=await import('../v16/field-photo.js');
    if(mode!==originMode||desk?.active||!['travel','journal'].includes(mode))return;
    view.pauseForReview(true);
    try{openFieldPhoto(view,()=>view.pauseForReview(false));}
    catch(e){view.pauseForReview(false);throw e;}
  }finally{cameraOpening=false;}
}
window.addEventListener('keydown',e=>{
  if(document.querySelector('dialog.investigation-desk[open],dialog.field-photo[open]'))return;
  if($('listening-room').open)return;
  if($('strata-dialog')?.open||$('flume-room')?.open||$('flotation-room')?.open)return;
  if(e.repeat||e.isComposing||e.metaKey||e.altKey||e.ctrlKey)return;
  if(e.code==='KeyL'&&['travel','activity','finale','receipt','journal'].includes(mode)&&
    !e.target?.closest?.('input,select,textarea,[contenteditable="true"]')){
    e.preventDefault();
    if(desk?.selecting)desk.closeList();else if(!desk?.active)openReplayLibrary();
    return;
  }
  if(desk?.active)return;
  if(e.code==='KeyP'&&mode==='travel'&&!document.querySelector('dialog[open]')){e.preventDefault();openRiverCamera();return;}
  if(e.code==='Escape'&&$('transcript').open){e.preventDefault();$('transcript').open=false;$('transcript').querySelector('summary').focus();return;}
  if(mode==='travel'&&['KeyE','KeyJ','Escape','KeyG','KeyQ'].includes(e.code)){
    e.preventDefault();if(e.code==='KeyE')interact();else if(e.code==='KeyG')view.guided();else if(e.code==='KeyQ')trace();else journal();
  }else if((mode==='activity'||mode==='finale')&&e.code==='Escape'&&!e.defaultPrevented){e.preventDefault();$('leave').click();}
});
let disposed=false;
function disposeExpedition(){
  if(disposed)return;
  disposed=true;leaveExhibit();closeStation();collection.dispose();view?.dispose();audio.destroy();
}
window.addEventListener('pagehide',e=>{if(!e.persisted)disposeExpedition();});
if(guest){
  guest.disposeChild=disposeExpedition;guest.pauseChild=holdExpedition;
  $('sheet-label').textContent='正在打开调查记录';
  $('cover').hidden=true;
  (async()=>{
    try{
      const index=chapterIds.indexOf(guest.id);
      if(index<0||!record.completed.includes(guest.id))throw Error('尚未归档');
      void audio.unlock();
      window.addEventListener('pointerdown',()=>audio.unlock(),{once:true,capture:true});
      window.addEventListener('keydown',()=>audio.unlock(),{once:true,capture:true});
      await prepareChapters();
      if(disposed)return;
      replay=true;enterStation(index);
      if(stationSession){guest.ready();$('leave').focus({preventScroll:true});}
    }catch(e){if(!disposed)failStation(e);}
  })();
}
Object.defineProperty(window,'__JINSHA_SURVEY__',{value:{snapshot:()=>({mode,completed:[...record.completed],ending:record.ending,motion:view?.stats(),site:mode==='activity'?current?.id:chapterIds[view?.target??0],near,collection:collection.snapshot()})}});
