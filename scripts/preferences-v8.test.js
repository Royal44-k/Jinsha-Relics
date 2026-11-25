import test from 'node:test';
import assert from 'node:assert/strict';
import {readPreferences,savePreferences,PREFERENCES_KEY} from '../src/v8/preferences.js';
test('title preferences survive without creating or overwriting a journey',()=>{
 const values=new Map([['jinsha-forest-v2','existing journey bytes']]),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 assert.equal(savePreferences({quality:'low',resolution:'detail',music:.4,progress:200},storage),true);
 assert.equal(values.get('jinsha-forest-v2'),'existing journey bytes');assert.deepEqual(readPreferences(storage),{quality:'low',resolution:'detail',music:.4});
 values.delete('jinsha-forest-v2');savePreferences({resolution:'balanced'},storage);assert.equal(values.has('jinsha-forest-v2'),false);assert.equal(values.size,1);assert.ok(values.has(PREFERENCES_KEY));
});
test('corrupt or unavailable preference storage preserves safe defaults',()=>{
 assert.deepEqual(readPreferences({getItem:()=>'{broken'}),{});assert.deepEqual(readPreferences({getItem:()=>JSON.stringify({quality:'invalid',resolution:'unknown',music:-1,voice:4,reduced:'yes'})}),{music:0,voice:1});
 const unavailable={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};assert.deepEqual(readPreferences(unavailable),{});assert.equal(savePreferences({},unavailable),false);
});
