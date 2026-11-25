"""Render the Mandarin character and narrator lines locally with Kokoro v1.1-zh.

Pass --model-dir for the extracted csukuangfj/kokoro-int8-multi-lang-v1_1
repository, and --runtime for a package directory containing sherpa-onnx 2.0.3.
The input is the archived V12 script. No network service is called.
"""
import argparse
import hashlib
import json
import math
import pathlib
import re
import sys
import tempfile
import wave

import numpy as np


ROOT = pathlib.Path(__file__).resolve().parents[1]
VERSION = "jinsha-kokoro-zh-1.1-v12.1"
SPEAKERS = {"narrator": (63, "zm_014", -19.5), "spirit": (9, "zf_007", -20.0)}
MODEL_HASH = "05d793700b0b507f760c183c0e39bdd6a97b43d32fdc7bf7b54a5179f1b11222"
VOICES_HASH = "e64a5a581d8c2a350d848f51c3121657cd83aa07ed6109172177345874a7244c"

# Each phrase ends at the original sentence punctuation. Pace and the length
# of the breath following it are directed separately for each observation.
DIRECTION = {
    "intro-n": [(.90, 320), (.97, 220), (.95, 0)],
    "intro-s": [(1.09, 140), (1.04, 0)],
    "finale-n": [(.88, 390), (.93, 0)],
    "site-1": [(.96, 210), (.95, 0)],
    "site-2": [(.95, 260), (.98, 0)],
    "site-3": [(.94, 260), (.98, 210), (.95, 0)],
    "site-4": [(.99, 200), (.96, 240), (.97, 315), (.94, 0)],
    "site-5": [(.97, 210), (.95, 260), (.99, 0)],
    "site-6": [(.98, 215), (.92, 280), (.96, 0)],
    "site-7": [(.96, 210), (1.0, 205), (.95, 0)],
    "site-8": [(.96, 265), (.94, 0)],
    "site-9": [(.94, 245), (.96, 0)],
    "travel-1": [(1.05, 150), (1.04, 0)],
    "travel-2": [(1.10, 180), (1.06, 0)],
    "travel-3": [(1.06, 155), (1.07, 0)],
    "travel-4": [(1.02, 170), (1.065, 0)],
    "travel-5": [(1.03, 170), (1.07, 0)],
    "travel-6": [(1.08, 150), (1.015, 0)],
    "travel-7": [(1.015, 190), (1.035, 0)],
    "travel-8": [(1.055, 185), (1.04, 0)],
    "travel-9": [(1.015, 195), (1.05, 0)],
}

# Kokoro v1.1-zh uses its own token notation for Mandarin finals. For
# instance ㄕ 我 4 is shuo4; ㄩ 3 is yu3. Longer entries disambiguate readings
# in phrases without changing the subtitles or substituting homophones.
PRONUNCIATIONS = {
    "烁羽": "ㄕ 我 4 ㄩ 3",
    "量到": "ㄌ 阳 2 ㄉ ㄠ 4",
    "量器口": "ㄌ 阳 2 ㄑ ㄧ 4 ㄎ ㄡ 3",
    "量一量": "ㄌ 阳 2 ㄧ 5 ㄌ 阳 2",
    "系着": "ㄐ ㄧ 4 ㄓ ㄜ 5",
    "重量": "ㄓ 中 4 ㄌ 阳 4",
    "四只": "ㄙ ㄭ 4 ㄓ 十 1",
    "那只": "ㄋ ㄚ 4 ㄓ 十 1",
    "金箔": "ㄐ 阴 1 ㄅ ㄛ 2",
    "很薄": "ㄏ ㄣ 3 ㄅ ㄠ 2",
    "好薄": "ㄏ ㄠ 3 ㄅ ㄠ 2",
    "锯缝": "ㄐ ㄩ 4 ㄈ ㄥ 4",
    "得托稳": "ㄉ ㄟ 3 ㄊ 我 1 文 3",
}


def sha256(path):
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


from voice_loudness import integrated_lufs


def trim_breath(samples, rate):
    samples=np.asarray(samples,dtype=np.float64)
    if not np.isfinite(samples).all():
        raise ValueError("Invalid waveform")
    loud=np.flatnonzero(np.abs(samples)>.0015)
    if not len(loud):
        raise ValueError("Empty phrase")
    start=max(0,int(loud[0])-round(.025*rate))
    stop=min(len(samples),int(loud[-1])+round(.070*rate)+1)
    phrase=samples[start:stop].copy()
    ramp=min(len(phrase)//2,round(.006*rate))
    if ramp:
        fade=np.linspace(0,1,ramp)
        phrase[:ramp]*=fade
        phrase[-ramp:]*=fade[::-1]
    return phrase


def build_tts(model, scratch):
    import sherpa_onnx as sherpa
    assert sha256(model/"model.int8.onnx")==MODEL_HASH
    assert sha256(model/"voices.bin")==VOICES_HASH
    tokens={line.split()[0] for line in (model/"tokens.txt").read_text(encoding="utf-8").splitlines() if line.split()}
    for word,phones in PRONUNCIATIONS.items():
        if not set(phones.split())<=tokens:
            raise ValueError(f"Unknown token in pronunciation of {word}")
    lex=scratch/"lexicon-zh-directed.txt"
    dictionary=(model/"lexicon-zh.txt").read_text(encoding="utf-8").splitlines()
    for base,phones in [("烁","ㄕ 我 4"),("羽","ㄩ 3")]:
        if base+" "+phones not in dictionary:
            raise ValueError(f"Unexpected source pronunciation: {base}")
    with lex.open("w",encoding="utf-8",newline="\n") as stream:
        for line in dictionary:
            if line.split(maxsplit=1)[0] not in PRONUNCIATIONS:
                stream.write(line+"\n")
        for word,phones in PRONUNCIATIONS.items():
            stream.write(f"{word} {phones}\n")
    kokoro=sherpa.OfflineTtsKokoroModelConfig(model=str(model/"model.int8.onnx"),voices=str(model/"voices.bin"),
        tokens=str(model/"tokens.txt"),lexicon=f"{model/'lexicon-us-en.txt'},{lex}")
    rules=",".join(str(model/(name+"-zh.fst")) for name in ["date","number","phone"])
    config=sherpa.OfflineTtsConfig(model=sherpa.OfflineTtsModelConfig(kokoro=kokoro,num_threads=3,provider="cpu"),rule_fsts=rules,max_num_sentences=1)
    if not config.validate():
        raise RuntimeError("Invalid Kokoro configuration")
    return sherpa.OfflineTts(config)


def render(row,tts,out):
    speaker,voice,target=SPEAKERS[row["role"]]
    phrases=re.findall(r"[^。！？]+[。！？]?",row["text"])
    assert "".join(phrases)==row["text"]
    cuts=DIRECTION[row["id"]]
    chunks=[]
    for phrase,(speed,pause) in zip(phrases,cuts,strict=True):
        audio=tts.generate(text=phrase,sid=speaker,speed=speed)
        rate=audio.sample_rate
        assert rate==24000
        chunks.append(trim_breath(audio.samples,rate))
        if pause:
            chunks.append(np.zeros(round(rate*pause/1000)))
    samples=np.concatenate(chunks)
    gain=min(10**((target-integrated_lufs(samples,rate))/20),10**(-1.5/20)/np.max(np.abs(samples)))
    pcm=np.rint(samples*gain*32767).astype("<i2")
    dest=out/(row["id"]+".wav")
    with tempfile.TemporaryDirectory(dir=out,prefix=".render-") as stage:
        pending=pathlib.Path(stage)/dest.name
        with wave.open(str(pending),"wb") as stream:
            stream.setparams((1,2,rate,0,"NONE","not compressed"))
            stream.writeframes(pcm.tobytes())
        pending.replace(dest)
    signal=pcm.astype(np.float64)/32768
    return {**row,"key":row["role"]+"|"+row["text"],"src":"/assets/v12/voices/"+dest.name,
            "version":VERSION,"voice":voice,"sid":speaker,"seconds":round(len(pcm)/rate,3),
            "lufs":round(integrated_lufs(signal,rate),2),"peakDbFS":round(20*np.log10(np.abs(signal).max()),2),
            "sampleRate":rate,"channels":1,"bits":16,"sha256":sha256(dest)}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir",required=True,type=pathlib.Path)
    parser.add_argument("--runtime",type=pathlib.Path)
    args=parser.parse_args()
    if args.runtime:
        sys.path.insert(0,str(args.runtime.resolve()))
    out=ROOT/"public/assets/v12/voices"
    out.mkdir(parents=True,exist_ok=True)
    archived=json.loads((out/"index.json").read_text(encoding="utf-8"))
    source=[{key:line[key] for key in ("id","text","role")} for line in archived["entries"]]
    assert set(DIRECTION)=={item["id"] for item in source}
    with tempfile.TemporaryDirectory(prefix="jinsha-directed-") as scratch:
        tts=build_tts(args.model_dir.resolve(),pathlib.Path(scratch))
        entries=[]
        for row in source:
            entry=render(row,tts,out)
            entries.append(entry)
            print(f"{row['id']} {entry['seconds']}s {entry['lufs']} LUFS",flush=True)
    index={"version":VERSION,"engine":"sherpa-onnx 2.0.3","model":"Kokoro-82M-v1.1-zh int8","modelSHA256":MODEL_HASH,
           "voicesSHA256":VOICES_HASH,"entries":entries}
    (out/"index.json").write_text(json.dumps(index,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")


if __name__=="__main__":
    main()
