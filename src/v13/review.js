import {relics} from '../v11/collection-data.js';
import {phases} from '../v10/ledger.js';

const activity={
  'river-trench':'湿筛取样，辨认陶口沿',
  paleochannel:'操舟过湾，测记漂木',
  'root-survey':'比对木材切片，辨认树种',
  'jade-cut':'蘸砂拉绳，验看玉料切面',
  'clay-fit':'量取口径，转动陶片合缝',
  'bronze-shadow':'找准支点，托起铜鸟薄尾',
  'ivory-record':'标定比例，拍下象牙叠压',
  sunfoil:'移动提灯，辨别金箔镂空',
  'nine-posts':'架设测绳，还原柱洞间距'
};
const $=id=>document.getElementById(id);
const element=(tag,text,cls)=>{
  const node=document.createElement(tag);
  if(text)node.textContent=text;
  if(cls)node.className=cls;
  return node;
};
export function reviewConnection(){
  const holder=window.frameElement;
  if(holder?.name!=='chapter-review')return null;
  const link=holder.jinshaReview;
  return link?.id===new URL(location.href).searchParams.get('review')?link:null;
}

export function makeReviewDesk({getRecord,siteName,locationLabel,hold,commit,journeyId}){
  const panel=$('review-panel'),stage=$('review-play'),loading=$('review-loading');
  let frame=null,source=null,origin='',activeId='',timeout=0;

  function rememberSource(){
    if(panel.open||stage.open)return;
    source=document.activeElement;origin=locationLabel();
    hold(true);
  }
  function release(){
    hold(false);
    if(source?.isConnected)source.focus({preventScroll:true});
    source=null;
  }
  function removeFrame(){
    clearTimeout(timeout);
    const old=frame;frame=null;activeId='';
    old?.jinshaReview.disposeChild?.();
    old?.remove();
  }
  function leave(){
    if(panel.open)panel.close();
    removeFrame();
    if(stage.open)stage.close();
    release();
  }
  function closeList(){
    if(!panel.open)return;
    panel.close();
    if(frame){
      frame.jinshaReview.pauseChild?.(false);
      frame.contentWindow?.focus();
    }else release();
  }
  function show(){
    if(panel.open)return;
    rememberSource();
    frame?.jinshaReview.pauseChild?.(true);
    const {completed,revisits}=getRecord(),list=$('review-list');
    list.replaceChildren();
    $('review-count').textContent='已归档 '+completed.length+' / '+relics.length;
    $('review-current').textContent='当前探索 · '+origin+'。回顾结束后，回到此处接着玩。';
    $('review-resume').textContent='返回 · '+origin;
    $('review-close').setAttribute('aria-label',frame?'合上目录，继续回顾'+siteName(activeId):'关闭章节选择');
    for(const [i,item] of relics.entries()){
      const known=completed.includes(item.id),next=i===completed.length;
      if(!known&&!next)break;
      const card=element('button',null,'review-route-card');
      card.type='button';card.disabled=!known;
      if(known){
        card.dataset.review=card.dataset.reviewId=card.dataset.replay=item.id;
        card.setAttribute('aria-label','回顾'+siteName(item.id)+'，'+activity[item.id]);
        card.onclick=()=>play(item.id);
      }
      const picture=element('img');picture.src='/assets/v11/collections/'+item.image+'.webp';picture.alt='';
      const copy=element('span');
      const visits=revisits[item.id]?' · 已回顾 '+revisits[item.id]+' 次':'';
      copy.append(element('small',phases[Math.floor(i/3)]+'　'+String(i+1).padStart(2,'0')+visits),element('strong',siteName(item.id)),
        element('em',known?activity[item.id]:'完成本章并归档，即可从这里回顾。'));
      card.append(picture,copy,element('span',known?'再玩一遍 ↗':'待归档','review-card-action'));
      list.append(card);
    }
    panel.showModal();
    (list.querySelector('button:enabled')||$('review-resume')).focus({preventScroll:true});
    list.scrollTop=0;
  }
  function play(id){
    if(!getRecord().completed.includes(id))return;
    rememberSource();
    if(panel.open)panel.close();
    removeFrame();
    const site=siteName(id);
    const player=document.createElement('iframe');
    frame=player;activeId=id;
    player.name='chapter-review';player.title='回顾 · '+site;player.allow='autoplay';player.inert=true;
    const fail=()=>{
      if(frame!==player)return;
      clearTimeout(timeout);loading.hidden=false;loading.setAttribute('aria-busy','false');
      $('review-loading-text').textContent=site+'暂未载入，可返回目录再试。';
      $('review-loading-back').focus({preventScroll:true});
    };
    player.jinshaReview={
      id,origin,journeyId,initialRecord:JSON.stringify({version:1,...getRecord()}),
      ready(){
        if(frame!==player)return;
        clearTimeout(timeout);loading.hidden=true;loading.setAttribute('aria-busy','false');
        player.inert=false;player.contentWindow?.focus();
      },
      fail,commit:(data,changed)=>frame===player?commit(data,changed):null,
      back:()=>{if(frame===player)leave();},
      choose:()=>{if(frame===player)show();},
      again:()=>{if(frame===player)play(id);}
    };
    loading.hidden=false;loading.setAttribute('aria-busy','true');
    $('review-loading-text').textContent='正在展开'+site+'…';
    if(!stage.open)stage.showModal();
    $('review-loading-back').focus({preventScroll:true});
    const address=new URL(location.href);
    address.searchParams.set('review',id);address.hash='';
    player.src=address.href;player.addEventListener('error',fail,{once:true});
    timeout=setTimeout(fail,45000);
    $('review-mount').replaceChildren(player);
  }
  function toDirectory(){
    removeFrame();
    // Keep the stage open until the picker is above it to retain the origin.
    show();stage.close();
  }
  $('review-close').onclick=closeList;
  $('review-resume').onclick=()=>{if(frame)leave();else closeList();};
  $('review-loading-back').onclick=toDirectory;
  panel.addEventListener('cancel',e=>{e.preventDefault();closeList();});
  stage.addEventListener('cancel',e=>{e.preventDefault();leave();});
  return {show,play,closeList,get selecting(){return panel.open;},get active(){return panel.open||stage.open;}};
}
