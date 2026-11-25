import voices from './survey-voices.json';

const library='/assets/v10/sound/';
const notes={flute:69,harp:62,bow:50,gong:60};
const fieldBeds={bank:'/assets/audio/v5-field-water.ogg',grove:'/assets/audio/v5-field-forest.ogg',embers:'/assets/audio/v5-field-fire.ogg'};
const clips=new Map(voices.map(v=>[v.role+'|'+v.text,v.id]));
const voiceFiles=new Set(voices.map(v=>v.id));
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));

// Durations are in subdivisions of the local meter. Silence and the change
// from compound time to 3+2 then slow duple are part of each place's identity.
const scores=[
  {meter:6,tick:.35,roots:[50,55,52,50],pluck:[0,4],turn:[0,7,12,9],
    tune:[[1,69,4.2],[7,67,2],[10,64,2.5],[14,62,4],[20,64,3.1]]},
  {meter:5,tick:.40,roots:[45,50,52,45],pluck:[0,2,3],turn:[0,7,12,4],
    tune:[[2,64,2],[6,69,2.5],[9,71,1.3],[12,67,2.2],[16,64,3]]},
  {meter:8,tick:.43,roots:[50,55,57,50],pluck:[0,3,6],turn:[0,12,7,14],
    tune:[[1,69,4.1],[7,74,4.1],[14,76,3.1],[20,71,2.6],[25,69,5]]}
];
const modeGain={title:.61,travel:1,activity:.56,receipt:.76,journal:.36,finale:1.12};
const listening={
  dialogue:{music:.78,fx:.75,musicUnder:.25,fxUnder:.43},
  balanced:{music:1,fx:.81,musicUnder:.36,fxUnder:.68},
  'voice-only':{music:0,fx:0,musicUnder:0,fxUnder:0}
};
const roleName=role=>['spirit','bird','shuoyu','烁羽','羽灵'].includes(role)?'spirit':'narrator';

export function createSurveyAudio({onSpeechStart,onSpeechEnd}={}){
  let context,input,music,effects,dialogue,limiter,noise,clock,beat=0,next=0,serial=0;
  let muted=false,destroyed=false,unlocked=false,pending=null,voiceNode=null,ducked=false;
  let profile='dialogue';
  let speaker='',speechMeter=null;const waveform=new Float32Array(256);
  let warningActive=false,warningTimer=0;
  let index=0,mode='title',phrase=0,airFile='',airNode=null,airGain=null,airToken=0;
  let locality='',proximity=0;
  const courtBeds=new Map();
  const cached=new Map(),requests=new Map(),active=new Map(),tokens=new Map();
  const downloads=new AbortController();
  const doc=globalThis.document;
  let reviewHold=false;
  const hidden=()=>reviewHold||doc?.visibilityState==='hidden';
  const audible=()=>context&&!destroyed&&!muted&&!hidden()&&context.state==='running';
  function volume(param,value,seconds=.1){
    const t=context.currentTime;
    if(!seconds){param.cancelScheduledValues(0);param.value=value;return;}
    if(param.cancelAndHoldAtTime)param.cancelAndHoldAtTime(t);
    else {param.cancelScheduledValues(t);param.setValueAtTime(Math.max(0,param.value),t);}
    param.linearRampToValueAtTime(value,t+seconds);
  }
  function musicLevel(seconds=.27){
    if(!music)return;
    const mix=listening[profile];
    volume(music.gain,(modeGain[mode]||.7)*mix.music*(ducked?mix.musicUnder:1)*(warningActive?.17:1),seconds);
    volume(effects.gain,mix.fx*(ducked?mix.fxUnder:1),seconds);
  }
  function setMix(value){
    if(destroyed||!Object.hasOwn(listening,value)||value===profile)return;
    profile=value;musicLevel(.09);
  }
  function stopGroup(group){
    for(const [node,entry] of active){
      if(entry.group===group)try{node.stop();}catch{}
    }
  }
  function release(node){
    const e=active.get(node);if(!e)return;
    active.delete(node);
    for(const n of [node,...e.chain])n.disconnect();
  }
  function track(node,chain,group,start,end,onEnd){
    node.onended=()=>{release(node);onEnd?.();};
    active.set(node,{chain,group});node.start(start);node.stop(end+.012);
  }
  function envelope(start,end,level,attack,release,destination,pan=0){
    const env=context.createGain(),balance=context.createStereoPanner();
    const duration=Math.max(.035,end-start),onset=Math.min(attack,duration*.36),tail=Math.min(release,duration*.55);
    env.gain.setValueAtTime(.00001,start);env.gain.linearRampToValueAtTime(Math.max(.00002,level),start+onset);
    env.gain.setValueAtTime(Math.max(.00002,level),Math.max(start+onset,end-tail));
    env.gain.exponentialRampToValueAtTime(.00001,end);
    balance.pan.value=pan;env.connect(balance);balance.connect(destination);
    return [env,balance];
  }
  async function buffer(name){
    if(!context||destroyed)return null;
    if(cached.has(name))return cached.get(name);
    if(requests.has(name))return requests.get(name);
    const task=(async()=>{
      try{
        const url=voiceFiles.has(name)?'/assets/v15/voices/'+name+'.wav':fieldBeds[name]||library+name+'.ogg';
        const file=await fetch(url,{signal:downloads.signal});
        if(!file.ok)throw Error(String(file.status));
        const bytes=await file.arrayBuffer();if(destroyed)return null;
        const data=await context.decodeAudioData(bytes);if(destroyed)return null;
        // Long voice lines are fetched on demand. Keep the four instruments and
        // a small replay window rather than retaining the entire expedition.
        if(!(name in notes)&&!(name in fieldBeds)){
          const speechFiles=[...cached.keys()].filter(key=>!(key in notes)&&!(key in fieldBeds));
          if(speechFiles.length>=4)cached.delete(speechFiles[0]);
        }
        cached.set(name,data);return data;
      }catch{return null;}
      finally{requests.delete(name);}
    })();
    requests.set(name,task);return task;
  }
  function tone(frequency,start,duration,level,pan=0,type='sine',decay=1,bus=effects,group='fx'){
    const osc=context.createOscillator(),end=start+duration,chain=envelope(start,end,level,.009,duration*.82,bus,pan);
    osc.type=type;osc.frequency.setValueAtTime(frequency,start);
    if(decay!==1)osc.frequency.exponentialRampToValueAtTime(frequency*decay,end);
    osc.connect(chain[0]);track(osc,chain,group,start,end);
  }
  function noiseBurst(start,duration,level,hz,q=1,pan=0,glide=.55,bus=effects,group='fx',attack=.014){
    const n=context.createBufferSource(),f=context.createBiquadFilter(),end=start+duration;
    n.buffer=noise;n.loop=true;f.type='bandpass';f.Q.value=q;
    f.frequency.setValueAtTime(hz,start);f.frequency.exponentialRampToValueAtTime(hz*glide,end);
    const chain=envelope(start,end,level,attack,duration*.65,bus,pan);n.connect(f);f.connect(chain[0]);track(n,[f,...chain],group,start,end);
  }
  function riverBedLevel(){
    const base=mode==='activity'?.18:mode==='journal'?.13:mode==='title'?.20:.36;
    return base*(1-.66*proximity);
  }
  function mixLocality(silence=false){
    if(!context)return;
    if(airGain&&!silence)volume(airGain.gain,riverBedLevel(),.75);
    for(const [name,bed] of courtBeds){
      volume(bed.bus.gain,!silence&&name===locality?proximity:0,silence?0:.78);
      if(silence){stopGroup(name);bed.next=0;}
    }
  }
  function setLocality(name,amount=1){
    const value=mode==='travel'&&['west-court','flotation'].includes(name)&&Number.isFinite(amount)?clamp(amount,0,1):0;
    const place=value>0?name:'';
    if(destroyed||place===locality&&(value===proximity||Math.abs(value-proximity)<.025&&value!==1))return;
    locality=place;proximity=value;
    if(audible())mixLocality();
  }
  function soundLocality(){
    if(!locality||!proximity||mode!=='travel')return;
    let bed=courtBeds.get(locality);
    if(!bed){
      const bus=context.createGain();bus.gain.value=0;bus.connect(music);
      bed={bus,next:0,pass:0};courtBeds.set(locality,bed);volume(bus.gain,proximity,.78);
    }
    const t=context.currentTime+.025;
    if(t<bed.next)return;
    const pass=bed.pass++,sway=[-.58,.31,-.18,.62,.12,-.35,.47][pass%7],bus=bed.bus;
    if(locality==='west-court'){
      // Unmetered reed heads catch the wind twice, then rest. Contact with the
      // timber frame and earthenware is sparse, below the dialogue bus.
      noiseBurst(t,1.46,.19,1750+190*sway,.95,sway,.65,bus,locality,.28);
      noiseBurst(t+.42,1.05,.11,2910,1.3,-sway,.70,bus,locality,.25);
      if(pass%3===1){
        tone(218,t+.62,.17,.048,.48,'sine',.81,bus,locality);
        tone(548,t+.63,.12,.021,.48,'sine',.86,bus,locality);
      }else if(pass%5===3){
        tone(703,t+.16,.38,.027,-.46,'sine',.995,bus,locality);
        tone(1175,t+.17,.22,.012,-.46,'sine',.99,bus,locality);
      }
      bed.next=t+[2.71,4.15,3.36,5.17,3.83][pass%5];
    }else{
      // Bucket seep and a nearly dry mesh. The player's own scoop remains foreground.
      noiseBurst(t,1.08,.125,890,.72,-.23,.52,bus,locality,.19);
      tone(482,t+.16,.12,.031,.27,'sine',.62,bus,locality);
      if(pass%3===1){
        noiseBurst(t+.31,.22,.071,2480,1.15,.34,.63,bus,locality,.028);
        noiseBurst(t+.62,.15,.049,2960,1.6,.29,.65,bus,locality,.020);
      }
      bed.next=t+[2.35,3.48,2.91,4.13][pass%4];
    }
  }
  function playSample(kind,pitch,start,duration,level,pan,bus=music,group='score'){
    const data=cached.get(kind),rate=2**((pitch-notes[kind])/12);
    if(!data){
      // One subdued pluck can introduce the scene during the first decode.
      if(kind==='harp')tone(440*2**((pitch-69)/12),start,.49,level*.35,pan,'sine',1,bus,group);
      return;
    }
    const source=context.createBufferSource(),held=kind==='flute'||kind==='bow';
    const d=Math.min(duration,data.duration/rate-.015);if(d<.025)return;
    source.buffer=data;source.playbackRate.value=rate;
    const end=start+d,chain=envelope(start,end,level,held?.16:.008,held?.40:.60,bus,pan);
    source.connect(chain[0]);track(source,chain,group,start,end);
  }
  function scoreBeat(){
    if(!audible())return;
    soundLocality();
    const part=mode==='finale'?2:Math.floor(index/3),score=scores[part],total=score.meter*4;
    const tick=score.tick*(mode==='title'?1.2:mode==='journal'?1.18:1);
    if(next<context.currentTime-.35)next=context.currentTime+.025;
    while(next<context.currentTime+.23){
      const at=beat%total,bar=Math.floor(at/score.meter),sub=at%score.meter;
      const root=score.roots[(bar+(phrase%2?1:0))%4];
      if(!sub&&bar%2===0)playSample('bow',root,next,tick*(score.meter*1.65),.109,-.20);
      const location=index%3,stroke=score.pluck.indexOf(sub);
      if(stroke>=0 && (mode!=='journal'||stroke===0)){
        const interval=score.turn[(bar+stroke+location)%score.turn.length];
        playSample('harp',root+12+interval,next+.018,tick*3.2,.115+(stroke===0?.025:0),stroke%2?.30:-.26);
      }
      const melody=score.tune.find(event=>event[0]===at);
      if(melody&&mode!=='journal'&&!(mode==='activity'&&bar%2===1)){
        const ornament=phrase%3===2&&bar===2?2:0;
        playSample('flute',melody[1]+ornament,next+.045,melody[2]*tick,.135,.18);
      }
      if(part===2&&at===0&&mode!=='activity')playSample('gong',mode==='finale'?57:61,next,3.2,.13,-.08);
      if(mode==='finale'&&sub===score.meter-2)playSample('harp',root+24,next,tick*3.6,.12,.48);
      if(mode==='finale'&&sub===0&&bar%2===0)playSample('bow',root+7,next+.18,tick*7.5,.13,-.22);
      if(mode==='activity'&&index===8&&sub===0)playSample('harp',bar%2?64:57,next,tick*4,.07,.35);
      beat++;next+=tick;
      if(beat%total===0)phrase++;
    }
  }
  function startClock(){
    if(clock||!audible())return;
    next=context.currentTime+.025;scoreBeat();clock=setInterval(scoreBeat,85);
  }
  function stopAtmosphere(immediate=false){
    airToken++;airFile='';
    if(!airNode)return;
    const previous=airNode;
    if(immediate){try{previous.stop();}catch{}}
    else{volume(airGain.gain,0,.42);try{previous.stop(context.currentTime+.46);}catch{}}
    airNode=null;airGain=null;
  }
  async function atmosphere(){
    if(!audible())return;
    const quiet=mode==='activity'&&index===8;
    const name=quiet?'':(mode==='finale'?'bank':['bank','bank','grove','grove','embers','embers','bank','grove','grove'][index]);
    const level=riverBedLevel();
    if(name===airFile){if(airGain)volume(airGain.gain,level,.55);return;}
    stopAtmosphere(quiet);if(!name)return;
    airFile=name;const id=airToken,data=await buffer(name);
    if(id!==airToken||!audible()||!data){if(id===airToken)airFile='';return;}
    const source=context.createBufferSource(),gain=context.createGain(),t=context.currentTime;
    source.buffer=data;source.loop=true;gain.gain.value=0;source.connect(gain);gain.connect(music);
    source.onended=()=>release(source);active.set(source,{chain:[gain],group:'atmosphere'});
    source.start(t+.01,index*.37%data.duration);
    airNode=source;airGain=gain;volume(gain.gain,level,.75);
  }
  function stopClock(){if(clock){clearInterval(clock);clock=null;}stopGroup('score');}
  function fadeVoice(){
    if(voiceNode){
      const fading=voiceNode;voiceNode=null;
      const gain=active.get(fading)?.chain[0]?.gain;
      if(gain&&context?.state==='running'){
        volume(gain,0,.042);
        try{fading.stop(context.currentTime+.045);}catch{}
      }else try{fading.stop();}catch{}
    }
  }
  function stopSpeech(){
    serial++;pending=null;speaker='';fadeVoice();
    ducked=false;musicLevel(.18);
  }
  function finishSpeech(source){
    if(source!==voiceNode)return;
    const role=speaker;
    voiceNode=null;speaker='';ducked=false;musicLevel(.46);
    onSpeechEnd?.(role);
  }
  async function speak(text,role='narrator'){
    if(typeof text!=='string'||!text.trim()||destroyed||muted||hidden())return false;
    role=roleName(role);text=text.trim();
    const clip=clips.get(role+'|'+text);if(!clip)return false;
    const id=++serial;pending=null;
    if(!audible()){pending=[text,role];return false;}
    const data=await buffer(clip);
    if(id!==serial||!data||muted||destroyed)return false;
    // The player can open a chapter sheet while the WAV is still decoding.
    if(!audible()){pending=[text,role];return false;}
    const start=context.currentTime+(voiceNode ? .046 : .016),end=start+data.duration;
    const source=context.createBufferSource(),gain=context.createGain();
    fadeVoice();source.buffer=data;
    // Leave the original recording's envelope intact up to the final few
    // milliseconds. A mono recording reaches both channels through the dialogue bus.
    gain.gain.setValueAtTime(0,start);
    gain.gain.linearRampToValueAtTime(.79,start+Math.min(.004,data.duration/3));
    gain.gain.setValueAtTime(.79,end-Math.min(.007,data.duration/3));
    gain.gain.linearRampToValueAtTime(0,end);
    source.connect(gain);gain.connect(dialogue);voiceNode=source;speaker=role;ducked=true;musicLevel(.075);
    track(source,[gain],'speech',start,end,()=>finishSpeech(source));
    onSpeechStart?.(text,role,data.duration);return true;
  }
  function build(){
    const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return false;
    context=new Audio({latencyHint:'interactive'});input=context.createGain();music=context.createGain();effects=context.createGain();dialogue=context.createGain();limiter=context.createDynamicsCompressor();
    limiter.threshold.value=-3;limiter.knee.value=2;limiter.ratio.value=12;limiter.attack.value=.003;limiter.release.value=.12;
    speechMeter=context.createAnalyser();speechMeter.fftSize=waveform.length;
    music.connect(input);effects.connect(input);dialogue.connect(speechMeter);speechMeter.connect(input);input.connect(limiter);limiter.connect(context.destination);
    input.gain.value=muted?0:.85;musicLevel(0);
    noise=context.createBuffer(1,Math.round(context.sampleRate*.5),context.sampleRate);
    const a=noise.getChannelData(0);let seed=523;
    for(let i=0;i<a.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;a[i]=seed/2147483648-1;}
    return true;
  }
  async function unlock(){
    if(destroyed)return false;
    try{
      unlocked=true;
      if(muted||hidden())return false;
      if(!context&&!build())return false;
      await context.resume();if(!audible())return false;
      if(input.gain.value!==.85)volume(input.gain,.85,.045);
      for(const kind of Object.keys(notes))void buffer(kind);
      mixLocality();startClock();void atmosphere();
      if(pending){const args=pending;pending=null;void speak(...args);}return true;
    }catch{return false;}
  }
  function setMuted(value){
    if(destroyed)return;
    muted=!!value;
    if(context)volume(input.gain,muted?0:.85,muted?0:.055);
    if(muted){mixLocality(true);stopSpeech();stopClock();stopAtmosphere(true);stopGroup('fx');if(context)void context.suspend().catch(()=>{});}
    else if(unlocked&&!hidden())void unlock();
  }
  function setScene(value,nextMode){
    if(destroyed)return;
    const i=clamp(Math.floor(Number(value)||0),0,8),m=Object.hasOwn(modeGain,nextMode)?nextMode:'travel';
    if(index===i&&mode===m)return;
    const phraseChange=Math.floor(index/3)!==Math.floor(i/3)||m==='finale'||mode==='title';
    const sameNotebook=i===index&&[mode,m].every(scene=>scene==='travel'||scene==='journal');
    const sameReceipt=i===index&&mode==='activity'&&m==='receipt';
    if(!sameNotebook&&!sameReceipt)stopSpeech();
    index=i;mode=m;
    if(m!=='travel'){locality='';proximity=0;mixLocality(true);}
    // Reset the downbeat when the measured baseline becomes the final horizon.
    if(phraseChange||(index===8&&mode==='activity')){stopClock();beat=phrase=0;startClock();}
    musicLevel(.45);void atmosphere();
  }
  function cue(name,strength=1){
    if(!audible()||profile==='voice-only'||typeof name!=='string')return false;
    const t=context.currentTime+.004,g=clamp(Number(strength)||0,0,1.5);if(!g)return false;
    const previous=tokens.get(name)??-2;if(t-previous<.047)return false;tokens.set(name,t);
    const n=(d,l,h,q=1,p=0,shift=.55,delay=0)=>noiseBurst(t+delay,d,l*g,h,q,p,shift);
    const h=(freq,d,l,pan=0,drop=1,delay=0)=>tone(freq,t+delay,d,l*g,pan,'sine',drop);
    switch(name){
      case 'jade-scrape':n(.26,.42,2180,2.5,-.12,.72);n(.17,.21,5750,1.7,.14,.56,.025);break;
      case 'water-drop':h(480,.17,.21,-.12,2.1);h(720,.11,.12,.15,1.45,.12);n(.15,.22,1350);break;
      case 'clay-turn':n(.13,.31,910,1.5,-.09,.67);h(208,.09,.056,.04,.94);break;
      case 'clay-fit':h(392,.20,.18,-.12,.98);h(714,.12,.089,.15,.94,.012);n(.05,.14,2300);break;
      case 'bronze-turn':n(.18,.20,702,2,0,.88);h(327,.16,.065,.11,.99);break;
      case 'bronze-register':h(587,.64,.14,-.17);h(942,.40,.08,.13);h(1404,.23,.045,.03);break;
      case 'screen-wash':
        n(.31,.26,1060,.83,-.22,1.47);n(.21,.19,2920,1.21,.24,.63,.075);
        h(645,.068,.052,.11,.84,.044);h(472,.072,.032,-.10,.78,.123);break;
      case 'slide-click':
        n(.045,.14,3200,2.3,.07,.52);h(1760,.075,.049,-.09,.99);
        h(2574,.054,.023,.14,1,.014);break;
      case 'canopy-rise':
        n(1.5,.20,720,.82,-.36,2.4);n(1.62,.13,1380,1.27,.38,1.6,.74);
        playSample('flute',69,t+.27,1.53,.14*g,-.28,effects,'fx');
        playSample('flute',76,t+1.08,1.89,.11*g,.23,effects,'fx');break;
      case 'brush':n(.24,.36,2230,1.9,-.12,.68);break;
      case 'paddle':case 'water':case 'splash':n(.37,.51,770,1.2,.22,.48);h(162,.16,.06,0,.6);break;
      case 'eddy-warn-left':case 'eddy-warn-right':{
        const side=name==='eddy-warn-left' ? -.91 : .91;
        warningActive=true;clearTimeout(warningTimer);musicLevel(.027);
        warningTimer=setTimeout(()=>{warningActive=false;if(audible())musicLevel(.36);},680);
        // The oncoming current starts outboard and curls towards the raft.
        n(.47,.48,390,1.1,side,2.7);n(.28,.24,840,1.5,side*.74,2.2,.16);
        h(112,.33,.095,side,.78);break;
      }
      case 'eddy-hit':
        h(107,.22,.19,0,.49);n(.32,.52,690,.79,0,.43);n(.25,.19,1580,.94,.26,.48,.09);break;
      case 'eddy-open':
        h(346,.14,.13,-.12,1.42);h(505,.18,.12,.16,1.27,.14);n(.21,.14,1420,2.7,.12,1.38,.09);break;
      case 'eddy-strike':
        h(170,.11,.18,0,.70);n(.16,.62,1180,.91,-.22,.64);
        n(.34,.39,2310,1.2,.36,.34,.055);h(455,.22,.085,.08,1.13,.13);break;
      case 'dive':n(.62,.50,1100,1.7,-.1,.16);h(210,.32,.11,-.12,.42);break;
      case 'surface':n(.39,.47,410,1.6,.12,3.2);h(440,.13,.07,.2,1.25,.13);break;
      case 'rope':n(.17,.33,1350,2.8,.10,.36);h(204,.085,.055,0,.83);break;
      case 'step':case 'walk':case 'land':case 'perch':n(.10,.36,760,1,-.08,.46);h(92,.10,.095,0,.70);break;
      case 'flap':case 'wing':case 'fly':case 'jump':case 'dash':case 'takeoff':case 'cruise-start':n(.28,.34,1030,.8,-.18,2.1);break;
      case 'cruise-end':case 'perch-approach':n(.29,.27,1050,.94,.13,.41);break;
      case 'boundary':case 'obstacle':case 'fatigue':case 'oxygen':h(186,.24,.075);n(.18,.18,390);break;
      case 'measure':case 'mark':h(494,.16,.11,-.12);h(740,.26,.09,.12,1,.075);break;
      case 'plumage':
        n(.37,.19,1490,1.15,-.3,2.3);[69,76,78].forEach((m,i)=>playSample('flute',m,t+.12*i,.58,.14*g,i*.2-.18,effects,'fx'));break;
      case 'discovery':
        n(.24,.17,980,1.6,.28,.49);[62,66,69,74].forEach((m,i)=>playSample('harp',m,t+i*.11,1.25,.14*g,i*.13-.25,effects,'fx'));break;
      case 'solstice':
        playSample('gong',56,t,3.4,.3*g,-.12,effects,'fx');
        [62,69,74,81].forEach((m,i)=>playSample('harp',m,t+.18+i*.28,2.9,.16*g,i*.16-.27,effects,'fx'));break;
      case 'arrive':playSample('harp',62,t,1.25,.17*g,-.17,effects,'fx');h(740,.23,.045,.14,1,.16);break;
      case 'reward':case 'receipt':case 'complete':case 'seal':case 'record':case 'reveal':
        [62,69,74].forEach((m,i)=>playSample('harp',m,t+.105*i,1.9,.20*g,i*.16-.18,effects,'fx'));break;
      default:h(341,.105,.073,0,.92);n(.065,.10,1550);break;
    }
    return true;
  }
  function visibility(){
    if(hidden()){
      mixLocality(true);
      // Suspending the context retains the narrator's sample position.
      stopClock();stopAtmosphere(true);stopGroup('fx');
      if(context){volume(input.gain,0,0);void context.suspend().catch(()=>{});}
    }else if(unlocked&&!muted){if(context)volume(input.gain,.85,.055);void unlock();}
  }
  doc?.addEventListener('visibilitychange',visibility);
  function destroy(){
    if(destroyed)return;
    destroyed=true;clearTimeout(warningTimer);downloads.abort();stopSpeech();stopClock();stopAtmosphere(true);stopGroup('fx');
    doc?.removeEventListener('visibilitychange',visibility);
    for(const [node] of active){node.onended=null;try{node.stop();}catch{}release(node);}
    for(const bus of [music,effects,dialogue,speechMeter,input,limiter])bus?.disconnect();
    if(context&&context.state!=='closed')void context.close().catch(()=>{});
    for(const bed of courtBeds.values())bed.bus.disconnect();
    courtBeds.clear();cached.clear();requests.clear();tokens.clear();noise=null;
  }
  function birdSpeech(){
    if(speaker!=='spirit'||muted||!ducked)return null;
    if(!voiceNode||!speechMeter)return {speaking:true};
    speechMeter.getFloatTimeDomainData(waveform);
    let energy=0;for(const sample of waveform)energy+=sample*sample;
    return {speaking:true,speechLevel:clamp(Math.sqrt(energy/waveform.length)*4.8,0,1)};
  }
  function pauseForReview(value){
    reviewHold=value;
    if(value){mixLocality(true);if(context?.state==='running')context.suspend().catch(()=>{});}
    else if(unlocked&&!muted&&!destroyed)void unlock();
  }
  return {unlock,setMuted,setMix,pauseForReview,setScene,setLocality,cue,speak,stopSpeech,birdSpeech,destroy,get context(){return context||null;},get destination(){return input||null;},get effectsDestination(){return effects||null;}};
}
