/** Personal epilogue from saved actions; optional restoration never gates the sun. */
export function endingMemory(snapshot={}){
 const nodes=snapshot.encounters||[],count=nodes.filter(n=>n.cleared).length,level=snapshot.growth?.name||'初羽';
 const lines=[
  '日轮醒来，来路仍有细小的声音。愿你再一次，为它们停留。',
  '一簇种火回到了林河。微小的回应，也能陪春意走得更远。',
  '两簇种火重新亮起。来路仍留着安静的角落，等你把春意带去。',
  '三簇种火沿来路亮起。从古根到日轮，你把一个春天还给了林河。',
 ];
 return {count,level,line:lines[Math.min(3,count)],caption:count===3?'林河的春天，因你完整。':'日轮之后，旅程仍可继续。',marks:nodes.map(n=>({id:n.id,cleared:!!n.cleared,label:n.discovered?n.title:'尚未相遇的回响'}))};
}
export function updateEndingMemory(host,snapshot){
 if(!host)return;const value=endingMemory(snapshot);host.replaceChildren();
 const line=document.createElement('p');line.className='v9-epilogue-line';line.textContent=value.line;host.append(line);
 const tokens=document.createElement('div');tokens.className='v9-epilogue-seeds';tokens.setAttribute('aria-label','已带回 '+value.count+' 簇种火');
 for(const mark of value.marks){const seed=document.createElement('span');seed.className=mark.cleared?'is-restored':'';seed.title=mark.label;seed.setAttribute('aria-label',mark.label+(mark.cleared?'，已净化':'，尚未净化'));seed.innerHTML='<svg viewBox="0 0 28 36" fill="none" aria-hidden="true"><path d="M14 3C24 13 26 22 14 32C2 22 4 13 14 3Z" stroke="currentColor"/><path d="M14 9V27M14 19l-5-5M14 23l5-5" stroke="currentColor" stroke-width=".7"/></svg>';tokens.append(seed);}
 host.append(tokens);const caption=document.createElement('small');caption.textContent=value.level+' · '+value.caption;host.append(caption);
}
