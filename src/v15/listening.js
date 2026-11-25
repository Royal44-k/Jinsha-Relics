import './listening.css';

const storageKey='jinsha-listening-mix-v15';
const notes={
  dialogue:'说话时，音乐、河声和动作声会轻轻退到后面。',
  balanced:'保留较多的河岸环境声和乐器声。',
  'voice-only':'仅播放调查旁白和烁羽对白。'
};
const names={narrator:'旁白',spirit:'烁羽'};

export function bindListeningRoom({audio,storage,roleLines,isMuted,toggleMute}){
  const room=document.getElementById('listening-room');
  const caption=room.querySelector('.listening-caption');
  const toggle=room.querySelector('.listening-mute');
  const radios=Array.from(room.querySelectorAll('input[name="sound-mix"]'));
  const previews=Array.from(room.querySelectorAll('[data-preview]'));
  let selection='dialogue',playing=null,ticket=0,opener=null;
  function setMix(value){
    selection=Object.hasOwn(notes,value)?value:'dialogue';
    audio.setMix(selection);
    for(const radio of radios)radio.checked=radio.value===selection;
    room.querySelector('.mix-note').textContent=notes[selection];
  }
  function readMix(){
    try{return storage?.getItem(storageKey)||'dialogue';}catch{return selection;}
  }
  setMix(readMix());
  window.addEventListener('storage',e=>{if(e.key===storageKey)setMix(e.newValue);});
  for(const radio of radios)radio.onchange=()=>{
    setMix(radio.value);
    try{storage?.setItem(storageKey,selection);}catch{}
  };
  function refresh(){
    toggle.textContent=isMuted()?'开启游戏声音':'静音';
    for(const button of previews){
      const role=button.dataset.preview,active=playing===role;
      button.setAttribute('aria-pressed',String(active));
      button.textContent=active?'停止'+names[role]:(isMuted()?'开启并试听':'试听')+names[role];
    }
  }
  function stop(){
    ticket++;
    if(playing)audio.stopSpeech();
    playing=null;refresh();
  }
  for(const button of previews)button.onclick=async()=>{
    const role=button.dataset.preview;
    if(playing===role){stop();return;}
    const request=++ticket;
    if(isMuted())toggleMute();
    playing=role;refresh();caption.textContent=names[role]+'　「'+roleLines[role]+'」';
    const unlocked=await audio.unlock();
    if(request!==ticket||!room.open)return;
    if(unlocked&&await audio.speak(roleLines[role],role))return;
    if(request!==ticket)return;
    stop();caption.textContent='这段声音暂时无法播放，请再试听一次。';
  };
  toggle.onclick=()=>{stop();toggleMute();refresh();caption.textContent=isMuted()?'游戏已静音。':'';};
  room.querySelector('.listening-close').onclick=()=>room.close();
  room.addEventListener('close',()=>{stop();if(opener?.isConnected)opener.focus({preventScroll:true});});
  return {
    open(){
      if(room.open)return;
      opener=document.activeElement;setMix(readMix());refresh();caption.textContent='';
      room.showModal();radios.find(radio=>radio.checked)?.focus({preventScroll:true});
    },
    finished(role){if(playing===role){playing=null;refresh();}}
  };
}
