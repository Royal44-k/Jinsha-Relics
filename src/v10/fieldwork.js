import {fieldTime,reviewPaused} from '../v13/review-clock.js';
import './fieldwork.css';
import './fieldwork-specimens.css';
import { uncoverTrench } from './fieldwork-trench.js';
import { navigateRiver } from './fieldwork-river.js';
import { surveyRoots } from './fieldwork-roots.js';

export const fieldwork = [
  {
    id: 'river-trench', title: '砂层里的口沿', site: '滨河探方',
    prologue: '先看木桩下面。深色的泥里，露出一道浅浅的砂带。古河改过道，这就是它留下的一点痕迹。',
    objective: '刷开两个剖面窗口，用记录针定层位，再湿筛模拟土样，找出留有人工成形痕迹的残片。',
    reward: '陶片层位标本', transition: '口沿的弯度留下了器形，包裹它的砂层留下了河的去向。循着砂带向前到古河道渡口，观察流水怎样搬运东西。'
  },
  {
    id: 'paleochannel', title: '逆水借湾', site: '古河道渡口',
    prologue: '看那截漂木。到芦苇边，它慢了下来，又轻轻打了个转。把竹排划过去，试试那里的水往哪儿走。',
    objective: '操控竹排绕过浅滩，在两处水标靠泊，记录一段木头经过南岸测线的时刻。',
    reward: '古河岸线图', transition: '漂木可以从上游来到这里。在南岸，烁羽发现了一件更能说明原地环境的东西：扎在泥里的根。'
  },
  {
    id: 'root-survey', title: '一棵树的名字', site: '古木鉴定台',
    prologue: '漂木跟着水走，这副根盘却留在原地。顺着侧根看进去，木头的纹理里，还留着辨认树种的线索。',
    objective: '辨别原位树根与游离木段，取样后在并列显微镜中配准切片，揭开古林的面貌。',
    reward: '秋枫鉴定标本', transition: '秋枫曾在温暖湿润的成都平原撑起浓荫。沿南岸向东上坡，斜棚下的玉料留着一道锯缝。'
  }
];

const makers = { 'river-trench': uncoverTrench, paleochannel: navigateRiver, 'root-survey': surveyRoots };

export function mountFieldwork(id, host, { complete, signal, sound, growthLevel=0, traits, birdSpeech } = {}) {
  const make = makers[id];
  if (!make) throw new Error('Unknown field location: ' + id);
  if (signal?.aborted) return () => {};
  const sheet = fieldwork.find(entry => entry.id === id);
  const section = document.createElement('section');
  section.className = 'js-field js-field-' + id;
  section.dataset.site = id;
  section.setAttribute('aria-label', sheet.title);
  section.innerHTML = `<div class="js-field-stage"><div class="js-field-view"></div><div class="js-field-overlays"></div></div>
    <div class="js-field-panel"><header><small></small><h2></h2></header><div class="js-field-reading"></div>
    <p class="js-field-hint" role="status"></p><div class="js-field-tools"></div></div>`;
  section.querySelector('small').textContent = sheet.site;
  section.querySelector('h2').textContent = sheet.title;
  host.append(section);
  const life = new AbortController();
  const cleanups = [];
  let closed = false, finished = false;
  function cleanup() {
    if (closed) return;
    closed = true;
    life.abort();
    for (const clean of cleanups.reverse()) clean();
    signal?.removeEventListener('abort', cleanup);
    section.remove();
  }
  signal?.addEventListener('abort', cleanup, {once:true});
  const ctx = {
    section, growthLevel, traits, birdSpeech, view: section.querySelector('.js-field-view'), overlay: section.querySelector('.js-field-overlays'),
    tools: section.querySelector('.js-field-tools'), read: section.querySelector('.js-field-reading'),
    step(index,total,title){section.querySelector('header small').textContent=sheet.site+'　／　'+index+' · '+total;section.querySelector('header h2').textContent=title;},
    tip(value) { const hint=section.querySelector('.js-field-hint');if(hint.textContent!==value)hint.textContent=value; },
    on(element, type, listener, options = {}) { element.addEventListener(type, listener, {...options,signal:life.signal}); },
    onClose(fn) { cleanups.push(fn); },
    frame(fn) {
      let last = fieldTime(), raf;
      function draw(now) {
        if (closed) return;
        now=fieldTime(now);
        const dt = Math.max(0,Math.min(.10,(now-last)/1000));
        last = now;
        if (!document.hidden&&!reviewPaused()) fn(dt,now/1000);
        if (!closed) raf = requestAnimationFrame(draw);
      }
      raf = requestAnimationFrame(draw);
      cleanups.push(() => cancelAnimationFrame(raf));
    },
    button(label, run) {
      const button = document.createElement('button');
      button.type='button'; button.textContent=label; ctx.tools.append(button); ctx.on(button,'click',run); return button;
    },
    cue(kind) { if(typeof sound==='function') sound(kind); },
    finish() { if(closed || finished) return; finished=true; complete?.(); },
    get closed() { return closed; }
  };
  try { make(ctx); } catch (error) { cleanup(); throw error; }
  return cleanup;
}
