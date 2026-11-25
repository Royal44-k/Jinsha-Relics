"""Cut locally playable mono WAVs from the two retained continuous performances."""
import hashlib
import json
from pathlib import Path
import wave

import numpy as np

from voice_loudness import integrated_lufs

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'scripts/audio-source/v15'
TARGET = ROOT / 'public/assets/v15/voices'


def quiet_cut(samples, rate, left, right):
    # Inside the inter-line punctuation, choose a low-energy crossing. The
    # subtitle provider's times are approximate and cannot identify breaths.
    center = (left + right) / 2
    start = max(0, round((max(left - .035, center - .26)) * rate))
    end = min(len(samples), round(min(right + .035, center + .26) * rate))
    width = min(round(.016 * rate), end - start)
    if width <= 0:
        raise ValueError('Invalid speech alignment')
    energy = np.r_[0., np.cumsum(samples[start:end] ** 2)]
    quiet = start + int(np.argmin(energy[width:] - energy[:-width]))
    return quiet + int(np.argmin(np.abs(samples[quiet:quiet+width])))


def render(role):
    meta = json.loads((SOURCES / (role + '-alignment.json')).read_text('utf-8'))
    rate = meta['rate']
    pcm = np.fromfile(SOURCES / (role + '.pcm'), dtype='<i2').astype(np.float64) / 32768.
    if abs(len(pcm)/rate - meta['duration']) > .005:
        raise ValueError('Unexpected source size for ' + role)
    chars = meta['characters']
    sequence = meta['utterances']
    if ''.join(c[0] for c in chars) != '\n\n'.join(v['text'] for v in sequence):
        raise ValueError('Alignment differs from script')
    rows, cursor = [], 0
    if ''.join(entry[0] for entry in meta['characters']) != '\n\n'.join(line['text'] for line in meta['utterances']):
        raise ValueError('The character alignment does not match the individual lines')
    for item in sequence:
        line = chars[cursor:cursor+len(item['text'])]
        rows.append((line[0][1],line[-2][2]))
        cursor += len(line)+2
    cuts = [0]+[quiet_cut(pcm,rate,rows[i-1][1],rows[i][0]) for i in range(1,len(rows))]+[len(pcm)]
    result = []
    for i,item in enumerate(sequence):
        start = max(cuts[i],round((rows[i][0]-.20)*rate))
        end = min(cuts[i+1],round((rows[i][1]+.34)*rate))
        samples = pcm[start:end].copy()
        fade = min(round(rate*.004),len(samples)//2)
        envelope = np.linspace(0,1,fade)
        samples[:fade] *= envelope
        samples[-fade:] *= envelope[::-1]
        # Constant gain preserves breath, consonants and each take's dynamics.
        loudness = integrated_lufs(samples,rate)
        gain_db = min(-18.5-loudness,-1.8-20*np.log10(np.abs(samples).max()))
        samples *= 10 ** (gain_db/20)
        path = TARGET / (item['id']+'.wav')
        with wave.open(str(path),'wb') as out:
            out.setparams((1,2,rate,0,'NONE','not compressed'))
            out.writeframes(np.rint(samples*32767).astype('<i2').tobytes())
        result.append(dict(**item,role=role,voice=meta['voice'],src='/assets/v15/voices/'+path.name,
                           startSample=start,endSample=end,rate=rate,seconds=round(len(samples)/rate,4),
                           gainDb=round(gain_db,2),sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    return result


if __name__ == '__main__':
    TARGET.mkdir(parents=True,exist_ok=True)
    entries = render('narrator') + render('spirit')
    lines = json.loads((ROOT/'src/v10/survey-voices.json').read_text('utf-8'))
    if sorted((e['id'],e['role'],e['text']) for e in entries) != sorted((e['id'],e['role'],e['text']) for e in lines):
        raise ValueError('Voice takes do not match game subtitles')
    (TARGET/'index.json').write_text(json.dumps({'version':'jinsha-dialogue-v15','provider':'HeyGen Voice',
        'format':'PCM16 mono, 44100 Hz','entries':entries},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f"{len(entries)} cues, {sum(e['seconds'] for e in entries):.2f} seconds")
