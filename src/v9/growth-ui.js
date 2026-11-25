import './growth-ui.css';

const levels = [
  {name:'初羽',threshold:0,kicker:'循光的起点',text:'还是那只会怕黑的小鸟。每一次靠近，都让羽翼记住新的力量。',air:'基础羽力',dash:'基础闪身',reach:'6.2 米鸣光'},
  {name:'青翎',threshold:4,kicker:'林河第一次回应',text:'青玉额纹浮现，内翼长出细金羽。带回的生息，开始成为身体的一部分。',air:'飞行耗力减少 10%',dash:'闪身冷却缩短 12%',reach:'7.2 米鸣光'},
  {name:'曜羽',threshold:10,kicker:'把光留给万物',text:'冠翎舒展，尾羽染上青金。外形与能力一同成长，仍保留最初的好奇。',air:'飞行耗力减少 20%',dash:'闪身冷却缩短 24%',reach:'8.4 米鸣光'},
];
const featherIcon = '<svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M7 30 27 8M11 25C7 14 16 5 30 4c2 13-4 24-16 23M14 22l9 0M18 17l8 0M22 12l7 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
const crest = (level) => `<svg class="v9-growth-crest" viewBox="0 0 180 220" fill="none" aria-hidden="true"><circle cx="90" cy="105" r="69" stroke="currentColor" stroke-width=".6" opacity=".22"/><circle cx="90" cy="105" r="77" stroke="currentColor" stroke-width=".7" opacity=".2" stroke-dasharray="1 8"/><path d="M89 187C68 155 57 126 70 83C80 55 98 32 112 18C115 52 111 75 105 96C99 122 94 146 89 187Z" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="1.1"/><path d="M85 196 110 28M89 165l-19-21M92 147l-24-23M96 128l-27-24M100 106 75 87M103 89 84 65M107 66 95 46M89 164l16-21M93 143l18-20M96 121l20-20M100 99l19-21M104 78l14-20" stroke="currentColor" stroke-width=".8" opacity=".8"/>${level>0?'<path d="M64 152C40 112 44 79 56 52C70 85 69 112 64 152Z" fill="#7baf92" fill-opacity=".15" stroke="#9cc6a0" stroke-width=".8"/><path d="m61 157-7-88" stroke="#abc79e" stroke-width=".7"/>':''}${level>1?'<path d="M115 164C115 114 133 79 151 61C153 100 142 135 115 164Z" fill="#c8b576" fill-opacity=".13" stroke="#d2bb81" stroke-width=".8"/><path d="m114 170 32-91" stroke="#d2bb81" stroke-width=".7"/>':''}<path d="m87 205 3-6 3 6-3 6-3-6Z" fill="currentColor"/></svg>`;

const portrait=level=>'<div class="v9-growth-portrait">'+crest(level)+'<img src="/assets/v9/growth-'+level+'.png" width="480" height="480" alt="烁羽'+levels[level].name+'形态，实际三维角色" loading="lazy"></div>';

export function growthMarkup(snapshot={}) {
  const g=snapshot.growth||{level:0,name:'初羽',essence:0,nextAt:4},level=Math.max(0,Math.min(2,g.level||0));
  const next=g.nextAt==null?'三阶羽灵已觉醒':`再收获 ${Math.max(0,g.nextAt-g.essence)} 点生息，成为${levels[level+1].name}`;
  return `<section class="v9-growth-page"><p class="eyebrow">SHUÒ YǓ · A LIFE IN THE MAKING</p><div class="v9-growth-heading"><div><h2 id="dialog-title">把旅途，长成羽翼。</h2><p>你唤醒林河，林河也在唤醒你。</p></div><span class="v9-essence-total"><strong>${g.essence}</strong><span>已收获生息</span></span></div><div class="v9-growth-progress"><span>此刻 · ${g.name}</span><span>${next}</span><i><b style="transform:scaleX(${Math.min(1,g.essence/10)})"></b></i></div><div class="v9-growth-cards">${levels.map((item,i)=>`<article class="v9-growth-card ${i===level?'is-current':''} ${i>level?'is-unreached':''}"><div class="v9-growth-card-head"><span>0${i+1}</span><em>${i===level?'当前形态':i<level?'已经走过':`${item.threshold} 点生息`}</em></div>${portrait(i)}<small>${item.kicker}</small><h3>${item.name}</h3><p>${item.text}</p><ul><li>${item.air}</li><li>${item.dash}</li><li>${item.reach}</li></ul></article>`).join('')}</div><div class="v9-growth-sources"><h3>生息，从行动而来。</h3><dl><div><dt>唤醒一境</dt><dd>+2 生息</dd></div><div><dt>每找回三片遗羽</dt><dd>+1 生息</dd></div><div><dt>净化一处蚀影</dt><dd>+2 生息</dd></div></dl><p>成长会自动发生，并随旅程保存。回看机关或重复挑战不会重复获得生息；原有旅程也会计入成长。</p></div><p class="v9-growth-fiction">羽灵、蚀影与进化属于原创幻想叙事。文物线索与考据保留在记忆手册中。</p></section>`;
}

/** View-only HUD. Main owns keyboard priority, modal focus, pause and saves. */
export function createGrowthUI({onOpen}={}) {
  const root=document.createElement('div');root.id='v9-growth-hud';root.hidden=true;
  root.innerHTML=`<button id="v9-growth-button" aria-haspopup="dialog" aria-label="羽灵成长，快捷键 N">${featherIcon}<span><small>羽灵成长</small><strong id="v9-growth-name">初羽</strong></span><span class="v9-growth-mini"><b id="v9-growth-amount">0 / 4</b><i><em id="v9-growth-fill"></em></i></span><kbd>N</kbd></button><section id="v9-encounter" hidden aria-label="蚀影净化挑战"><div class="v9-encounter-heading"><span id="v9-encounter-phase">观察环波</span><strong id="v9-encounter-title"></strong></div><div class="v9-encounter-gauges"><span>蚀影 <i id="v9-encounter-health"></i></span><span>护光 <i id="v9-encounter-ward"></i></span></div><p id="v9-encounter-hint"></p><div class="v9-encounter-clock" aria-hidden="true"><i id="v9-encounter-progress"></i></div></section><section id="v9-tree-caption" hidden aria-live="polite"><small>古根新生</small><p id="v9-tree-line"></p><span>移动或拖动镜头，自由走近观察</span><i><b id="v9-tree-progress"></b></i></section><div id="v9-growth-arrival" hidden role="status"><span class="v9-growth-arrival-mark">${featherIcon}</span><div><small>林河的回应，成为你的力量</small><strong id="v9-growth-arrival-title"></strong><p id="v9-growth-arrival-copy"></p></div></div>`;
  (document.getElementById('hud')||document.body).appendChild(root);
  const $=id=>root.querySelector('#'+id),button=$('v9-growth-button'),panel=$('v9-encounter');button.onclick=()=>onOpen?.();
  let latest={},lastLevel=null,lastSignature='',arrivalUntil=0,lastEncounter='',clearedUntil=0;
  const coarse=matchMedia('(pointer:coarse)');
  const phaseNames={idle:'发现蚀影',windup:'环波将至',wave:'越过环波',exposed:'青心显露',retry:'收翼，再试一次',cleared:'生息归来'};
  function update(snapshot={},options={}){
    latest=snapshot;const g=snapshot.growth||{level:0,name:'初羽',essence:0,nextAt:4},e=snapshot.encounter,playing=options.mode==='playing',touch=coarse.matches||innerWidth<=700;
    const encounterStamp=(e?.id||'')+':'+(e?.phase||'');if(encounterStamp!==lastEncounter){lastEncounter=encounterStamp;if(e?.phase==='cleared')clearedUntil=performance.now()+5000;}
    const tree=snapshot.rootLife,p=options.position,tp=tree?.position,nearTree=p&&tp?Math.hypot((p.x??p[0])-tp[0],(p.z??p[2])-tp[2])<24:false;
    $('v9-tree-caption').hidden=!(playing&&nearTree&&tree.progress>0&&tree.progress<1);
    if(!$('v9-tree-caption').hidden){const lines={awakening:'光进入根脉。第一道绿意，正在醒来。',rising:'细枝寻向天空。你带回的光，正在长成树荫。',unfurling:'新叶展开，把风与日光重新留在这里。',mature:'它记得，每一束归来的光。'};const line=lines[tree.phase]||'林河正在回应。';if($('v9-tree-line').textContent!==line)$('v9-tree-line').textContent=line;$('v9-tree-progress').style.transform='scaleX('+tree.progress+')';}
    root.hidden=!playing;root.classList.toggle('is-carrying',!!snapshot.inventory?.carried);
    if(lastLevel!==null&&g.level<lastLevel)arrivalUntil=0;
    if(lastLevel!==null&&g.level>lastLevel&&playing){arrivalUntil=performance.now()+6500;$('v9-growth-arrival-title').textContent=`${g.name} · 新羽初生`;$('v9-growth-arrival-copy').textContent=g.description||'羽翼已经记住这段旅程。按 N 查看新的能力。';}
    lastLevel=g.level;
    const sign=[g.level,g.essence,g.nextAt,e?.id,e?.phase,e?.health,e?.ward,e?.hint,touch].join('|');
    if(sign!==lastSignature){lastSignature=sign;$('v9-growth-name').textContent=g.name;$('v9-growth-amount').textContent=g.nextAt==null?`${g.essence} 生息`:`${g.essence} / ${g.nextAt}`;button.dataset.level=String(g.level);button.setAttribute('aria-label',`羽灵成长：${g.name}，${g.essence} 点生息。快捷键 N`);$('v9-growth-fill').style.transform=`scaleX(${g.nextAt?Math.min(1,g.essence/g.nextAt):1})`;if(e){panel.dataset.phase=e.phase;$('v9-encounter-title').textContent=e.title;$('v9-encounter-phase').textContent=phaseNames[e.phase]||'';$('v9-encounter-hint').textContent=e.hint;$('v9-encounter-health').innerHTML=Array.from({length:e.maxHealth||3},(_,i)=>`<b class="${i<e.health?'is-lit':''}"></b>`).join('');$('v9-encounter-ward').innerHTML=Array.from({length:3},(_,i)=>`<b class="${i<e.ward?'is-lit':''}"></b>`).join('');$('v9-encounter-ward').setAttribute('aria-label',`${e.ward} 层护光`);$('v9-encounter-health').setAttribute('aria-label',`${e.health} 层蚀影`);}}
    if(e&&touch)$('v9-encounter-hint').textContent=e.hint.replaceAll('空格跳起 / X 闪身 / 展翼','点 ↑ 跳起 / 点「闪」避波 / 长按 ↑ 展翼').replaceAll('E / B 鸣光','点「鸣光净化」').replaceAll('E 重试','点下方重试');
    panel.hidden=!e||!e.active&&(e.phase!=='cleared'||performance.now()>clearedUntil);
    root.classList.toggle('in-encounter',!panel.hidden);
    if(e&&!panel.hidden){$('v9-encounter-progress').style.transform=`scaleX(${Math.max(0,Math.min(1,e.progress||0))})`;panel.classList.toggle('is-hit',(e.hitFlash||0)>.1);}
    $('v9-growth-arrival').hidden=!playing||performance.now()>arrivalUntil;
  }
  return {update,markup:()=>growthMarkup(latest),reset(){latest={};lastLevel=null;lastSignature='';lastEncounter='';arrivalUntil=clearedUntil=0;root.hidden=true;$('v9-growth-arrival').hidden=true;$('v9-tree-caption').hidden=true;},dispose(){root.remove();}};
}
