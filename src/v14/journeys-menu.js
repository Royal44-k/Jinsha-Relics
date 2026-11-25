const names=['滨河探方','古河道渡口','古木鉴定台','滨岸治玉作坊','陶作修复架','铜鸟支护台','滨河象牙埋藏区','金箔光学工位','滨河建筑基址'];
const formatDate=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
const $=id=>document.getElementById(id);
const label=n=>'旅程 '+String(n+1).padStart(2,'0');

function destination(record){
  if(!record.started)return '序章 · 木柱消失之后';
  if(record.ending)return '冬至之后 · 自由踏查';
  return names[record.completed.length]??'终章 · 冬至候日';
}

export function bindJourneyMenu({book,id,getCurrent,enter,finishSaves}){
  const panel=$('journey-panel'),list=$('journey-list'),library=$('journey-library');
  let switching=false;
  async function open(selected){
    if(switching)return;
    if(selected===id){
      if(panel.open)panel.close();
      enter();return;
    }
    switching=true;
    const fromDirectory=panel.open;
    let navigating=false;
    const primary=[$('enter'),$('new-journey'),library];
    primary.forEach(button=>{button.disabled=true;});
    try{
      if(!await finishSaves()){
        if(panel.open)panel.close();
        $('boot-state').textContent='当前旅程尚未保存。请检查浏览器存储空间后再切换。';
        return;
      }
      if(fromDirectory&&!panel.open)return;
      if(selected)book.select(selected);
      else selected=book.create(getCurrent());
      // The old document releases its WebGL assets after outstanding saves finish.
      const url=new URL(location.href);
      url.searchParams.delete('review');
      url.searchParams.set('journey',selected);
      url.searchParams.set('embark','1');
      location.replace(url);navigating=true;
    }catch{
      if(panel.open)panel.close();
      $('boot-state').textContent='暂未能打开旅程。请检查浏览器是否允许此网站保存数据。';
    }finally{
      if(!navigating){switching=false;primary.forEach(button=>{button.disabled=false;});}
    }
  }
  function refresh(){
    const slots=book.list(),record=getCurrent(),legacy=book.legacy();
    const entryNote=(slot,save)=>slot==='first'&&!save.started&&legacy.completed.length?'可承接旧版 '+legacy.completed.length+' 站':save.completed.length+' / 9 已归档';
    const current=slots.findIndex(slot=>slot.id===id);
    const available=record.started||slots.length>1||legacy.started;
    $('new-journey').hidden=library.hidden=$('journey-current').hidden=!available;
    if(!available)return;
    $('journey-current').textContent=label(Math.max(0,current))+'　·　'+destination(record)+'　·　'+entryNote(id,record);
    if(!panel.open)return;
    const focused=document.activeElement?.dataset.journey;
    list.replaceChildren();
    slots.forEach((slot,i)=>{
      const here=slot.id===id,save=here?record:book.load(slot.id);
      const card=document.createElement('button');card.type='button';
      card.className='journey-card';card.dataset.journey=slot.id;
      if(here)card.setAttribute('aria-current','true');
      const name=document.createElement('small'),place=document.createElement('strong'),detail=document.createElement('span');
      name.textContent=label(i)+(here?'　当前旅程':'');
      place.textContent=destination(save);
      detail.textContent=entryNote(slot.id,save)+'　·　'+(slot.created?formatDate.format(slot.created):'最初的旅程');
      card.append(name,place,detail);card.onclick=()=>open(slot.id);list.append(card);
      if(focused===slot.id)card.focus({preventScroll:true});
    });
  }
  $('new-journey').onclick=()=>open();
  library.onclick=()=>{
    panel.showModal();refresh();
    (list.querySelector('[aria-current="true"]')||$('journey-close')).focus({preventScroll:true});
  };
  $('journey-close').onclick=()=>panel.close();
  panel.addEventListener('close',()=>library.focus({preventScroll:true}));
  // Changes in another tab can create a journey or advance its checkpoint.
  window.addEventListener('storage',event=>{
    if(document.body.dataset.mode==='title'||panel.open||!document.body.dataset.mode){
      if(event.key===null||event.key.startsWith('jinsha-')||event.key.startsWith('jinsha-trip.'))refresh();
    }
  });
  refresh();return refresh;
}
