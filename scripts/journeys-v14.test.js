import test from 'node:test';
import assert from 'node:assert/strict';
import {createJourneyBook,journeyKey} from '../src/v14/journeys.js';
import {createJourneyWriter} from '../src/v14/journey-writer.js';
import {chapterIds,saveKey,encode,restore} from '../src/v10/ledger.js';
import {collectionKey,createCollectionStore} from '../src/v11/collection-state.js';
import {relics} from '../src/v11/collection-data.js';

function store(){
  const data=new Map();
  return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,
    getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
}
function completed(count){
  return {...restore(null),started:true,completed:chapterIds.slice(0,count),quality:'economy',muted:true};
}

test('creating two journeys retains original archive and creates two independent prologues',()=>{
  const storage=store(),a=createJourneyBook(storage),b=createJourneyBook(storage);
  const raw=encode(completed(4));
  storage.setItem(saveKey,raw);storage.setItem('jinsha-river-survey-v10',encode(completed(2)));
  const first=a.resolve(),second=a.create(a.load(first)),third=b.create(b.load(first));
  assert.equal(first,'first');assert.notEqual(second,third);
  assert.deepEqual(new Set(a.list().map(x=>x.id)),new Set([first,second,third]));
  const blank=a.load(second);
  assert.equal(blank.started,false);assert.deepEqual(blank.completed,[]);assert.equal(blank.quality,'economy');assert.equal(blank.muted,true);
  assert.equal(a.legacy().completed.length,2);
  storage.setItem(journeyKey(second,saveKey),encode(completed(1)));
  assert.deepEqual(b.load(third).completed,[]);
  assert.equal(storage.getItem(saveKey),raw);
  assert.equal(a.resolve(),third);assert.equal(a.resolve(first),first);
  a.select(second);assert.equal(b.resolve(third),third);
  assert.equal(b.resolve(),second);
});

test('a separate trip cannot acquire the first collection, equip it, or clear its flume',()=>{
  const storage=store(),book=createJourneyBook(storage);
  const second=book.create(completed(1));
  storage.setItem('jinsha-flume-v1.bank','old layers');
  storage.setItem(journeyKey(second,'jinsha-flume-v1')+'.bank','new layers');
  const first=createCollectionStore({storage,getCompleted:()=>chapterIds});
  const fresh=createCollectionStore({storage,key:journeyKey(second,collectionKey),getCompleted:()=>[]});
  first.sync();first.answer(relics[0].id,relics[0].answer);first.equip('sun');
  assert.ok(first.snapshot().totalXP>200);assert.equal(fresh.sync().totalXP,0);
  assert.equal(fresh.sync().equipped,'reed');
  fresh.reset();
  assert.deepEqual(first.sync().quizzes,[relics[0].id]);
  assert.equal(first.sync().equipped,'sun');assert.equal(storage.getItem('jinsha-flume-v1.bank'),'old layers');
});

test('unknown slots and rejected writes cannot replace the original journey',()=>{
  const storage=store(),book=createJourneyBook(storage),raw=encode(completed(6));
  storage.setItem(saveKey,raw);assert.equal(book.resolve('invalid'),'first');
  const second=book.create(completed(1));
  assert.throws(()=>journeyKey('not-a-slot',saveKey));
  storage.setItem=()=>{throw new Error('full');};
  assert.throws(()=>book.create(completed(2)));
  assert.equal(book.resolve(),second);assert.equal(storage.getItem(saveKey),raw);
  assert.equal(createJourneyBook(null).load('first').started,false);
  assert.throws(()=>createJourneyBook(null).create(completed(1)));
});

test('retry preserves edited fields and combines all unsaved revisit deltas with other tabs exactly once',async()=>{
  const storage=store(),key=saveKey;
  const oldTriptych=[chapterIds[0],chapterIds[3],chapterIds[6]];
  const newTriptych=[chapterIds[2],chapterIds[4],chapterIds[8]];
  const film=base=>Array(3).fill('data:image/jpeg;base64,/9j/'+base);
  const base={...completed(9),ending:true,fieldTriptych:oldTriptych,photos:film('AAAA')};
  storage.setItem(key,encode(base));
  const local=restore(encode(base));let canWrite=false;
  const access={getItem:k=>storage.getItem(k),setItem(k,v){
    if(!canWrite)throw new Error('quota');storage.setItem(k,v);
  }};
  const writer=createJourneyWriter({record:local,storage:access,key});
  Object.assign(local,{muted:false,quality:'high',fieldTriptych:newTriptych,photos:film('BBBB')});
  local.revisits[chapterIds[0]]=1;
  assert.equal(await writer.save({muted:true,quality:true,photos:true,fieldTriptych:true,revisited:chapterIds[0]}),false);
  // Another tab records five visits (and keeps the old preferences and plates).
  storage.setItem(key,encode({...base,revisits:{[chapterIds[0]]:5}}));
  writer.acceptStored(restore(storage.getItem(key)));
  assert.deepEqual(local.fieldTriptych,newTriptych);assert.deepEqual(local.photos,film('BBBB'));
  assert.equal(local.revisits[chapterIds[0]],6);
  local.revisits[chapterIds[0]]++;
  assert.equal(await writer.save({revisited:chapterIds[0]}),false);
  canWrite=true;
  assert.equal(await writer.finish(),true);
  await writer.save({});await writer.finish();
  const saved=restore(storage.getItem(key));
  assert.deepEqual(saved.photos,film('BBBB'));assert.deepEqual(saved.fieldTriptych,newTriptych);
  assert.equal(saved.muted,false);assert.equal(saved.quality,'high');
  assert.equal(saved.revisits[chapterIds[0]],7);
});
