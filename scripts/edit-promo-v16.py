"""Edit the CDP gameplay rushes to a phone-first, 25 fps launch trailer.

Run scripts/capture-promo-v16.mjs first. JINSHA_RUSHES and FFMPEG can override
the local recording and encoder paths. All picture content is from those takes.
"""
import bisect
import functools
import json
import math
import os
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
RUSH = Path(os.environ.get("JINSHA_RUSHES", str(Path(tempfile.gettempdir())/"jinsha-v16-rushes")))
WORK = RUSH / "edit"
OUT = ROOT / "docs/v16/发布物料"
FF = os.environ.get("FFMPEG", "ffmpeg")
FPS, W, H = 25, 1080, 1920
# Seconds in source, presentation duration, composition, field label, title, unused space reserved in portraits.
EDITS = [
 ("bronze",.10,3.96,"open","铜鸟支护台","一只铜鸟，","该托在哪里？"),
 ("flight",.65,3.04,"wide","古河岸","跟上烁羽","沿河飞行，寻找下一处遗存。"),
 ("birds",.96,3.48,"wide","芦苇浅汊","惊起一群水鸟","靠近河面，水鸟从芦汊间起飞。"),
 ("raft",.48,3.52,"wide","古河道渡口","在回水里掌舵","解开竹排，沿漂木寻找回湾。"),
 ("foil",.22,5.72,"work","金箔光学工位","借一束背光","转动试片，移动灯位，辨认镂空。"),
 ("ivory",.08,5.36,"work","象牙埋藏区","先拍照，再移动","把比例尺与象牙的叠压关系拍在同一张底片上。"),
 ("investigation",.06,3.88,"desk","证据推理台","一份观察","拖动放大镜，摘录土层和河湾留下的细节。"),
 ("pair",.05,4.28,"desk","证据推理台","能支持哪种推断？","拖入两份证据，留下判断和仍待验证的问题。"),
 ("posts",2.60,3.68,"work","九柱基址","拉一道测绳","把测绳从一个洞心拉到另一个洞心。"),
 ("dawn",4.10,7.48,"end","冬至候日","金沙：古蜀秘境","如果再回到金沙，你想追哪条线索？"),
]
TOTAL = round(sum(x[2] for x in EDITS),2)

@functools.lru_cache(maxsize=None)
def font(kind,size):
    name={"display":"STZHONGS.TTF","text":"msyh.ttc","latin":"georgia.ttf"}[kind]
    return ImageFont.truetype("C:/Windows/Fonts/"+name,size)

def grad(canvas,y0,y1,rgb,a,b):
    h=y1-y0
    if h<=0:return
    alpha=np.linspace(a,b,h,dtype=np.uint8)
    bar=Image.new("RGBA",(1,h),rgb);bar.putalpha(Image.fromarray(alpha.reshape(h,1)))
    canvas.alpha_composite(bar.resize((W,h)),(0,y0))

def text(draw,xy,s,size=33,kind="text",fill="#f1e9d8"):
    draw.text(xy,s,font=font(kind,size),fill=fill,anchor="lt",stroke_width=0)

def overlay(index):
    _,_,_,kind,place,title,detail=EDITS[index]
    art=Image.new("RGBA",(W,H));d=ImageDraw.Draw(art)
    ink=(11,27,26);paper="#f4ecda";gold="#e8cd91";muted="#b9c6b9"
    if kind in ("open","end","wide"):
        grad(art,0,310,ink,200,0);grad(art,1050,1840,ink,0,245)
        grad(art,1840,H,ink,245,250)
    else:
        d.rectangle((0,0,W,192),fill=ink)
        d.rectangle((0,1505,W,H),fill=ink)
        d.line((78,148,W-78,148),fill="#6e7560",width=2)
        d.line((78,1537,W-78,1537),fill="#817e62",width=2)
    d.line((78,92,130,92),fill=gold,width=3)
    text(d,(152,72),"金沙遗址探索",32,"display",paper)
    text(d,(784,78),"实机游玩",30,"text",paper)
    if kind=="open":
        text(d,(80,1315),title,70,"display",paper)
        text(d,(80,1425),detail,95,"display",gold)
    elif kind=="end":
        text(d,(82,1255),"冬至候日  /  教学复原",34,"text",gold)
        text(d,(78,1366),title,92,"display",paper)
        text(d,(83,1521),detail,38,"text",paper)
        text(d,(84,1634),"AI 辅助创作　·　浏览器探索游戏",29,"text",muted)
    else:
        labelY=1400 if kind=="wide" else 1572
        text(d,(82,labelY),place,30,"text",gold)
        text(d,(78,labelY+60),title,69,"display",paper)
        bodySize=min(37,int(915/max(1,len(detail))))
        text(d,(82,labelY+161),detail,bodySize,"text",paper)
    return art

def fitted(im,size,anchor=(.5,.5)):
    ow,oh=size;s=max(ow/im.width,oh/im.height);cw,ch=ow/s,oh/s
    x=(im.width-cw)*anchor[0];y=(im.height-ch)*anchor[1]
    return im.resize(size,Image.Resampling.BICUBIC,(x,y,x+cw,y+ch))

def base_frame(frame,kind,name):
    if kind in ("open","wide","end"):
        # Commit a portrait camera window per take. Stay clear of cut-off
        # HUD fragments while keeping the subject in its actual environment.
        windows={"bronze":((1,102,549,918),.50),"flight":((0,209,840,890),.50),
                 "birds":((0,211,840,920),.42),"raft":((0,55,611,1015),.50),
                 "dawn":((0,108,840,828),.50)}
        rect,anchor=windows[name]
        return fitted(frame.crop(rect),(W,H),(anchor,.5)).convert("RGBA")
    canvas=Image.new("RGBA",(W,H),(11,27,26))
    top,bottom=192,1506
    if kind=="desk":
        # Journal popup occupies the middle of the real screen.
        content=frame.crop((0,165,840,922))
        content.thumbnail((W,bottom-top),Image.Resampling.BICUBIC)
        content=content.resize((W,round(content.height*W/content.width)),Image.Resampling.BICUBIC)
        # Neutral native-UI surround instead of stretching the evidence.
        canvas.paste(frame.getpixel((5,215)),(0,top,W,bottom))
        canvas.paste(content,(0,top+(bottom-top-content.height)//2))
    else:
        canvas.paste(fitted(frame,(W,bottom-top)),(0,top))
    return canvas

def run(cmd):
    subprocess.run([str(arg) for arg in cmd],check=True)

def cover():
    # Use the same camera take and moment as the opening, reframed for the feed.
    m=json.loads((RUSH/'bronze'/'frames.json').read_text('utf8'))
    still=min(m['frames'],key=lambda item:abs(item['at']-.18))
    with Image.open(RUSH/'bronze'/still['file']) as source:
        shot=source.crop((4,319,551,868)).resize((982,983),Image.Resampling.LANCZOS)
    page=Image.new('RGBA',(1080,1440),(15,31,29));d=ImageDraw.Draw(page)
    text(d,(54,56),'金沙：古蜀秘境',48,'display','#eee4cd')
    text(d,(827,65),'实机游玩',30,'text','#decd9d')
    d.line((52,138,1028,138),fill='#6e7560',width=2)
    page.paste(shot.crop((0,0,982,916)),(49,179))
    d.rectangle((49,179,1031,1095),outline='#b6ac89',width=2)
    # A bottom-to-top exposure burn lets the page title sit on the photograph.
    grad(page,800,1100,(15,31,29),0,248)
    text(d,(73,992),'铜鸟支护台',32,'text','#e5ce96')
    text(d,(68,1063),'一只铜鸟，',96,'display','#f2e9d4')
    text(d,(68,1187),'该托在哪里？',105,'display','#f2e9d4')
    d.line((71,1360,149,1360),fill='#d4bc85',width=3)
    text(d,(173,1345),'古蜀遗存保护与考古探索',32,'text','#bdc9be')
    page.convert('RGB').save(OUT/'视频封面-铜鸟实机.jpg',quality=95,subsampling=0)

def soundtrack():
    rate=48000;samples=round(TOTAL*rate)
    def read_audio(file,channels):
        val=subprocess.check_output([FF,'-v','error','-i',str(file),'-ar',str(rate),'-ac',str(channels),'-f','f32le','-'])
        return np.frombuffer(val,dtype='<f4').reshape(-1,channels).copy()
    bed=read_audio(RUSH/'river-live.webm',2)[:samples]*2.5
    if len(bed)<samples:raise ValueError('The live ambience recording is too short')
    voices=np.zeros((samples,1),dtype=np.float32);duck=np.ones((samples,1),dtype=np.float32)
    cues=[(.14,'site-6',0,3.25),(4.25,'travel-2',0,5.59),(14.05,'site-8',0,2.25),(20.02,'site-7',0,2.53),
          (22.58,'site-7',6.93,8.70),(36.56,'finale-n',0,7.80)]
    for at,cue,begin,end in cues:
        line=read_audio(ROOT/'public/assets/v15/voices'/(cue+'.wav'),1)
        speech=line[round(begin*rate):round(end*rate)].copy()
        dest=round(at*rate);count=min(len(speech),len(voices)-dest)
        edge=min(count//2,round(rate*.012));speech[:edge]*=np.linspace(0,1,edge)[:,None];speech[count-edge:count]*=np.linspace(1,0,edge)[:,None]
        voices[dest:dest+count]+=speech[:count]*1.20
        attack=min(dest,round(rate*.20));tail=min(samples-dest-count,round(rate*.42))
        if attack:duck[dest-attack:dest]=np.minimum(duck[dest-attack:dest],np.linspace(1,.46,attack)[:,None])
        duck[dest:dest+count]=.46
        if tail:duck[dest+count:dest+count+tail]=np.minimum(duck[dest+count:dest+count+tail],np.linspace(.46,1,tail)[:,None])
    mix=bed*duck+voices
    fade=round(rate*.65);mix[:rate//12]*=np.linspace(0,1,rate//12)[:,None];mix[-fade:]*=np.linspace(1,0,fade)[:,None]
    # Linear headroom, no distortion or pitch/speed processing.
    peak=float(np.abs(mix).max())
    if peak>.86:mix*=.86/peak
    pcm=WORK/'mix.f32';mix.astype('<f4').tofile(pcm)
    return pcm

def render():
    WORK.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
    sound=soundtrack();dest=OUT/'金沙古蜀秘境_实机预告_竖屏.mp4'
    command=[FF,'-hide_banner','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-video_size',f'{W}x{H}','-framerate',str(FPS),'-i','pipe:0','-f','f32le','-ar','48000','-ac','2','-i',str(sound),'-c:v','h264_amf','-b:v','9M','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-bsf:v','h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1','-c:a','aac','-b:a','192k','-movflags','+faststart','-shortest',str(dest)]
    encoder=subprocess.Popen(command,stdin=subprocess.PIPE)
    try:
        for n,(name,start,duration,kind,*_) in enumerate(EDITS):
            meta=json.loads((RUSH/name/'frames.json').read_text('utf8'));frames=meta['frames'];times=[v['at'] for v in frames]
            if start+duration>meta['seconds']+.12:raise ValueError(f'{name}: chosen segment exceeds captured take')
            layer=overlay(n);cache=None;data=None
            for t in range(round(FPS*duration)):
                idx=max(0,bisect.bisect_right(times,start+t/FPS)-1)
                if idx!=cache:
                    with Image.open(RUSH/name/frames[idx]['file']) as source:im=base_frame(source,kind,name)
                    im.alpha_composite(layer);data=im.convert('RGB').tobytes();cache=idx
                encoder.stdin.write(data)
            print(name,duration,flush=True)
    finally:
        encoder.stdin.close()
        if encoder.wait():raise RuntimeError('Video encoder failed')
    cover()
    print(dest,TOTAL,flush=True)

if __name__=='__main__':render()
