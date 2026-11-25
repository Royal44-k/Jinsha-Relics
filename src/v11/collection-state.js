import {relics, fieldFinds, forms} from './collection-data.js';

export const collectionKey = 'jinsha-mysteries-collection-v1';
export const discoveryXP = 30;
export const quizXP = 18;
export const fieldXP = 12;
export const upgradeCost = [0, 40, 65];

const relicIndex = new Map(relics.map(item => [item.id, item]));
const fieldIndex = new Set(fieldFinds.map(item => item.id));
const formIndex = new Map(forms.map(form => [form.id, form]));
const keys = {
  chapters: relics.map(item => item.id),
  quizzes: relics.map(item => item.id),
  fieldFinds: fieldFinds.map(item => item.id),
  upgrades: forms.flatMap(form => [form.id + '-2', form.id + '-3'])
};

function emptyCollection() {
  return {chapters:[], quizzes:[], fieldFinds:[], upgrades:[], equipped:'reed'};
}

function withTraits(form, level) {
  return {id:form.id, title:form.title, level, bodyTint:form.bodyTint, wingTint:form.wingTint,
    groundSpeed:1, airEfficiency:1, dashRecovery:1, [form.stat]:form.values[level - 1]};
}

// Derive total XP and prices from unique discoveries. A client cannot repeatedly
// claim an answer, and importing an old completed route grants each card once.
export function collectionSnapshot(record) {
  const totalXP = record.chapters.length * discoveryXP + record.quizzes.length * quizXP + record.fieldFinds.length * fieldXP;
  let availableXP = totalXP;
  const levels = {reed:1, jade:1, sun:1};
  for (const key of record.upgrades) {
    const [id, target] = key.split('-');
    const level = Number(target);
    const form = formIndex.get(id);
    const cost = upgradeCost[level - 1];
    if (!form || totalXP < form.threshold || levels[id] !== level - 1 || availableXP < cost) continue;
    levels[id] = level;
    availableXP -= cost;
  }
  const equipped = formIndex.get(record.equipped);
  const active = equipped && totalXP >= equipped.threshold ? equipped : forms[0];
  return {...record, chapters:[...record.chapters], quizzes:[...record.quizzes], fieldFinds:[...record.fieldFinds],
    upgrades:[...record.upgrades], equipped:active.id, totalXP, availableXP, levels,
    traits:withTraits(active, levels[active.id])};
}

function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

// Each independent find has its own write-once key so two concurrently open tabs
// can collect different objects safely. Only equipment is a last-writer setting.
// Purchases are revalidated under a short Web Lock on browsers which support it.
export function createCollectionStore({getCompleted = () => [], storage = browserStorage(), key = collectionKey, onStorageFailure = () => {}} = {}) {
  let memory = emptyCollection();
  const purchases=new Set();
  let storageWarning = false;
  const localKey = (group, id) => key + '.' + group + '.' + id;
  function inaccessible() {
    if (!storageWarning) { storageWarning = true; onStorageFailure(); }
  }
  function read(key) {
    if (storageWarning) return null;
    try { return storage?.getItem(key) ?? null; } catch { inaccessible(); return null; }
  }
  function write(key, value) {
    if (storageWarning) return;
    if (!storage) { inaccessible(); return; }
    try { storage.setItem(key, value); } catch { inaccessible(); }
  }
  function mark(group, id) {
    if (memory[group].includes(id)) return false;
    write(localKey(group,id), '1');
    memory[group].push(id);
    return true;
  }
  function sync() {
    for (const [group, ids] of Object.entries(keys)) {
      for (const id of ids) {
        if (!memory[group].includes(id) && read(localKey(group,id)) === '1') memory[group].push(id);
      }
    }
    const completed = getCompleted();
    const ordered = Array.isArray(completed) ? completed : [];
    // The route has a fixed sequence; ignore injected identifiers and gaps.
    for (let index = 0; index < relics.length; index++) {
      const id = relics[index].id;
      if (ordered[index] !== id) break;
      mark('chapters',id);
    }
    // Never grant a quiz reward without its original observation.
    memory.quizzes = memory.quizzes.filter(id => memory.chapters.includes(id));
    const selected = read(key);
    if (formIndex.has(selected)) memory.equipped = selected;
    return collectionSnapshot(memory);
  }
  function discover(id) {
    if (!fieldIndex.has(id)) return false;
    sync();
    return mark('fieldFinds', id);
  }
  function answer(id, option) {
    const state = sync();
    const relic = relicIndex.get(id);
    if (!relic || !state.chapters.includes(id)) return 'locked';
    if (state.quizzes.includes(id)) return 'already';
    if (option !== relic.answer) return 'wrong';
    mark('quizzes', id);
    return 'correct';
  }
  function equip(id) {
    const state = sync();
    const form = formIndex.get(id);
    if (!form || state.totalXP < form.threshold || state.equipped === id) return false;
    memory.equipped = id;
    write(key,id);
    return true;
  }
  async function upgrade(id, expectedLevel) {
    const buy = () => {
      const form = formIndex.get(id);
      const state = sync();
      if (!form || state.totalXP < form.threshold) return false;
      const level = state.levels[id];
      if (level !== expectedLevel || level >= 3 || state.availableXP < upgradeCost[level]) return false;
      return mark('upgrades', id + '-' + (level + 1));
    };
    if (globalThis.navigator?.locks?.request) {
      const operation=globalThis.navigator.locks.request(key,buy);
      purchases.add(operation);
      try{return await operation;}finally{purchases.delete(operation);}
    }
    return buy();
  }
  function reset() {
    memory = emptyCollection();
    try {
      for (const [group, ids] of Object.entries(keys)) {
        for (const id of ids) storage?.removeItem(localKey(group,id));
      }
      storage?.removeItem(key);
    } catch { inaccessible(); }
  }
  return {sync, snapshot:() => collectionSnapshot(memory), discover, answer, equip, upgrade, reset,
    finishPurchases:()=>Promise.all([...purchases])};
}

