import {fieldFinds, forms, relics} from './collection-data.js';
import {collectionKey, createCollectionStore, discoveryXP, fieldXP, quizXP, upgradeCost} from './collection-state.js';
import formPreviews from './collection-form-previews.json';
import './collection.css';

const imageDir = '/assets/v11/collections/';
const focalPoints = {
  'carbon-rice':['稻粒纵纹',52,52],
  layer: ['层界',48,47], channel:['内弯砾滩',56,61], root:['根颈',51,49],
  jade:['通孔',54,15], pottery:['口沿',50,18], bronze:['鸟喙',78,31],
  ivory:['埋藏边界',49,53], sun:['内外圈',49,47], posts:['柱洞口',60,41],
  spindle:['穿孔',51,36],stoneblank:['磨制面',55,45],netsinker:['系绳槽',55,48]
};

function el(tag, cls, text) {
  const element = document.createElement(tag);
  if (cls) element.className = cls;
  if (text !== undefined) element.textContent = text;
  return element;
}
function button(label, cls, click, key) {
  const control = el('button', cls, label);
  control.type='button';
  control.addEventListener('click',click);
  if (key) control.dataset.collectionControl = key;
  return control;
}
function photo(filename, alt) {
  const image = el('img','');
  image.src = imageDir + filename + '.webp';
  image.alt=alt;
  image.loading='lazy';
  image.decoding='async';
  return image;
}
function sourceLink(url, label) {
  const link = el('a','jc-source',label + ' ↗');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}
function detailLine(heading, text) {
  const section = el('div','jc-line');
  section.append(el('h5','',heading),el('p','',text));
  return section;
}

function zoomPlate(relic) {
  const name = focalPoints[relic.image]??['标本中央',50,50];
  const image = photo(relic.image,relic.title+'的游戏图鉴插画');
  const figure = el('figure','jc-plate');
  const viewport = el('div','jc-plate-crop');
  image.style.transformOrigin = name[1]+'% '+name[2]+'%';
  viewport.append(image);
  let zoom = false;
  const lens = button('放大 · '+name[0],'jc-lens',()=>{
    zoom=!zoom;
    viewport.classList.toggle('jc-magnified',zoom);
    lens.setAttribute('aria-pressed',String(zoom));
    lens.textContent = zoom ? '还原全貌' : '放大 · '+name[0];
  });
  lens.setAttribute('aria-pressed','false');
  viewport.append(lens);
  figure.append(viewport,el('figcaption','','探险图鉴 · 创作示意'));
  const modelId={'jade-cut':'jade','bronze-shadow':'bird',sunfoil:'sun'}[relic.id];
  if (modelId) {
    const turntable=button('旋看三维器物','jc-turntable',async()=>{
      turntable.disabled=true;
      const frame=el('div','jc-model');
      const close=()=>{
        dispose?.();
        frame.remove();viewport.hidden=false;lens.hidden=false;turntable.hidden=false;turntable.disabled=false;
        turntable.focus({preventScroll:true});
      };
      let dispose=null;
      try {
        const {mountArtifactViewer}=await import('./collection-inspection.js');
        if (!figure.isConnected) return;
        figure.prepend(frame);viewport.hidden=true;lens.hidden=true;turntable.hidden=true;
        dispose=mountArtifactViewer(frame,modelId,relic.title,close);
      } catch { close(); }
    },'model-'+relic.id);
    figure.append(turntable);
  }
  return figure;
}

function quiz(relic,state,store,changed,context) {
  const details = el('details','jc-quiz');
  details.open = context.openQuiz === relic.id;
  details.addEventListener('toggle',()=>{
    if (details.open) context.openQuiz = relic.id;
    else if (context.openQuiz === relic.id) context.openQuiz = null;
  });
  const solved = state.quizzes.includes(relic.id);
  const summary=el('summary','',solved?'鉴定完成 · '+quizXP+' 阅历已入账':'现场鉴定 · 首次答对 +'+quizXP+' 阅历');
  summary.dataset.collectionControl='quiz-'+relic.id;
  details.append(summary,el('h5','',relic.question));
  if (solved) {
    details.append(el('p','jc-yes','结论　'+relic.choices[relic.answer]),el('p','',relic.why));
    return details;
  }
  const choices=el('div','jc-options');
  const feedback=el('p','jc-feedback','');
  feedback.setAttribute('role','status');
  relic.choices.forEach((option,index)=>{
    const choice=button(option,'jc-option',()=>{
      const result = store.answer(relic.id,index);
      if (result === 'wrong') {
        feedback.textContent='再看一次现场。'+relic.observation;
        choice.disabled=true;
        choice.setAttribute('aria-label',option+'，与证据不符');
        return;
      }
      if (result==='correct' || result==='already') {
        context.openQuiz=relic.id;
        changed();
      }
    },'option-'+index);
    choices.append(choice);
  });
  details.append(choices,feedback);
  return details;
}

function relicDetail(relic,state,store,changed,context) {
  const article=el('article','jc-detail');
  const info=el('div','jc-detail-copy');
  info.append(el('small','jc-kicker',relic.kind+'　／　'+relic.place),el('h4','',relic.title),
    el('p','jc-observe',relic.observation),detailLine('考古依据',relic.fact),detailLine('游戏演绎',relic.fiction),
    sourceLink(relic.source,relic.sourceTitle));
  if (relic.secondSource) info.append(sourceLink(relic.secondSource,relic.secondTitle));
  info.append(quiz(relic,state,store,changed,context));
  article.append(zoomPlate(relic),info);
  return article;
}
function fieldDetail(find) {
  const panel=el('article','jc-detail');
  const info=el('div','jc-detail-copy');
  info.append(el('small','jc-kicker',find.type+'　／　'+find.place),el('h4','',find.title),
    detailLine('考古依据',find.fact),detailLine('游戏演绎',find.fiction),sourceLink(find.source,find.sourceTitle));
  panel.append(zoomPlate({...find,image:find.id}),info);
  return panel;
}

function gallery(container,state,store,changed,context) {
  const stats=el('div','jc-counts');
  stats.append(el('span','','主线珍藏　'+state.chapters.length+' / '+relics.length),
    el('span','','野外拾遗　'+state.fieldFinds.length+' / '+fieldFinds.length),
    el('span','','鉴定　'+state.quizzes.length+' / '+relics.length));
  const navigation=el('div','jc-shelf');
  navigation.setAttribute('role','group');
  navigation.setAttribute('aria-label','主线珍藏');
  const owned=new Set(state.chapters);
  if (!context.selected) context.selected=state.chapters.at(-1)||state.fieldFinds.at(-1);
  relics.forEach((r,i)=>{
    const unlocked=owned.has(r.id);
    const control=button('','jc-catalogue-item',()=>{
      context.selected=r.id;
      context.openQuiz=null;
      changed();
    },'relic-'+r.id);
    control.disabled=!unlocked;
    control.setAttribute('aria-pressed',String(context.selected===r.id));
    const upcoming=i===state.chapters.length;
    const hiddenTitle=upcoming?'下一处遗存':'尚未发现';
    control.setAttribute('aria-label',unlocked?r.title:hiddenTitle+'，第 '+(i+1)+' 处');
    if (unlocked) control.append(photo(r.image,''));
    else control.append(el('span','jc-unopened',String(i+1).padStart(2,'0')));
    control.append(el('span','jc-item-text',unlocked?r.title:hiddenTitle));
    navigation.append(control);
  });
  container.append(stats,navigation);
  const fieldGrid=el('div','jc-field-list');
  for (const find of fieldFinds) {
    const unlocked=state.fieldFinds.includes(find.id);
    const choice=button(unlocked?find.title:'待访 · '+find.place,'jc-field-item',()=>{
      context.selected=find.id;
      changed();
    },'field-'+find.id);
    choice.disabled=!unlocked;
    choice.setAttribute('aria-pressed',String(context.selected===find.id));
    if (unlocked) choice.prepend(photo(find.id,''));
    fieldGrid.append(choice);
  }
  container.append(fieldGrid);
  const relic=relics.find(r=>r.id===context.selected && owned.has(r.id));
  const found=fieldFinds.find(f=>f.id===context.selected && state.fieldFinds.includes(f.id));
  if (relic) container.append(relicDetail(relic,state,store,changed,context));
  else if (found) container.append(fieldDetail(found));
  else container.append(el('p','jc-empty','前往河岸探方完成第一处调查，或沿地图支线寻找作坊遗物，即可在这里拿近观察。'));
}

function reward(container,state,store,changed,context) {
  const relic=relics.find(r=>r.id===context.id);
  if (!relic || !state.chapters.includes(relic.id)) return;
  const header=el('div','jc-reward-head');
  const title=el('div','');
  title.append(el('small','jc-kicker','已入珍藏　／　'+relic.kind),el('h4','',relic.title),
    el('span','jc-reward-xp',(context.firstDiscovery?'首获 +'+discoveryXP+' 阅历':'重访 · 已入藏')+'　／　累计 '+state.totalXP));
  header.append(photo(relic.image,''),title);
  container.append(header,quiz(relic,state,store,changed,context));
}

function express(form,level) {
  const percentage=Math.round((form.values[level-1]-1)*100);
  return form.unit+' '+(percentage>0?'+':'−')+Math.abs(percentage)+'%';
}
function formPortrait(filename,alt) {
  const image=el('img','');
  image.width=560;image.height=560;image.alt=alt;image.decoding='sync';
  image.src=formPreviews[filename];
  const full=new Image();
  full.src=imageDir+filename+'.webp';
  full.decode().then(()=>{image.src=full.src;},()=>{});
  return image;
}
function wardrobe(container,state,store,changed) {
  const total=el('div','jc-wardrobe-title');
  total.append(el('span','','累计阅历　'+state.totalXP),
    el('strong','','可用阅历　'+state.availableXP));
  container.append(total);
  const grid=el('div','jc-forms');
  for (const form of forms) {
    const level=state.levels[form.id];
    const active=state.equipped===form.id;
    const locked=state.totalXP<form.threshold;
    const card=el('article','jc-form'+(active?' jc-equipped':'')+(locked?' jc-locked':''));
    card.style.setProperty('--feather',form.color);
    const thumb=el('div','jc-form-image');
    const preview=level===3?'form-'+form.id:'form-'+form.id+'-'+level;
    thumb.append(formPortrait(preview,form.title+'羽装第 '+level+' 阶实机模型'));
    const badge=el('span','jc-form-status',locked?'待觉醒':active?'穿戴中':'已觉醒');
    thumb.append(badge);
    const body=el('div','jc-form-body');
    body.append(el('small','jc-kicker',form.habitat),
      el('h4','',form.title),el('p','',form.note));
    const effect=el('strong','jc-effect',express(form,level));
    body.append(effect,el('small','jc-tiers',(locked?'初阶属性':'羽阶 '+level+' / 3')+(level<3?'　→　'+express(form,level+1):'　已臻满阶')));
    if (locked) {
      const progress=el('progress','');
      progress.max=form.threshold;progress.value=state.totalXP;
      progress.setAttribute('aria-label',form.title+'觉醒阅历');
      body.append(progress,el('small','jc-lock-hint','再获 '+(form.threshold-state.totalXP)+' 阅历可觉醒'));
    } else {
      const actions=el('div','jc-form-actions');
      const wear=button(active?'已穿戴':'换上'+form.title,'',()=>{
        if (store.equip(form.id)) changed();
      },'equip-'+form.id);
      wear.disabled=active;
      actions.append(wear);
      if (level<3) {
        const cost=upgradeCost[level];
        const buy=button('研习 · '+cost+' 阅历','',async()=>{
          buy.disabled=true;
          await store.upgrade(form.id,level);
          changed();
        },'buy-'+form.id);
        buy.disabled=state.availableXP<cost;
        if (buy.disabled) buy.title='还需 '+(cost-state.availableXP)+' 可用阅历';
        actions.append(buy);
      }
      body.append(actions);
    }
    card.append(thumb,body);
    grid.append(card);
  }
  container.append(grid);
}

export function createCollection({getCompleted,onEquip=()=>{},onNotice=()=>{},storage,key=collectionKey}={}) {
  const store=createCollectionStore({getCompleted,storage,key,onStorageFailure:()=>onNotice('本次珍藏会保留在当前页面，浏览器未能写入存档。')});
  store.sync();
  let previous=store.snapshot().traits;
  const mounts=new Map();
  function render(view,state) {
    const current=view.host.ownerDocument.activeElement;
    const key=view.frame.contains(current) && current.dataset.collectionControl;
    view.frame.replaceChildren();
    view.paint(view.frame,state,store,refresh,view.context);
    if (key) {
      const match=[...view.frame.querySelectorAll('[data-collection-control]')].find(e=>e.dataset.collectionControl===key && !e.disabled);
      (match||view.frame.querySelector('details[open] > summary'))?.focus({preventScroll:true});
    }
  }
  function refresh() {
    const state=store.sync();
    if (previous.id!==state.traits.id || previous.level!==state.traits.level) {
      previous=state.traits;
      onEquip({...previous});
    }
    for (const [host,view] of mounts) {
      if (!view.frame.isConnected) { mounts.delete(host); continue; }
      render(view,state);
    }
    return state;
  }
  function mount(host,kind,paint,context={}) {
    if (!host?.append) return;
    for (const [old,view] of mounts) if (!view.frame.isConnected) mounts.delete(old);
    mounts.get(host)?.frame.remove();
    const frame=el('section','jc jc-'+kind);
    const view={host,frame,paint,context};
    host.append(frame);
    mounts.set(host,view);
    render(view,store.sync());
    return frame;
  }
  const onStorage=event=>{
    if (event.key===null||event.key===key||event.key?.startsWith(key+'.')) refresh();
  };
  globalThis.addEventListener?.('storage',onStorage);
  return {
    traits:()=>({...store.snapshot().traits}), snapshot:store.snapshot, sync:refresh,finishPurchases:store.finishPurchases,
    discover:id=>{
      const added=store.discover(id);
      if (added) {
        const item=fieldFinds.find(f=>f.id===id);
        refresh();onNotice(item.title+' 已入珍藏　+'+fieldXP+' 阅历');
      }
      return added;
    },
    mountReward:(host,id,firstDiscovery=true)=>mount(host,'reward',reward,{id,firstDiscovery}), mountGallery:host=>mount(host,'gallery',gallery),
    mountWardrobe:host=>mount(host,'wardrobe',wardrobe),
    reset:()=>{store.reset();return refresh();},
    dispose:()=>{globalThis.removeEventListener?.('storage',onStorage);mounts.clear();}
  };
}

