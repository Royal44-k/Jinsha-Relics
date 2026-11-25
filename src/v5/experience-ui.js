import './experience-ui.css';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const formatTime = value => { const seconds = Math.max(0, finite(value)); return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}.${Math.floor(seconds * 10) % 10}`; };
const chapterNames = ['根林初醒', '方圆风径', '稻火聚落', '长夜试翼', '日轮归湾'];
const stageHints = [
  {verb:'把光芽送回根巢', detail:'靠近发光的光芽，拾起后送到空着的根巢。', hint:'按 Q 倾听，寻找林间的微光。'},
  {verb:'转动玉环，接通光路', detail:'绕到每一节玉环旁，转动它，让光穿过方与圆。', hint:'留意光束的方向。转动后，看看哪一段亮了。'},
  {verb:'让水重新流入稻田', detail:'靠近断开的水渠，转动渠段，把来水引向干涸的田地。', hint:'从有水的一头开始，一段一段接起来。'},
  {verb:'借风穿过空中的光环', detail:'从试翼台起飞，按次序穿过亮起的光环。', hint:'不必追求速度。错过光环，可以回身再试。'},
  {verb:'让目光与日轮相遇', detail:'站上观日台，面向远方的太阳，按住 F 送出光。', hint:'先唤醒沿途四道回响，再将光留给日轮。'},
];
const feather = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 20 17 5M8 16c-2-7 2-12 12-13 1 8-2 15-10 14M10 13l6 .5M13 9l5 .5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const mapIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2V5Zm6-2v15m6-12v15" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
const sun = '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="10"/><circle cx="24" cy="24" r="20" stroke-dasharray="1 5"/><path d="m24 7 2 9 7-5-4 9 10 1-9 5 5 8-9-4-2 10-3-10-8 5 4-9-10-2 10-3-5-8 9 4Z"/></svg>';

/** View-only layer. World state, saving, pausing, keyboard priority and rewards stay in main. */
export function createExperienceUI({onMap, onCloseMap, onInteract, onRetry, onAssist, onFocusHeld} = {}) {
  const controller = new AbortController();
  const {signal} = controller;
  const coarsePointer = matchMedia('(pointer:coarse)');
  let latest = {}, selectedStage = null, lastMapSignature = '', mapOpen = false;
  let held = false, discoveryTimer = 0, previousFocus = null, furthest = 0, disposed = false;
  let trialResultStamp = null, trialResultUntil = 0;
  const existingHUD = document.getElementById('hud');
  const root = document.createElement('div');
  root.id = 'v5-experience'; root.hidden = true;
  root.innerHTML = `
    <section class="v5-objective" aria-label="当前旅程">
      <div class="v5-objective-top"><span class="v5-region-mark" aria-hidden="true">${sun}</span><span id="v5-region"></span><span class="v5-chapter-no" id="v5-chapter-no"></span></div>
      <h2 id="v5-objective-title"></h2>
      <p class="v5-objective-hint" id="v5-objective-hint"></p>
      <div class="v5-stage-progress" id="v5-stage-progress" aria-label="当前机关进度"><div id="v5-stage-ticks"></div><span id="v5-stage-count"></span></div>
    </section>
    <button class="v5-pocket" id="v5-pocket" aria-label="打开行旅图，查看收集与旅程"><span class="v5-pocket-feather">${feather}<strong id="v5-feathers">0</strong><span>/ 12</span></span><span class="v5-pocket-divider"></span><span id="v5-echo-count">0 / 5 回响</span></button>
    <div class="v5-carried" id="v5-carried" hidden><span aria-hidden="true"></span>携着一束微光<small>送往空着的根座</small></div>
    <section class="v5-trial" id="v5-trial" hidden aria-label="试翼挑战">
      <div class="v5-trial-heading"><span id="v5-trial-title">试翼 · 随风而行</span><span id="v5-trial-assisted" hidden>轻松飞行</span></div>
      <div class="v5-trial-body"><strong id="v5-trial-rings"></strong><span id="v5-trial-time"></span></div>
      <div class="v5-trial-track"><i id="v5-trial-fill"></i></div>
      <p id="v5-trial-hint" aria-live="polite">长按空格振翼，松开滑翔 · 下一个光环正在发亮</p>
      <div class="v5-trial-actions"><button id="v5-trial-retry">回到起点重试</button><button id="v5-trial-assist" aria-pressed="false">轻松飞行</button></div>
    </section>
    <button class="v5-action" id="v5-action" hidden><span class="v5-action-key" id="v5-action-key"></span><span class="v5-action-copy"><strong id="v5-action-label"></strong><small id="v5-action-detail"></small></span><span class="v5-action-arrow" aria-hidden="true">↗</span><i id="v5-action-fill"></i></button>
    <div class="v5-first-steps" id="v5-first-steps"><span class="v5-first-line" aria-hidden="true"></span><span><kbd>W A S D</kbd> 走向林中的光 <b>·</b> <kbd>Q</kbd> 倾听方向</span></div>
    <div class="v5-discovery" id="v5-discovery" hidden role="status"><span class="v5-discovery-mark">${sun}</span><div><small>行旅图 · 新的回响</small><strong id="v5-discovery-title"></strong><p id="v5-discovery-text"></p></div></div>`;
  (existingHUD || document.body).appendChild(root);
  const mapButton = document.createElement('button');
  mapButton.id = 'v5-map-btn'; mapButton.innerHTML = `${mapIcon}<span>行旅图</span><small>M</small>`;
  mapButton.setAttribute('aria-label', '打开林河行旅图，快捷键 M');
  mapButton.setAttribute('aria-haspopup', 'dialog');
  (document.querySelector('.game-actions') || root).prepend(mapButton);

  const map = document.createElement('dialog');
  map.id = 'v5-travel-map';
  map.setAttribute('aria-labelledby', 'v5-map-title');
  map.innerHTML = `
    <div class="v5-map-shell">
      <header class="v5-map-heading"><div><p>烁羽的行旅手记</p><h2 id="v5-map-title">林河，渐次显影。</h2></div><button id="v5-map-close" aria-label="合上行旅图，返回探索">×</button></header>
      <div class="v5-map-layout">
        <section class="v5-chart-panel" aria-label="已探索的林河路线">
          <div class="v5-chart-heading"><span>所行之处，才会留下笔迹。</span><span id="v5-map-distance"></span></div>
          <div class="v5-map-scroll" id="v5-map-scroll" tabindex="0" aria-label="行旅图，窄屏可横向滑动"><div class="v5-map-canvas" id="v5-map-canvas"><svg id="v5-map-drawing" viewBox="0 0 1000 540" aria-hidden="true"></svg><div id="v5-map-pins"></div><div id="v5-map-player" class="v5-map-player" aria-label="烁羽在这里"><i></i><span>你在这里</span></div></div></div>
          <div class="v5-map-legend"><span><i class="v5-legend-route"></i>走过的路</span><span><i class="v5-legend-open"></i>未解的回响</span><span><i class="v5-legend-done"></i>已唤醒</span><span><i class="v9-legend-seed"></i>种火</span></div>
          <p class="v5-map-fiction">记忆中的林河 · 原创探索地景，非遗址测绘图</p>
        </section>
        <aside class="v5-map-notebook">
          <div class="v5-map-stats"><div>${sun}<strong id="v5-map-echoes"></strong><span>林河回响</span></div><div>${feather}<strong id="v5-map-feathers"></strong><span>拾得光羽 · 可选</span></div></div>
          <div class="v5-notebook-current"><p class="v5-note-eyebrow" id="v5-note-status">此刻的旅程</p><h3 id="v5-note-title"></h3><p id="v5-note-description"></p><div id="v5-note-progress"></div><p class="v5-note-hint" id="v5-note-hint"></p></div>
          <nav class="v5-map-index" aria-label="已发现的回响" id="v5-map-index"></nav>
          <p class="v5-unknown-note" id="v5-unknown-note">纸页的空白里，仍有未知在等你。</p>
          <section id="v9-map-encounters" class="v9-map-encounters" hidden><h4>沿途的种火</h4><div id="v9-map-encounter-list"></div></section>
          <details class="v5-feather-notes" id="v5-feather-notes" hidden><summary>拾得的光羽 <span id="v5-found-count"></span></summary><ol id="v5-found-feathers"></ol></details>
          <div class="v5-map-flight" id="v5-map-flight" hidden><div><span>试翼最佳</span><strong id="v5-map-best"></strong></div><label><input type="checkbox" id="v5-map-assist"><span>轻松飞行<small>放宽挑战，按自己的节奏探索</small></span></label><button id="v5-map-retry">回到试翼起点</button></div>
        </aside>
      </div>
      <footer class="v5-map-footer"><span>${feather}树梢、支路与水下，也有值得靠近的光。</span><button id="v5-map-return">合上手记，继续探索 <kbd>Esc</kbd></button></footer>
    </div>`;
  document.body.appendChild(map);
  const el = id => document.getElementById(id);
  const setText = (id, value) => { const node = el(id), text = String(value ?? ''); if (node.textContent !== text) node.textContent = text; };
  const listen = (node, event, fn, options = {}) => node.addEventListener(event, fn, {...options, signal});
  const requestMap = () => { if (onMap) onMap(); else openMap(latest); };
  const requestClose = () => { if (onCloseMap) onCloseMap(); else closeMap(); };
  listen(mapButton, 'click', requestMap); listen(el('v5-pocket'), 'click', requestMap);
  listen(el('v5-map-close'), 'click', requestClose); listen(el('v5-map-return'), 'click', requestClose);
  listen(map, 'cancel', event => { event.preventDefault(); requestClose(); });
  listen(map, 'click', event => { if (event.target === map) { const r = map.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) requestClose(); } });
  const retry = () => { onRetry?.(); };
  listen(el('v5-trial-retry'), 'click', retry); listen(el('v5-map-retry'), 'click', retry);
  listen(el('v5-trial-assist'), 'click', () => onAssist?.(!isAssisted(latest)));
  listen(el('v5-map-assist'), 'change', event => onAssist?.(event.target.checked));
  function releaseFocus() { if (!held) return; held = false; el('v5-action').classList.remove('is-held'); onFocusHeld?.(false); }
  listen(el('v5-action'), 'pointerdown', event => {
    if (latest.interaction?.key !== 'F' || !onFocusHeld) return;
    event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId);
    held = true; event.currentTarget.classList.add('is-held'); onFocusHeld(true);
  });
  listen(el('v5-action'), 'click', event => { if (latest.interaction?.key !== 'F') onInteract?.(event); else if (!onFocusHeld) onInteract?.(event); else event.preventDefault(); });
  listen(el('v5-action'), 'keydown', event => { if (latest.interaction?.key === 'F' && ['Space','Enter'].includes(event.code) && onFocusHeld) { event.preventDefault(); event.stopPropagation(); if (!held) { held = true; onFocusHeld(true); } } });
  listen(el('v5-action'), 'keyup', event => { if (latest.interaction?.key === 'F' && ['Space','Enter'].includes(event.code)) { event.stopPropagation(); releaseFocus(); } });
  listen(el('v5-action'), 'blur', releaseFocus);
  listen(window, 'pointerup', releaseFocus); listen(window, 'pointercancel', releaseFocus); listen(window, 'blur', releaseFocus);
  listen(document, 'visibilitychange', () => { if (document.hidden) releaseFocus(); });
  listen(el('v9-map-encounter-list'), 'click', selectFromEvent); listen(el('v5-map-index'), 'click', selectFromEvent); listen(el('v5-map-pins'), 'click', selectFromEvent);
  function selectFromEvent(event) { const button = event.target.closest('[data-stage]'); if (!button) return; const owner = button.parentElement.id; selectedStage = button.dataset.stage; renderMap(latest, true); [...el(owner).querySelectorAll('[data-stage]')].find(node => node.dataset.stage === selectedStage)?.focus({preventScroll:true}); }

  function getStages(snapshot) { return Array.isArray(snapshot.stages) ? snapshot.stages : []; }
  function getActive(snapshot) {
    const stages = getStages(snapshot), chapter = snapshot.chapter;
    const localId = snapshot.challenge?.active ? 'flight' : String(snapshot.interaction?.id || '').split('-')[0];
    const local = stages.find(stage => stage.id === localId);
    if (local) return local;
    if (chapter && typeof chapter === 'object') {
      const id = chapter.id ?? chapter.stageId;
      const found = stages.find(stage => stage.id === id);
      if (found) return found;
    }
    if (typeof chapter === 'string') { const found = stages.find(stage => stage.id === chapter); if (found) return found; }
    if (Number.isInteger(chapter) && stages[chapter]) return stages[chapter];
    return stages.find(stage => stage.discovered && !stage.done) || stages.find(stage => !stage.done) || stages.at(-1);
  }
  function getIndex(snapshot, stage = getActive(snapshot)) { return Math.max(0, getStages(snapshot).findIndex(value => value.id === stage?.id)); }
  function isAssisted(snapshot) { return snapshot.assisted === true || snapshot.challenge?.assisted === true || snapshot.challenge?.assist === true; }
  function getCounts(snapshot) {
    const stages = getStages(snapshot), inventory = snapshot.inventory || {};
    return {echoes:stages.filter(stage => stage.done).length, total:stages.length || 5, feathers:finite(inventory.feathers ?? snapshot.totals?.foundFeathers), featherTotal:finite(inventory.totalFeathers) || 12};
  }
  function getRegion(snapshot, index) {
    const region = snapshot.region, chapter = snapshot.chapter;
    return (typeof region === 'string' ? region : region?.name || region?.title) || (typeof chapter === 'object' ? chapter?.region || chapter?.title : '') || chapterNames[index] || '林河寻光';
  }
  function getGuide(snapshot, stage = getActive(snapshot)) {
    const index = getIndex(snapshot, stage), hint = stageHints[index] || stageHints[0], chapter = snapshot.chapter;
    const title = (typeof chapter === 'object' && chapter?.id === stage?.id && chapter?.objective) || stage?.objective;
    return {index, title:title && title.length <= 10 ? title : hint.verb, detail:stage?.subtitle || hint.detail, hint:hint.hint};
  }

  function update(snapshot = {}) {
    if (disposed) return;
    latest = snapshot;
    const active = getActive(snapshot), guide = getGuide(snapshot, active), counts = getCounts(snapshot), challenge = snapshot.challenge;
    const visible = snapshot.visible !== false && (!snapshot.mode || snapshot.mode === 'playing');
    root.hidden = !visible; mapButton.hidden = snapshot.visible === false;
    root.dataset.chapter = active?.id || 'root';
    document.body.classList.toggle('v5-playing', visible);
    document.body.classList.add('v5-interface');
    if (!visible) releaseFocus();
    const distance = Math.max(0, finite(snapshot.distance));
    // The high-water mark only changes map visibility; it never grants game progress.
    if (distance < 1 && !getStages(snapshot).some(stage => stage.discovered || stage.done) && counts.feathers === 0) furthest = 0;
    furthest = Math.max(furthest, distance, finite(snapshot.furthestDistance));
    setText('v5-region', getRegion(snapshot, guide.index));
    setText('v5-chapter-no', snapshot.completed ? '余韵' : `第${['一','二','三','四','五'][guide.index] || '一'}境`);
    setText('v5-objective-title', snapshot.completed ? '林河已醒，继续自在探索' : guide.title);
    const near = snapshot.interaction;
    const starting = !counts.echoes && distance < 18 && !near && !snapshot.inventory?.carried;
    const touch = coarsePointer.matches || innerWidth <= 700;
    setText('v5-objective-hint', starting ? (touch ? '左下摇杆前行，点「听」寻找方向。' : '先沿小径前行，穿过树根下的光。') : (snapshot.inventory?.carried ? '微光正与你同行。寻找还未亮起的根巢。' : (near ? '' : guide.hint)));
    el('v5-objective-hint').hidden = !!near || !!snapshot.completed;
    const progress = finite(active?.progress), total = finite(active?.total);
    const tickCount = Math.min(12, Math.max(0, Math.round(total)));
    const tickSignature = `${active?.id}/${tickCount}/${Math.floor(progress)}`;
    if (el('v5-stage-ticks').dataset.state !== tickSignature) {
      el('v5-stage-ticks').dataset.state = tickSignature;
      el('v5-stage-ticks').innerHTML = Array.from({length:tickCount}, (_, i) => `<i class="${i < progress ? 'is-done' : ''}"></i>`).join('');
    }
    el('v5-stage-progress').hidden = !total || !!snapshot.completed || !!challenge?.active;
    setText('v5-stage-count', `${Math.min(Math.floor(progress), total)} / ${total}`);
    el('v5-stage-progress').setAttribute('aria-label', `当前机关已完成 ${Math.floor(progress)}，共 ${total}`);
    setText('v5-feathers', counts.feathers); el('v5-feathers').nextElementSibling.textContent = `/ ${counts.featherTotal}`;
    setText('v5-echo-count', `${counts.echoes} / ${counts.total} 回响`);
    el('v5-pocket').setAttribute('aria-label', `打开行旅图。已拾得 ${counts.feathers} 枚光羽，唤醒 ${counts.echoes} 道回响`);
    el('v5-carried').hidden = !snapshot.inventory?.carried;
    el('v5-first-steps').hidden = !starting || distance > 9;
    if (challenge?.active) trialResultStamp = null;
    if (challenge?.phase === 'finished' && challenge.time > 0 && trialResultStamp !== challenge.time) {
      trialResultStamp = challenge.time; trialResultUntil = performance.now() + 9500;
    }
    const trialResult = challenge?.phase === 'finished' && performance.now() < trialResultUntil;
    const trialVisible = !!challenge?.active || trialResult;
    root.classList.toggle('v5-in-trial', trialVisible);
    document.body.classList.toggle('v5-trial-active', visible && !!challenge?.active);
    el('v5-trial').hidden = !trialVisible;
    el('v5-trial').classList.toggle('v5-trial-finished', trialResult);
    if (trialVisible) {
      setText('v5-trial-title', trialResult ? '试翼完成 · 风记住了你' : '试翼 · 随风而行');
      setText('v5-trial-rings', `${finite(challenge.ringsHit)} / ${finite(challenge.ringsTotal)} 环`);
      setText('v5-trial-time', formatTime(challenge.time));
      el('v5-trial-fill').style.transform = `scaleX(${clamp(challenge.ringsHit / Math.max(1, challenge.ringsTotal))})`;
      el('v5-trial-assisted').hidden = !isAssisted(snapshot);
      el('v5-trial-assist').setAttribute('aria-pressed', String(isAssisted(snapshot)));
      setText('v5-trial-assist', isAssisted(snapshot) ? '轻松飞行 · 已开启' : '开启轻松飞行');
      const resultCopy = ({gold:'金羽 · 一次轻盈而勇敢的飞行。',silver:'银羽 · 六道风环，连成你的来路。',bronze:'铜羽 · 每一次抵达，都值得记住。',free:'自在之羽 · 按自己的节奏，也能抵达。'})[challenge.medal] || '六道风环已经相连，成绩已记入行旅图。';
      setText('v5-trial-hint', trialResult ? resultCopy : challenge.hint || (touch ? '按住 ↑ 振翼，松开滑翔 · 追随下一道亮环' : '长按空格振翼，松开滑翔 · 追随下一道亮环'));
      setText('v5-trial-retry', trialResult ? '再飞一次' : '回到起点重试');
    }
    const actionable = visible && !!near?.label && !(challenge?.active && near.id === 'flight-start');
    document.body.classList.toggle('v5-has-action', actionable);
    el('v5-action').hidden = !actionable;
    if (actionable) {
      setText('v5-action-key', touch ? near.key === 'F' ? '按住' : '回应' : near.key === 'F' ? '按住 F' : near.key || 'E');
      setText('v5-action-label', near.label);
      setText('v5-action-detail', near.detail || (near.key === 'F' ? '对准光的方向，保持片刻' : '靠近后回应'));
      el('v5-action').classList.toggle('v5-action-hold', near.key === 'F');
      el('v5-action-fill').style.transform = `scaleX(${clamp(near.progress)})`;
      el('v5-action').setAttribute('aria-label', `${near.key === 'F' ? '按住' : ''}${near.label}${near.detail ? '，' + near.detail : ''}`);
    } else releaseFocus();
    if (mapOpen) renderMap(snapshot);
  }

  function openMap(snapshot = latest) {
    if (disposed) return;
    latest = snapshot; releaseFocus(); previousFocus = document.activeElement;
    mapOpen = true;
    const position = snapshot.position || [0,0,0];
    const nearby = getStages(snapshot).filter(stage => (stage.discovered || stage.done) && Array.isArray(stage.position)).map(stage => ({stage, distance:Math.hypot(stage.position[0]-position[0], stage.position[2]-position[2])})).sort((a,b) => a.distance-b.distance)[0];
    selectedStage = nearby && nearby.distance < 60 ? nearby.stage.id : getActive(snapshot)?.id || null;
    document.body.classList.add('v5-map-open');
    renderMap(snapshot, true);
    if (!map.open) map.showModal();
    map.scrollTop = 0;
    el('v5-map-return').focus({preventScroll:true});
    const player = el('v5-map-player'), scroll = el('v5-map-scroll');
    scroll.scrollLeft = Math.max(0, player.offsetLeft - scroll.clientWidth * .45);
  }

  function closeMap() {
    if (!mapOpen && !map.open) return;
    mapOpen = false; document.body.classList.remove('v5-map-open');
    if (map.open) map.close();
    const focusTarget = previousFocus;
    if (focusTarget?.isConnected && !focusTarget.closest('[hidden]')) focusTarget.focus({preventScroll:true});
    else if (focusTarget) requestAnimationFrame(() => { if (!disposed && !mapOpen && focusTarget.isConnected && !focusTarget.closest('[hidden]') && (!document.activeElement || document.activeElement === document.body)) focusTarget.focus({preventScroll:true}); });
    previousFocus = null;
  }

  function renderMap(snapshot, force = false) {
    const stages = getStages(snapshot), known = stages.filter(stage => stage.discovered || stage.done), counts = getCounts(snapshot);
    const active = getActive(snapshot), encounters=(snapshot.encounters||[]).filter(e=>e.discovered||e.cleared), encounter=encounters.find(e=>'encounter:'+e.id===selectedStage);
    const selected=encounter?{...encounter,id:'encounter:'+encounter.id,done:encounter.cleared,subtitle:encounter.story,hint:encounter.cleared?encounter.reward+'已回到林河。生息已随旅程保存。':'靠近种心按 E 唤醒。观察环波，用跳跃、闪身或飞行躲开；青心露出时 E / B 鸣光。',progress:encounter.cleared?1:0,total:1}:known.find(stage => stage.id === selectedStage) || known.find(stage => stage.id === active?.id) || known.at(-1);
    const signature = JSON.stringify([known.map(stage => [stage.id,stage.done,stage.progress,stage.total]), selected?.id, encounters.map(e=>[e.id,e.cleared]), counts, Math.round(snapshot.distance || 0), snapshot.challenge, isAssisted(snapshot)]);
    if (!force && lastMapSignature === signature) return;
    lastMapSignature = signature;
    setText('v5-map-distance', `${Math.round(Math.max(furthest, finite(snapshot.distance)))} 米 · 已行`);
    setText('v5-map-echoes', `${counts.echoes} / ${counts.total}`);
    setText('v5-map-feathers', `${counts.feathers} / ${counts.featherTotal}`);
    setText('v5-note-status', encounter ? encounter.cleared ? '种火归来 · 已净化' : '可选探索 · 寻回种火' : selected ? selected.done ? '已经唤醒' : '尚未解开的回响' : '第一步，从好奇开始');
    setText('v5-note-title', selected?.title || '先向林中的光走去');
    const hint = stageHints[getIndex(snapshot, selected || active)] || stageHints[0];
    setText('v5-note-description', selected?.done ? selected.subtitle || '这一道回响已经留下。它将照亮继续前行的路。' : selected?.subtitle || '走过的林河会留在手记中。靠近未知，新的线索才会出现。');
    setText('v5-note-hint', encounter ? selected.hint : selected?.done ? '可以继续寻找沿途的光羽，或合上手记去往远方。' : selected?.hint || hint.hint);
    const n = finite(selected?.progress), total = finite(selected?.total);
    el('v5-note-progress').innerHTML = total ? `<span>${encounter ? encounter.cleared ? '生息已归来' : '种火尚待寻回' : selected?.done ? '已完成' : total === 1 ? '聚光' : '已回应'} <b>${total === 1 && n < 1 ? Math.round(clamp(n) * 100) + '%' : Math.min(n, total) + ' / ' + total}</b></span><i><b style="transform:scaleX(${clamp(n / total)})"></b></i>` : '';
    el('v5-map-index').innerHTML = known.map((stage, index) => `<button data-stage="${escape(stage.id)}" aria-pressed="${stage.id === selected?.id}" class="${stage.done ? 'is-done' : ''}"><i aria-hidden="true">${stage.done ? '✓' : '◇'}</i><span>${escape(stage.title || chapterNames[index])}</span><small>${stage.done ? '已唤醒' : '未解'}</small></button>`).join('');
    el('v5-unknown-note').hidden = counts.echoes >= counts.total;
    el('v9-map-encounters').hidden=!encounters.length;
    el('v9-map-encounter-list').innerHTML=encounters.map(e=>`<button data-stage="encounter:${escape(e.id)}" aria-pressed="${selectedStage==='encounter:'+e.id}" class="${e.cleared?'is-cleared':''}"><i aria-hidden="true">${e.cleared?'✦':'◈'}</i><span>${escape(e.title)}</span><small>${e.cleared?'已净化':'待回应'}</small></button>`).join('');
    const found = Array.isArray(snapshot.feathers) ? snapshot.feathers.filter(item => item.found) : [];
    el('v5-feather-notes').hidden = !found.length;
    setText('v5-found-count', `${found.length} / ${counts.featherTotal}`);
    el('v5-found-feathers').innerHTML = found.map(item => `<li><span>${escape(item.label)}</span><small>${({ground:'林间',perch:'枝头',water:'水下',air:'空中'})[item.kind] || '旅途'}</small></li>`).join('');
    const flight = stages.find((stage, index) => index === 3 && (stage.discovered || stage.done));
    el('v5-map-flight').hidden = !flight && !snapshot.challenge;
    const best = snapshot.trialRecord?.best ?? snapshot.challenge?.best;
    setText('v5-map-best', Number.isFinite(best) && best > 0 ? formatTime(best) : '尚未留下成绩');
    el('v5-map-assist').checked = isAssisted(snapshot);
    el('v5-map-retry').hidden = !flight && !snapshot.challenge;
    setText('v5-map-retry', snapshot.challenge?.active ? '回到起点，重新试翼' : '前往起点，再飞一次');
    drawMap(snapshot, known, selected);
  }

  function drawMap(snapshot, known, selected) {
    const raw = Array.isArray(snapshot.path) ? snapshot.path.filter(point => Array.isArray(point) && point.length >= 3 && point.every(Number.isFinite)) : [];
    const path = raw.length > 1 ? raw : [[0,0,12],[-2,0,-3],[-12,0,-14],[-18,0,-26],[-10,0,-39],[8,0,-48],[15,0,-65],[5,0,-78],[-9,0,-86],[-22,0,-101],[-21,0,-121],[-5,0,-137],[13,0,-147],[23,0,-167],[14,0,-186],[-5,0,-193],[-17,0,-213],[-10,0,-232],[9,0,-244],[18,0,-265],[6,0,-282],[0,0,-302]];
    const xs = path.map(p => p[0]), zs = path.map(p => -p[2]);
    const minX = Math.min(...xs) - 15, maxX = Math.max(...xs) + 15, minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const project = point => ({x:80 + (-finite(point?.[2]) - minZ) / Math.max(1, maxZ - minZ) * 820, y:398 - (finite(point?.[0]) - minX) / Math.max(1, maxX - minX) * 246});
    const cumulative = [0]; for (let i = 1; i < path.length; i++) cumulative.push(cumulative.at(-1) + Math.hypot(path[i][0] - path[i-1][0], path[i][2] - path[i-1][2]));
    const pathLength = cumulative.at(-1), gameLength = finite(snapshot.length) || pathLength;
    const nearest = point => { let best = Infinity, index = 0; path.forEach((p, i) => { const d = (p[0] - finite(point?.[0])) ** 2 + (p[2] - finite(point?.[2])) ** 2; if (d < best) {best = d; index = i;} }); return index; };
    let reveal = clamp((Math.max(furthest, finite(snapshot.distance), finite(snapshot.furthestDistance)) + 14) / Math.max(1, gameLength)) * pathLength;
    for (const stage of known) if (stage.position) reveal = Math.max(reveal, cumulative[nearest(stage.position)] + 12);
    const visible = path.filter((point, i) => cumulative[i] <= reveal), display = visible.map(project);
    if (display.length < 2) display.push(project(path[1]));
    const line = display.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const end = display.at(-1), start = display[0];
    // Small terrain sketches belong only to revealed paper: the unvisited route is never drawn.
    let terrain = '';
    for (let i = 0; i < display.length; i += Math.max(1, Math.round(path.length / 35))) {
      const p = display[i], side = i % 2 ? 1 : -1, y = p.y + side * (46 + (i * 17 % 30));
      terrain += `<g transform="translate(${p.x.toFixed(1)} ${y.toFixed(1)})" opacity=".43"><path d="M-13 10q13-24 27 0m-24 5q11-17 21 0m-31 5q20-15 40 0"/><path d="M-6-5v-29m-8 14 8-13 8 13m-19 6 11-17 11 17" opacity=".7"/></g>`;
    }
    const motifs = [
      '<path d="M-35 23q3-57 35-54 28 3 35 54M-26 20q-1-42 26-43 23 1 25 43M-12-28l-4-16M5-31l8-15M-34 23l-10 10m79-10 11 9M-12 22q12-10 24 0"/>',
      '<path d="M-30 18v-43h60v43M-21 18v-34h42v34M-38 24h76m-31-48v-9m-14 9v-9"/><circle cx="0" cy="-4" r="11"/><path d="M-46-4h30m32 0h30" stroke-dasharray="3 4"/>',
      '<path d="M-40-15 0-27 40-15 0-3Zm0 10L0 7 40-5M-40 5 0 17 40 5M-26-19 14-7M-12-23 28-11M-28 0v18m14-14v18m14-15v17m14-21v18m14-25v19"/>',
      '<path d="M-43 4h24q18 0 18-12 0-11-10-11-10 0-10 10M-37 14h49q17 0 17 12 0 8-8 8M-6-2h34q14 0 14-11 0-8-8-8"/><path d="m-17-28 10-3 5 6m14-8 10-3 5 6"/>',
      '<circle cx="0" cy="-8" r="18"/><circle cx="0" cy="-8" r="24" stroke-dasharray="2 6"/><path d="M-37 28v-16m9 16v-19m9 19v-14m10 14v-18M0 28v-15m9 15v-18m10 18v-14m9 14v-19m9 19v-16M-44 33h88"/>',
    ];
    let illustrated = '';
    for (const stage of known) if (stage.position) { const p = project(stage.position), index = getIndex(snapshot,stage); illustrated += `<g transform="translate(${p.x.toFixed(1)} ${(p.y < 250 ? p.y+113 : p.y-104).toFixed(1)})" stroke="#63775d" stroke-width="1.2" opacity=".67" fill="none" stroke-linecap="round" stroke-linejoin="round">${motifs[index] || motifs[0]}</g>`; }
    const foundFeathers = Array.isArray(snapshot.feathers) ? snapshot.feathers.filter(item => item.found && Array.isArray(item.position)) : [];
    for (const item of foundFeathers) { const p = project(item.position); illustrated += `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})" stroke="#9a7348" fill="#dcd2b6" stroke-width="1.2"><title>${escape(item.label)}</title><path d="M-5 6 5-7M-3 2q-4-8 11-12Q9 3 1 4M0-3l4 1"/></g>`; }
    const fogX = Math.max(180, end.x + 70);
    el('v5-map-drawing').innerHTML = `<defs><pattern id="v5-paper-hatch" width="9" height="9" patternUnits="userSpaceOnUse"><path d="M0 9 9 0" stroke="#667460" stroke-opacity=".035" stroke-width=".65"/></pattern><linearGradient id="v5-river-wash" x1="0" x2="1"><stop stop-color="#637f71" stop-opacity=".11"/><stop offset="1" stop-color="#638b84" stop-opacity=".34"/></linearGradient></defs><rect width="1000" height="540" fill="url(#v5-paper-hatch)"/><g fill="none" stroke="#6e7662" stroke-width="1.2">${terrain}</g><path d="${line}" fill="none" stroke="url(#v5-river-wash)" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"/><path d="${line}" fill="none" stroke="#7e9c92" stroke-opacity=".36" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/><path d="${line}" fill="none" stroke="#425e53" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="${line}" fill="none" stroke="#c9b47d" stroke-width="3" stroke-dasharray="1 9" stroke-linecap="round" transform="translate(0 9)"/><circle cx="${start.x}" cy="${start.y}" r="4" fill="#465d51"/><text x="${start.x - 15}" y="${start.y + 40}" fill="#66705b" font-size="15" font-family="serif">入林</text><g transform="translate(63 64)" fill="none" stroke="#65715f" stroke-width="1"><circle r="24" stroke-opacity=".25"/><path d="M-30 0h60M0-30v60m24 0-14-5 3 5-3 5Z"/><text x="37" y="5" stroke="none" fill="#65715f" font-size="11">上游</text></g>${reveal < pathLength - 4 && fogX < 850 ? `<g transform="translate(${fogX} 270)" fill="#78816a" opacity=".62"><path d="M-20-28q20-13 40 0m-32 7q12-8 24 0" fill="none" stroke="currentColor"/><text text-anchor="middle" font-family="serif" font-size="20" letter-spacing="5">未至之境</text><text text-anchor="middle" y="28" font-size="11" letter-spacing="2">等你亲自靠近</text></g>` : ''}`;
    el('v5-map-drawing').insertAdjacentHTML('beforeend', illustrated);
    el('v5-map-pins').innerHTML = known.filter(stage => Array.isArray(stage.position)).map(stage => { const p = project(stage.position); return `<button data-stage="${escape(stage.id)}" class="v5-map-pin ${stage.done ? 'is-done' : ''} ${stage.id === selected?.id ? 'is-selected' : ''}" style="left:${p.x / 10}%;top:${p.y / 5.4}%" aria-label="${escape(stage.title)}，${stage.done ? '已唤醒' : '未解的回响'}" aria-pressed="${stage.id === selected?.id}"><i>${stage.done ? '✦' : '◇'}</i><span>${escape(stage.title)}</span></button>`; }).join('');
    const encounters=(snapshot.encounters||[]).filter(e=>(e.discovered||e.cleared)&&Array.isArray(e.position));
    for(const e of encounters){const p=project(e.position),y=p.y+62;el('v5-map-drawing').insertAdjacentHTML('beforeend',`<path d="M${p.x},${p.y+8}v44" fill="none" stroke="#8b7c5a" stroke-width=".9" stroke-dasharray="2 3"/><circle cx="${p.x}" cy="${p.y}" r="2" fill="#8b7c5a"/>`);el('v5-map-pins').insertAdjacentHTML('beforeend',`<button data-stage="encounter:${escape(e.id)}" class="v5-map-pin v9-encounter-pin ${e.cleared?'is-done':''} ${selected?.id==='encounter:'+e.id?'is-selected':''}" style="left:${p.x/10}%;top:${y/5.4}%" aria-label="${escape(e.title)}，${e.cleared?'种火已归来':'待净化的蚀影'}" aria-pressed="${selected?.id==='encounter:'+e.id}"><i aria-hidden="true">${e.cleared?'✦':'◈'}</i><span>${escape(e.title)}</span></button>`);}
    const player = project(snapshot.position || path[0]);
    el('v5-map-player').style.left = `${clamp(player.x / 10, 2, 98)}%`; el('v5-map-player').style.top = `${clamp(player.y / 5.4, 5, 95)}%`;
  }

  function showDiscovery({title, text} = {}) {
    if (disposed) return;
    clearTimeout(discoveryTimer); setText('v5-discovery-title', title || '一段新的回响'); setText('v5-discovery-text', text || '已经记入林河行旅图。');
    const card = el('v5-discovery'); card.hidden = false; card.classList.add('is-arriving');
    // Alternate equivalent CSS animations without a synchronous layout read.
    // CSS reduced-motion rules still cancel the animation immediately.
    card.style.animationName = card.style.animationName === 'v5-discovered' ? 'v5-discovered-again' : 'v5-discovered';
    discoveryTimer = window.setTimeout(() => { card.hidden = true; }, 6200);
  }

  function reset() {
    releaseFocus(); closeMap(); clearTimeout(discoveryTimer); furthest = 0; selectedStage = null; lastMapSignature = ''; latest = {}; trialResultStamp = null; trialResultUntil = 0;
    el('v5-discovery').hidden = true;
  }

  function dispose() {
    releaseFocus(); closeMap(); clearTimeout(discoveryTimer); controller.abort(); disposed = true;
    root.remove(); map.remove(); mapButton.remove(); document.body.classList.remove('v5-interface','v5-playing','v5-has-action','v5-map-open','v5-trial-active');
  }
  return {update, openMap, closeMap, showDiscovery, reset, dispose};
}
