import './field-notes.css';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const coarsePointer=globalThis.matchMedia?.('(pointer: coarse)');
export function formatLivingHint(text){
 const value=String(text??'');
 if(!coarsePointer?.matches&&!(globalThis.innerWidth<=700))return value;
 return value.replace(/按\s*C\s*或\s*Ctrl/g,'按住「↓」').replace(/按\s*Q\b/g,'点「听」').replace(/\bQ\b/g,'「听」')
  .replace(/按\s*(?:Ctrl\s*\/\s*)?C\b/g,'按住「↓」').replace(/(?:Ctrl\s*\/\s*)?\bC\b/g,'「↓」')
  .replace(/(?:长按|按住)空格/g,'按住「↑」').replace(/轻按空格/g,'轻点「↑」').replace(/空格/g,'「↑」');
}
export function livingJournalMarkup(snapshot){
 const moments=snapshot?.moments||[];
 return `<section class="v6-notebook"><div class="v6-notebook-heading"><div><span class="eyebrow">万物回声</span><h3>山林写给你的回信</h3></div><span>${snapshot?.completed?.length??snapshot?.completed??0} / 3</span></div><p>这些相遇不需要交出什么。放慢一点，山林就会把另一面留给你。</p><div class="v6-notes-grid">${moments.map((m,i)=>`<article class="v6-note ${m.done?'is-complete':''}"><span class="v6-note-glyph" aria-hidden="true">${m.discovered?['栖','潜','翔'][i]:'·'}</span><div><h4>${escape(m.discovered?m.title:'尚未相遇')}</h4><p>${escape(m.done?m.story:m.discovered?m.short:'旅途中，有些回应只留给愿意停一停的你。')}</p><small>${m.done?'已珍藏这次相遇':m.discovered?'顺着声音，试着靠近':'未知留白'}</small></div></article>`).join('')}</div><p class="v6-notes-caption">生物、行为与诗性叙事为原创艺术演绎，不是金沙古生态的考古复原。</p></section>`;
}
export function createFieldNotesUI(){
 const root=document.createElement('aside');root.id='v6-living-clue';root.hidden=true;root.setAttribute('aria-label','山林里的可选相遇');
 root.innerHTML='<span class="v6-clue-sign" aria-hidden="true">◌</span><div><small>山林回信 · 可选相遇</small><strong></strong><p></p><div class="v6-clue-track"><i></i></div></div>';
 document.getElementById('hud').append(root);
 const title=root.querySelector('strong'),hint=root.querySelector('p'),fill=root.querySelector('i'),track=root.querySelector('.v6-clue-track');
 const shot=document.createElement('div');shot.id='v6-moment-caption';shot.hidden=true;shot.innerHTML='<span></span><small>移动或拖动，继续前行</small>';document.body.append(shot);
 let signature='';
 return {
  update(snapshot,{playing=false,interaction=false,trial=false,cinematic=null}={}){
   const near=snapshot?.nearest,visible=playing&&!cinematic&&!trial&&!interaction&&near&&!near.done&&near.distance<15;
   root.hidden=!visible;document.body.classList.toggle('living-clue-active',!!visible);
   if(visible){const text=formatLivingHint(near.hint),next=near.id+text;if(next!==signature){title.textContent=near.title;hint.textContent=text;signature=next;}const amount=Math.max(0,Math.min(1,near.progress||0));fill.style.transform=`scaleX(${amount})`;track.hidden=amount<=0;root.classList.toggle('is-listening',amount>0);}
   shot.hidden=!playing||!cinematic;document.body.classList.toggle('moment-camera',playing&&!!cinematic);
   if(cinematic){shot.querySelector('span').textContent=cinematic.title||'风，正在回应';shot.style.opacity=String(cinematic.weight);}
  },
  reset(){root.hidden=true;shot.hidden=true;signature='';document.body.classList.remove('moment-camera','living-clue-active');},
  dispose(){root.remove();shot.remove();}
 };
}
