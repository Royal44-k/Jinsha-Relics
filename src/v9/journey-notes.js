/** Unlocked original story beats, separated from the museum's artifact entries. */
const replies={
 reed:{title:'芦岸来信',place:'水声归来',text:'蚀影散去以后，先回来的不是光，是芦叶互相擦过的声音。烁羽把翅膀收低，听了一会儿。原来安静也有两种：一种失去了回应，一种正在等你。'},
 stone:{title:'石廊来信',place:'归家的路',text:'石缝亮起时，远处泥火的颜色也近了。那些细碎的陶片没有讲述一位英雄；它们留下端水、烧火、等人归来的手。烁羽第一次觉得，守住一条回家的路，也是一件很勇敢的事。'},
 dusk:{title:'暮原来信',place:'最后一簇种火',text:'风绕过九柱，最后的种火没有熄灭。烁羽回头看，才发现身后的林与河已不再是来时的模样。它把翅膀展开——这一次，不是为了离开，而是把听见的回应带得更远。'},
};
export function journeyNotesMarkup(snapshot={}){
 const root=snapshot.stages?.find(s=>s.id==='root')?.done,entries=(snapshot.encounters||[]).filter(e=>e.cleared&&replies[e.id]).map(e=>replies[e.id]);
 if(!root&&!entries.length)return '';
 return '<section class="v9-journey-notes"><p class="eyebrow">烁羽的旅途 · 原创故事</p><h3>土地，给你的回信。</h3>'+(root?'<article><small>古根初醒</small><h4>它不是一开始就知道怎么勇敢。</h4><p>第三枚光芽回到根巢时，烁羽听见木纹里很轻的一声响。绿意越过旧枝，长成能遮住它的树荫。它终于明白：自己带回的不是更耀眼的光，而是让生命继续的机会。</p></article>':'')+entries.map(e=>'<article><small>'+e.place+'</small><h4>'+e.title+'</h4><p>'+e.text+'</p></article>').join('')+'<p class="v9-journey-notes-footer">这些回信来自你在林河中的行动。文物知识与考古依据请阅上方资料卡。</p></section>';
}
