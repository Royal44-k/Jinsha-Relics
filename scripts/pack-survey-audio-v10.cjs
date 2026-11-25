const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {chromium}=require('playwright'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'public/assets/v10/sound');
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'jinsha-audio-'));

function lines(story){
  const entries=[
    {id:'intro-n',role:'narrator',text:story.narratorIntro},
    {id:'intro-s',role:'spirit',text:story.firstWords},
    {id:'finale-n',role:'narrator',text:story.endingWords}
  ];
  const modules=['fieldwork','workshops','sanctuary'];
  const prologues=modules.flatMap(file=>Array.from(fs.readFileSync(path.join(root,'src/v10',file+'.js'),'utf8').matchAll(/prologue:\s*'([^']+)'/g),m=>m[1]));
  if(prologues.length!==9)throw Error('Expected nine site prologues');
  prologues.forEach((text,i)=>entries.push({id:'site-'+(i+1),role:'narrator',text}));
  return entries;
}

function oggPage(packets,flags,granule,sequence){
  const laces=[];
  for(const packet of packets){let n=packet.length;while(n>=255){laces.push(255);n-=255;}laces.push(n);}
  const header=Buffer.alloc(27+laces.length);header.write('OggS');header[5]=flags;
  header.writeBigUInt64LE(BigInt(granule),6);header.writeUInt32LE(0x534a3130,14);header.writeUInt32LE(sequence,18);header[26]=laces.length;Buffer.from(laces).copy(header,27);
  const page=Buffer.concat([header,...packets]);let crc=0;
  for(const byte of page){
    crc^=byte<<24;
    for(let k=0;k<8;k++)crc=(crc<<1)^((crc>>>31)*0x04c11db7);
  }
  page.writeUInt32LE(crc>>>0,22);return page;
}

async function encodeInBrowser({name,duration,bitrate,normalize}){
  const src=new AudioContext({sampleRate:48000});
  const original=await src.decodeAudioData(await (await fetch('/wave/'+name)).arrayBuffer());
  const channels=original.numberOfChannels,rate=original.sampleRate;
  let peak=0;
  for(let c=0;c<channels;c++){
    const data=original.getChannelData(c);
    for(let i=0;i<data.length;i++)peak=Math.max(peak,Math.abs(data[i]));
  }
  if(peak<.005)throw Error(name+' has no usable signal');
  let first=0,last=original.length-1;
  const threshold=peak*(normalize?.006:.002);
  const plane=original.getChannelData(0);
  while(first<last&&Math.abs(plane[first])<threshold)first++;
  while(last>first&&Math.abs(plane[last])<threshold)last--;
  first=Math.max(0,first-Math.floor(rate*.055));last=Math.min(original.length,last+Math.ceil(rate*.13));
  const frames=Math.min(last-first,Math.round(duration*rate)),gain=(normalize?.74:.88)/peak;
  const packets=[];let head;
  const encoder=new AudioEncoder({
    output:(chunk,meta)=>{const bytes=new Uint8Array(chunk.byteLength);chunk.copyTo(bytes);packets.push(Array.from(bytes));
      if(meta?.decoderConfig?.description)head=Array.from(new Uint8Array(meta.decoderConfig.description));},
    error:e=>{throw e;}
  });
  encoder.configure({codec:'opus',sampleRate:rate,numberOfChannels:channels,bitrate});
  for(let at=0;at<frames;at+=960){
    const n=Math.min(960,frames-at),block=new Float32Array(n*channels);
    for(let j=0;j<n;j++){
      const t=at+j,fade=Math.min(1,(frames-t)/(rate*(normalize?.14:.025)),t/(rate*.004));
      for(let c=0;c<channels;c++)block[j*channels+c]=original.getChannelData(c)[first+t]*gain*fade;
    }
    const audio=new AudioData({format:'f32',sampleRate:rate,numberOfFrames:n,numberOfChannels:channels,timestamp:Math.round(at/rate*1e6),data:block});
    encoder.encode(audio);audio.close();
    while(encoder.encodeQueueSize>160)await new Promise(r=>setTimeout(r,1));
  }
  await encoder.flush();encoder.close();await src.close();
  return {head,packets,frames,rate,channels};
}

async function main(){
  fs.mkdirSync(out,{recursive:true});
  const entries=lines(await import('../src/v11/story.js')),{travelLines}=await import('../src/v10/ledger.js');
  travelLines.forEach((text,i)=>entries.push({id:'travel-'+(i+1),role:'spirit',text}));
  const manifest=path.join(root,'src/v10/survey-voices.json');
  fs.writeFileSync(manifest,JSON.stringify(entries,null,2)+'\n');
  execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'render-survey-speech-v10.ps1'),'-Manifest',manifest,'-OutputFolder',stage],{stdio:'inherit'});
  const instrumentRoot=path.join(__dirname,'audio-source/v6');
  const sources=new Map(entries.map(v=>[v.id,{file:path.join(stage,v.id+'.wav'),duration:60,bitrate:48000,normalize:false}]));
  for(const [name,src,duration] of [['flute','flute-a',4.8],['harp','harp-d',4.8],['bow','cello-d',5.5],['gong','gong',3.9]]){
    sources.set(name,{file:path.join(instrumentRoot,src+'.wav'),duration,bitrate:80000,normalize:true});
  }
  const server=http.createServer((req,res)=>{
    if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<title>Jinsha audio build</title>');return;}
    const file=sources.get(req.url.replace('/wave/',''))?.file;
    if(!file){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':'audio/wav'});fs.createReadStream(file).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.WORKSHOP_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
    const pg=await browser.newPage();await pg.goto('http://127.0.0.1:'+server.address().port);
    for(const [name,opts] of sources){
      const b=await pg.evaluate(encodeInBrowser,{...opts,name});
      const head=Buffer.from(b.head),preskip=head.readUInt16LE(10),vendor=Buffer.from('Jinsha river survey'),tags=Buffer.alloc(16+vendor.length);
      tags.write('OpusTags');tags.writeUInt32LE(vendor.length,8);vendor.copy(tags,12);
      const pages=[oggPage([head],2,0,0),oggPage([tags],0,0,1)];
      for(let i=0;i<b.packets.length;i+=20){
        const part=b.packets.slice(i,i+20).map(a=>Buffer.from(a)),last=i+part.length===b.packets.length;
        pages.push(oggPage(part,last?4:0,last?b.frames+preskip:(i+part.length)*960,pages.length));
      }
      const dest=path.join(out,name+'.ogg');fs.writeFileSync(dest,Buffer.concat(pages));
      console.log(name,(b.frames/b.rate).toFixed(2)+'s',fs.statSync(dest).size+' B');
    }
  }finally{
    await browser?.close();await new Promise(r=>server.close(r));
    // Only remove files this invocation created below its exact temporary root.
    for(const {id} of entries){const p=path.join(stage,id+'.wav');if(fs.existsSync(p))fs.unlinkSync(p);}
    if(!fs.readdirSync(stage).length)fs.rmdirSync(stage);
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
