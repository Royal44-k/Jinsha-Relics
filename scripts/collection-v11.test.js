import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCollectionStore, collectionKey} from '../src/v11/collection-state.js';
import {relics,forms,fieldFinds} from '../src/v11/collection-data.js';
import {chapterIds} from '../src/v10/ledger.js';

function fakeStorage() {
  const entries=new Map();
  return {getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
}
function setup(count=0,storage=fakeStorage()) {
  const completed=chapterIds.slice(0,count);
  const store=createCollectionStore({getCompleted:()=>completed,storage});
  store.sync();
  return {store,completed,storage};
}

test('all nine active route IDs map to unique sourced observations and one supported answer',()=>{
  assert.deepEqual(relics.map(r=>r.id),chapterIds);
  assert.deepEqual(new Set(relics.map(r=>r.image)).size,9);
  assert.equal(new Set(fieldFinds.map(f=>f.id)).size,4);
  for (const r of relics) {
    assert.ok(r.fact && r.fiction && r.observation && r.why);
    assert.ok(Number.isInteger(r.answer) && r.choices[r.answer]);
    assert.ok([r.source,r.secondSource].some(link=>link?.startsWith('https://www.jinshasitemuseum.com/')));
  }
});
test('old route and first completion award the same observation only once',()=>{
  const {store,completed,storage}=setup(3);
  assert.equal(store.snapshot().totalXP,90);
  completed.push(chapterIds[3]);
  assert.equal(store.sync().totalXP,120);
  assert.equal(store.sync().chapters.length,4);
  const restart=setup(4,storage).store;
  assert.equal(restart.snapshot().totalXP,120);
  assert.equal(restart.snapshot().availableXP,120);
});
test('unearned chapters, malformed IDs and a missing middle chapter cannot unlock answers',()=>{
  const {store,completed,storage}=setup();
  completed.push(chapterIds[0],chapterIds[2],'<img src=x>');
  storage.setItem(collectionKey+'.quizzes.'+chapterIds[8],'1');
  storage.setItem(collectionKey,'__proto__');
  assert.deepEqual(store.sync().chapters,[chapterIds[0]]);
  assert.equal(store.answer(chapterIds[8],0),'locked');
  assert.equal(store.discover('constructor'),false);
  assert.equal(store.snapshot().equipped,'reed');
});
test('incorrect answers are free to retry and correct answers cannot be farmed or required',()=>{
  const {store,completed}=setup(1);
  const first=relics[0];
  assert.equal(store.answer(first.id,(first.answer+1)%3),'wrong');
  assert.equal(store.snapshot().availableXP,30);
  assert.equal(store.answer(first.id,first.answer),'correct');
  assert.equal(store.answer(first.id,first.answer),'already');
  assert.equal(store.snapshot().availableXP,48);
  completed.push(...chapterIds.slice(1));
  assert.equal(store.sync().chapters.length,9);
  assert.equal(store.snapshot().quizzes.length,1);
});
test('three independently discoverable field finds survive reload and grant no duplicate XP',()=>{
  const {store,storage}=setup();
  const second=setup(0,storage).store;
  assert.ok(store.discover('spindle'));
  assert.ok(second.discover('netsinker'));
  assert.ok(store.discover('stoneblank'));
  assert.equal(second.discover('spindle'),false);
  assert.equal(store.sync().fieldFinds.length,3);
  assert.equal(store.snapshot().totalXP,36);
});
test('earned and unspent XP are distinct; thresholds survive purchases; forms change real traits',async()=>{
  const {store,completed}=setup(1);
  assert.equal(store.equip('sun'),false);
  assert.equal(await store.upgrade('reed',1),false);
  store.answer(relics[0].id,relics[0].answer);
  assert.equal(await store.upgrade('reed',1),true);
  assert.equal(store.snapshot().availableXP,8);
  assert.equal(store.snapshot().traits.groundSpeed,1.15);
  assert.equal(await store.upgrade('reed',1),false);
  completed.push(chapterIds[1]);store.sync();
  assert.ok(store.equip('jade'));
  assert.equal(store.snapshot().traits.airEfficiency,.88);
  assert.equal(store.snapshot().traits.groundSpeed,1);
  assert.equal(store.snapshot().totalXP,78);
  assert.equal(store.snapshot().availableXP,38);
});
test('two stale purchase requests for the same tier spend its cost once',async()=>{
  const {store,storage}=setup(9);
  const other=setup(9,storage).store;
  const results=await Promise.all([store.upgrade('reed',1),other.upgrade('reed',1)]);
  assert.equal(results.filter(Boolean).length,1);
  assert.equal(store.sync().availableXP,230);
  assert.equal(other.sync().levels.reed,2);
});
test('every form can reach tier three and remains equipped on reload',async()=>{
  const {store,storage}=setup(9);
  for (const r of relics) store.answer(r.id,r.answer);
  for (const f of forms) {
    assert.ok(await store.upgrade(f.id,1));
    assert.ok(await store.upgrade(f.id,2));
    assert.equal(await store.upgrade(f.id,3),false);
  }
  assert.equal(store.equip('sun'),true);
  const saved=setup(0,storage).store.snapshot();
  assert.deepEqual(saved.levels,{reed:3,jade:3,sun:3});
  assert.equal(saved.totalXP,432);assert.equal(saved.availableXP,117);
  assert.equal(saved.traits.dashRecovery,.68);
});
test('storage denial keeps purchases, equipment and unique rewards usable for this visit',async()=>{
  const fail=()=>{throw new Error('denied');};
  let notices=0;
  const store=createCollectionStore({getCompleted:()=>chapterIds,storage:{getItem:fail,setItem:fail},onStorageFailure:()=>notices++});
  assert.equal(store.sync().totalXP,270);
  assert.ok(store.equip('jade'));
  assert.ok(await store.upgrade('jade',1));
  assert.equal(store.sync().traits.airEfficiency,.79);
  assert.equal(notices,1);
});
test('reset clears only the Jinsha collection namespace',()=>{
  const {store,storage,completed}=setup(6);
  storage.setItem('unrelated','keep');store.discover('spindle');store.equip('sun');
  completed.length=0;
  store.reset();assert.equal(store.sync().totalXP,0);
  assert.equal(store.snapshot().equipped,'reed');assert.equal(storage.getItem('unrelated'),'keep');
});
test('all twelve specimens and nine stages of plumage have locally packaged WebP art',async()=>{
  const plates=[...relics.map(r=>r.image),...fieldFinds.map(f=>f.id),...forms.flatMap(f=>['-1','-2',''].map(s=>'form-'+f.id+s))];
  for (const file of plates) {
    const bytes=await readFile(new URL('../public/assets/v11/collections/'+file+'.webp',import.meta.url));
    assert.ok(bytes.length>1200);
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
  }
});

