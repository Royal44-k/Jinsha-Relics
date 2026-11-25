import {chapterIds,validTriptych,validFilm} from '../v10/ledger.js';
import {relics} from '../v11/collection-data.js';
import './field-triptych.css';

const headings=['读土地','看手艺','留现场'];
const evidence=[
  ['陶片的层位','取样针留下了砂与泥的交界。离土以后，口沿仍有来处。'],
  ['水里的漂木','同一截漂木，在主流与回湾走出了两种速度。水搬得动什么，也会改变河床留下什么。'],
  ['根盘的木纹','切片上的组织可以比对。仰头所见的整片绿荫，是从一段古根生出的想象。'],
  ['玉料的锯缝','绳子带着湿砂往复，留下窄窄的切面。这道教学锯痕记下了手的方向。'],
  ['陶片的断口','弧度相近的边缘还要试着合缝。两道断口严丝合缝时，器腹才有了连续的轮廓。'],
  ['铜鸟的支点','找到重心后，薄尾才卸下重量。今天托住器物的手，也参与了它的故事。'],
  ['象牙的叠压','上层与下层相接的地方拍进同一帧。保存一段关系，需要同时看见两件东西。'],
  ['金箔的留白','透过镂空的光勾出鸟的轮廓。转动灯位，金面与留白共同构成了这幅图。'],
  ['柱洞的间距','绳头落在相邻的洞心，柱网的尺度便能复核。曾经立在这里的屋顶，仍待更多证据。']
];
function el(tag,cls,text){
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text)node.textContent=text;
  return node;
}
function plate(index,photos){
  const item=relics.find(r=>r.id===chapterIds[index]);
  const picture=el('img');
  picture.draggable=false;
  const shot=index===6&&validFilm(photos)[0];
  picture.src=shot||'/assets/v11/collections/'+item.image+'.webp';
  picture.alt=shot?'本次旅程拍摄的象牙叠压底片':item.title+'的教学图版';
  return picture;
}
export function renderFieldTriptych(ids,photos=[]){
  if(!validTriptych(ids).length)return null;
  const work=el('figure','js-print-work');
  const caption=el('figcaption','js-print-title','九站接触印相');
  const frames=el('div','js-print-frames');
  ids.forEach((id,row)=>{
    const i=chapterIds.indexOf(id),frame=el('section','js-print-frame');
    frame.append(plate(i,photos),el('small','',headings[row]+'　'+String(i+1).padStart(2,'0')),
      el('h3','',evidence[i][0]),el('p','',evidence[i][1]));
    frames.append(frame);
  });
  work.append(caption,frames);
  return work;
}

// The three strips belong to today's museum. Each selection is a curatorial
// choice and all 27 combinations produce their own plate and caption.
export function mountPrintRoom(ctx,complete){
  const selection=validTriptych(ctx.options.fieldTriptych);
  const chosen=selection.length?selection.map(id=>chapterIds.indexOf(id)):[null,null,null];
  const room=el('section','js-print-room');
  room.setAttribute('aria-label','展厅印相台');
  ctx.section.classList.add('print-room-open');
  ctx.viewport.append(room);
  const clip=(n,min,max)=>Math.max(min,Math.min(max,n));
  let phase,exposure=0,finish,selectionLife;
  ctx.disposers.push(()=>selectionLife?.abort());
  function changePhase(name){
    selectionLife?.abort();selectionLife=new AbortController();
    phase=name;room.dataset.phase=name;room.replaceChildren();ctx.tools.replaceChildren();
  }
  function listen(node,event,run,options={}){
    node.addEventListener(event,run,{...options,signal:selectionLife.signal});
  }
  function tool(text,run,primary=false){
    const node=el('button','jss-action'+(primary?' jss-primary':''),text);
    node.type='button';listen(node,'click',run);ctx.tools.append(node);return node;
  }
  function sound(row,index){
    ctx.noteTone(row,[0,3,7][index%3],0,.45,[-.42,0,.42][row]);
  }
  function edit(){
    changePhase('choose');
    const strips=el('div','js-print-strips');
    const confirm=tool('把三幅排入印框',proof,true);
    function meter(){
      const total=chosen.filter(i=>i!==null).length;
      confirm.disabled=total!==3;
      ctx.read('展厅印相台　·　已入选 '+total+' / 3');
    }
    ctx.note('每条底片选一幅，组成你留给下一位观众的展签。可横拖挑片，也可点选或用方向键。');
    for(let row=0;row<3;row++){
      const group=el('fieldset','js-print-strip'),title=el('legend','',headings[row]),rail=el('div','js-print-rail');
      const note=el('p','js-strip-note');
      rail.setAttribute('role','radiogroup');rail.setAttribute('aria-label',headings[row]+'底片');
      const buttons=[];
      function showChoice(index,announce){
        chosen[row]=index;
        for(const [n,b] of buttons.entries()){
          const current=row*3+n===index;
          b.setAttribute('aria-checked',String(current));
          b.tabIndex=current?0:-1;
        }
        note.textContent=evidence[index][1];meter();
        if(announce)sound(row,index);
      }
      for(let n=0;n<3;n++){
        const index=row*3+n,b=el('button','js-print-specimen');
        b.type='button';b.dataset.print=chapterIds[index];b.setAttribute('role','radio');
        b.setAttribute('aria-label',evidence[index][0]);b.setAttribute('aria-checked','false');b.tabIndex=n===0?0:-1;
        b.append(plate(index,ctx.options.photos),el('span','',evidence[index][0]));buttons.push(b);rail.append(b);
        listen(b,'click',()=>{if(chosen[row]!==index)showChoice(index,true);});
        listen(b,'keydown',event=>{
          const jump={ArrowLeft:(n+2)%3,ArrowRight:(n+1)%3,Home:0,End:2}[event.key];
          if(jump===undefined)return;
          event.preventDefault();event.stopPropagation();buttons[jump].focus();showChoice(row*3+jump,true);
        });
      }
      let scrub=null;
      listen(rail,'pointerdown',e=>{if(e.button===0)scrub={id:e.pointerId,x:e.clientX,y:e.clientY,drag:false};});
      listen(rail,'pointermove',e=>{
        if(!scrub||e.pointerId!==scrub.id)return;
        const dx=Math.abs(e.clientX-scrub.x),dy=Math.abs(e.clientY-scrub.y);
        if(!scrub.drag&&dx>7&&dx>dy){scrub.drag=true;rail.setPointerCapture(e.pointerId);}
        if(!scrub.drag)return;
        const r=rail.getBoundingClientRect(),n=clip(Math.floor((e.clientX-r.left)*3/r.width),0,2);
        if(chosen[row]!==row*3+n)showChoice(row*3+n,true);
      });
      for(const event of ['pointerup','pointercancel'])listen(rail,event,()=>{scrub=null;});
      // A touch starts with implicit capture on the tile. Its lost-capture
      // event bubbles when the strip takes over the drag.
      listen(rail,'lostpointercapture',event=>{if(event.target===rail)scrub=null;});
      group.append(title,rail,note);strips.append(group);
      if(chosen[row]!==null)showChoice(chosen[row],false);
      else note.textContent=['从哪条痕迹读出旧河岸？','哪一种手势值得留下？','什么关系需要在原处记录？'][row];
    }
    room.append(strips);meter();(strips.querySelector('[aria-checked="true"]')||strips.querySelector('button')).focus({preventScroll:true});
  }
  function proof(){
    if(chosen.includes(null))return;
    changePhase('proof');exposure=0;
    const ids=chosen.map(i=>chapterIds[i]),paper=renderFieldTriptych(ids,ctx.options.photos);
    const shutter=el('div','js-print-shutter'),handle=el('button','js-print-handle','›');
    handle.type='button';handle.setAttribute('role','slider');handle.setAttribute('aria-label','从左向右推开印框遮板');
    handle.setAttribute('aria-valuemin','0');handle.setAttribute('aria-valuemax','100');
    shutter.append(handle);paper.append(shutter);room.append(paper);
    tool('重选底片',edit);
    finish=tool('完成探险，查看收获　→',()=>{if(phase==='printed')complete(ids);},true);
    finish.disabled=true;let lastBand=-1;
    function expose(value){
      exposure=clip(value,0,1);const percent=Math.round(exposure*100),band=Math.min(2,Math.floor(exposure*3));
      paper.style.setProperty('--open',percent+'%');handle.setAttribute('aria-valuenow',String(percent));
      handle.setAttribute('aria-valuetext','显影 '+percent+'%');
      ctx.read('接触印相　·　显影 '+percent+'%');
      if(exposure>0&&band!==lastBand){
        sound(band,chosen[band]);lastBand=band;
      }
      if(exposure>=.985&&phase==='proof'){
        phase='printed';room.dataset.phase=phase;shutter.hidden=true;finish.disabled=false;
        // Reprise the three chosen plate tones from left to right as one phrase.
        chosen.forEach((index,row)=>ctx.noteTone(row,[0,3,7][index%3],.20+row*.36,.42,[-.38,0,.38][row]));
        ctx.note('三幅印相已经显影。展签会收入这趟旅程，回到展厅时还能翻看。');
        ctx.read('印相完成　·　三幅现场展签');finish.focus({preventScroll:true});
      }
    }
    let drag=null;
    listen(handle,'pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,start:exposure};handle.setPointerCapture(e.pointerId);});
    listen(handle,'pointermove',e=>{
      if(phase!=='proof'||drag?.id!==e.pointerId)return;
      expose(drag.start+(e.clientX-drag.x)/Math.max(1,paper.clientWidth-handle.offsetWidth));
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])listen(handle,event,()=>{drag=null;});
    listen(handle,'keydown',e=>{
      if(phase!=='proof')return;
      const value={ArrowRight:exposure+.10,ArrowLeft:exposure-.10,Home:0,End:1}[e.key];
      if(value===undefined)return;
      e.preventDefault();e.stopPropagation();expose(value);
    });
    ctx.note('捏住印框左端的铜柄，向右推到底，依次显出三幅图版。键盘可用左右方向键或 End。');
    expose(0);handle.focus({preventScroll:true});
  }
  edit();
}
