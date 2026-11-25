import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

// Build the fixed section at its original pixel dimensions. The game and
// baker import the identical profile for the edge of the sand layer.
const output = new URL('../public/assets/v10/',import.meta.url);
const photo = await readFile(new URL('trench-strata.webp',output));
const profile = await readFile(new URL('../src/v10/trench-profile.js',import.meta.url));
const browser = await chromium.launch({headless:true,executablePath:process.env.JINSHA_EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try {
  const page = await browser.newPage();
  const plates = await page.evaluate(async ({photo,profile}) => {
    const {width,height,witnesses,joint,top,radius}=await import(profile);
    let gravelFloor;
    function random(seed) { return () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296); }
    function sheet(w=width,h=height){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
    function stroke(g,points,color,size=1) {
      g.strokeStyle=color;g.lineWidth=size;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();
    }

    function makeFace(){
      const c=sheet(),g=c.getContext('2d'),rand=random(78716),image=g.createImageData(width,height);
      for(let x=0;x<width;x++){
        const topY=top(x),y1=topY+28+4*Math.sin(x*.014),sand=joint(x),flood=sand-56+9*Math.sin(x*.009);
        for(let y=0;y<height;y++){
          const k=(y*width+x)*4;
          if(y<topY)continue;
          const band=y<y1?[83,77,53]:y<flood?[134,101,74]:y<sand?[177,141,97]:y<sand+34?[89,74,62]:[127,111,81];
          const strata=(Math.sin(y*.22+Math.sin(x*.008)*2.6+Math.sin(x*.019)*1.8)+Math.sin(y*.59+.5*Math.sin(x*.031))*.34)*4;
          const light=(.84+.21*(1-y/height))*(.89+.10*Math.sin(x*.0024)+.05*Math.sin(x*.031+y*.037));
          const grain=(rand()-.48)*24+strata;
          for(let n=0;n<3;n++) image.data[k+n]=band[n]*light+grain;
          image.data[k+3]=255;
        }
      }
      g.putImageData(image,0,0);
      for(let i=0;i<9600;i++){
        const x=rand()*width,y=top(x)+rand()*height;
        const gravel=y>joint(x)-53 && y<joint(x)-2;
        g.fillStyle=gravel?(rand()>.57?'#ead6aa8a':'#705c473e'):(rand()>.6?'#c0ad852d':'#392c224a');
        g.beginPath();g.ellipse(x,y,(gravel?.7:.4)+rand()*(gravel?3.4:1.6),.3+rand()*(gravel?1.7:1.0),rand()*.4,0,Math.PI*2);g.fill();
      }
      for(let i=0;i<120;i++){
        const x=rand()*width,sy=top(x)+rand()*16,len=rand()*45+4;
        g.strokeStyle=rand()>.36?'#5c4f37b0':'#a497697f';g.lineWidth=rand()*1.3+.45;
        g.beginPath();g.moveTo(x,sy);g.bezierCurveTo(x-6,sy+len*.25,x+8,sy+len*.64,x+rand()*11,sy+len);g.stroke();
      }
      for(let i=0;i<6;i++){
        const x=80+rand()*740,y=joint(x)+20+rand()*96;
        g.fillStyle='#694e3e';g.beginPath();g.moveTo(x,y);g.lineTo(x+16,y-4);g.lineTo(x+22,y-1);g.lineTo(x+4,y+4);g.closePath();g.fill();
        stroke(g,[[x,y],[x+15,y-4],[x+21,y-1]],'#bd8c68',1.6);
      }
      return c;
    }

    // Register the sediment art to the same archaeological trace used by the
    // recording pin. Dark pebbles in the sand can produce isolated false edges, so
    // neighbouring columns vote before each column is vertically resampled.
    function registerSoil(image){
      const source=sheet(width,Math.round(width*image.height/image.width)),sg=source.getContext('2d',{willReadFrequently:true});
      sg.drawImage(image,0,0,source.width,source.height);
      const sw=source.width,sh=source.height,pixels=sg.getImageData(0,0,sw,sh).data;
      gravelFloor=sheet(640,178);gravelFloor.getContext('2d').drawImage(source,0,sh*.305,sw,sh*.295,0,0,640,178);
      const raw=new Int16Array(sw),edges=new Int16Array(sw);
      function luma(x,y){const i=4*(y*sw+x);return .25*pixels[i]+.58*pixels[i+1]+.17*pixels[i+2];}
      for(let x=0;x<sw;x++){
        let best=-Infinity,edge=Math.round(sh*.64);
        for(let y=Math.floor(sh*.604);y<sh*.695;y++){
          const contrast=(luma(x,y-8)+luma(x,y-5)+luma(x,y-2))-(luma(x,y+2)+luma(x,y+5)+luma(x,y+9));
          if(contrast>best){best=contrast;edge=y;}
        }raw[x]=edge;
      }
      for(let x=0;x<sw;x++){const neighbours=[];
        for(let j=-4;j<=4;j++)neighbours.push(raw[Math.max(0,Math.min(sw-1,x+j))]);
        neighbours.sort((a,b)=>a-b);edges[x]=neighbours[4];}
      const plate=sheet(),pg=plate.getContext('2d'),target=pg.createImageData(width,height),out=target.data;
      for(let x=0;x<width;x++){
        const rim=top(x),jointY=joint(x),edge=edges[x];
        for(let y=Math.ceil(rim);y<height;y++){
          const sy=y<jointY?(y-rim)*edge/(jointY-rim):edge+(y-jointY)*(sh-edge-1)/(height-jointY);
          const lo=Math.floor(sy),hi=Math.min(sh-1,lo+1),f=sy-lo,k=4*(y*width+x),p=4*(lo*sw+x),q=4*(hi*sw+x);
          for(let n=0;n<3;n++)out[k+n]=pixels[p+n]+(pixels[q+n]-pixels[p+n])*f;
          out[k+3]=255;
        }
      }pg.putImageData(target,0,0);return plate;
    }

    const model = new Image();model.src=photo;await model.decode();
    const registered=registerSoil(model),fallback=makeFace();
    const cover=sheet(),d=cover.getContext('2d'),rand=random(6455);
    const windows=witnesses.map(x=>({x,y:joint(x)}));
    for(const w of windows){
      d.save();d.beginPath();d.rect(w.x-radius-2,w.y-radius-2,2*radius+4,2*radius+4);d.clip();
      d.fillStyle='#877761';d.fillRect(w.x-radius-2,w.y-radius-2,2*radius+4,2*radius+4);
      for(let i=0;i<2700;i++){d.fillStyle=rand()>.5?'#64584070':'#d8c19b64';d.fillRect(w.x-radius+rand()*radius*2,w.y-radius+rand()*radius*2,rand()*3+.5,rand()*1.8+.4);}
      d.restore();
    }

    const plates={registered,fallback,gravel:gravelFloor,dust:cover};
    return Object.fromEntries(Object.entries(plates).map(([key,canvas])=>[key,canvas.toDataURL('image/webp',.94)]));
  },{photo:'data:image/webp;base64,'+photo.toString('base64'),profile:'data:text/javascript;base64,'+profile.toString('base64')});
  for(const [name,url] of Object.entries(plates)){
    if(!url.startsWith('data:image/webp;base64,'))throw new Error('WebP encoding unavailable');
    const data=Buffer.from(url.split(',')[1],'base64');
    await writeFile(new URL('trench-'+name+'.webp',output),data);console.log(name,data.length);
  }
} finally {await browser.close();}
