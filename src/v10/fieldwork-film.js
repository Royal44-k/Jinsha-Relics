import {fieldTime,onFieldHoldChange,reviewPaused} from '../v13/review-clock.js';

const sequence='/assets/v10/fieldwork-autumnwood-growth.webm';
const canopy='/assets/v10/fieldwork-growth-crown.jpg';
const start='/assets/v10/fieldwork-growth-root.jpg';

// The survey camera is fixed for this shot. Low-end renderers play the same
// authored geometry from the offline camera track while the field notes stay live.
export function prepareCrownFilm(ctx,reduced){
  const video=document.createElement('video');video.muted=true;video.playsInline=true;
  video.preload='auto';video.disablePictureInPicture=true;video.setAttribute('aria-label','秋枫由原位树根生长至绿荫树冠的三维复原');
  const available=!reduced&&Boolean(video.canPlayType('video/webm; codecs="vp8"'));
  const playback=new AbortController();
  let cover=null,timer=null,stopped=false;
  if(available){video.poster=start;video.src=sequence;}
  function stop(){
    if(stopped)return;stopped=true;playback.abort();clearTimeout(timer);video.pause();video.removeAttribute('src');video.load();cover?.remove();
  }
  ctx.onClose(stop);
  return {
    stop,
    play(before,ready){
      if(stopped||cover)return;
      cover=document.createElement('div');cover.className='fw-crown-film';before.before(cover);
      cover.style.backgroundImage='url("'+canopy+'"),url("/assets/v10/fieldwork-autumnwood.webp")';
      const still=document.createElement('img');still.alt='教学复原的秋枫树冠';still.src=canopy;cover.append(still);
      ctx.on(still,'error',()=>still.remove());
      const deadline=fieldTime()+7000;
      let playAttempt=0,deferredMode='';
      function finish(mode){
        if(playback.signal.aborted||ctx.closed)return;
        if(reviewPaused()){deferredMode=mode;return;}
        playback.abort();clearTimeout(timer);
        ctx.section.dataset.crownMode=mode;video.hidden=true;video.pause();still.hidden=false;ready();
      }
      function syncPlayback(){
        const attempt=++playAttempt;
        clearTimeout(timer);
        if(reviewPaused()){video.pause();return;}
        if(deferredMode){finish(deferredMode);return;}
        if(!available||video.error){finish('still');return;}
        if(video.ended){finish('recorded');return;}
        // Give the decoder seven seconds in the field, excluding time in chapter review.
        timer=setTimeout(()=>finish(video.ended?'recorded':'still'),Math.max(0,deadline-fieldTime()));
        video.play().catch(()=>{
          // A hold can interrupt a play() request whose rejection arrives after resuming.
          if(attempt===playAttempt)finish('still');
        });
      }
      if(available){
        ctx.section.dataset.crownMode='recorded';still.hidden=true;cover.append(video);
        ctx.on(video,'ended',()=>finish('recorded'));ctx.on(video,'error',()=>finish('still'));
      }
      onFieldHoldChange(syncPlayback,playback.signal);
      syncPlayback();
    }
  };
}
