"""Blind offline Mandarin transcription of the delivered PCM16 game cues.

Pass --model-dir for sherpa-onnx-paraformer-zh-small-2024-03-09 and --runtime
for an optional directory containing sherpa_onnx. No audio is sent to a service.
"""
import argparse
import hashlib
import json
import sys
import unicodedata
import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
MODEL = "sherpa-onnx-paraformer-zh-small-2024-03-09"
MODEL_HASH = "3ef6c19369b912f7caf3cef8e545c5ccd1a33d9d7ec792a46668dc41c4b229ec"


def characters(text):
    return "".join(ch for ch in unicodedata.normalize("NFKC", text).casefold() if ch.isalnum())


def edits(reference, actual):
    # Minimum edit distance, retaining the actual differing characters.
    rows = [list(range(len(actual)+1))]
    for i, a in enumerate(reference, 1):
        row = [i]
        for j, b in enumerate(actual, 1):
            row.append(min(rows[-1][j-1]+(a != b), rows[-1][j]+1, row[j-1]+1))
        rows.append(row)
    i, j = len(reference), len(actual)
    changes = []
    while i or j:
        if i and j and rows[i][j] == rows[i-1][j-1]+(reference[i-1] != actual[j-1]):
            i -= 1
            j -= 1
            if reference[i] != actual[j]:
                changes.append([i, reference[i], actual[j]])
        elif i and rows[i][j] == rows[i-1][j]+1:
            i -= 1
            changes.append([i, reference[i], ""])
        else:
            j -= 1
            changes.append([i, "", actual[j]])
    return list(reversed(changes))


def read_wave(file):
    with wave.open(str(file)) as wav:
        if wav.getnchannels() != 1 or wav.getsampwidth() != 2:
            raise ValueError("Expected mono PCM16: " + str(file))
        rate = wav.getframerate()
        signal = np.frombuffer(wav.readframes(wav.getnframes()), "<i2").astype(np.float32) / 32768
    return rate, signal


def transcribe(engine, rate, samples):
    stream = engine.create_stream()
    stream.accept_waveform(rate, samples)
    engine.decode_stream(stream)
    return stream.result.text.strip()


def spot_check(engine, folder, source_dir):
    # Select suspicious substitutions and control phrases only after full-clip decoding.
    targets = {"intro-n":"那九个柱洞","intro-s":"我叫烁羽","finale-n":"量过的柱洞","site-4":"还粘着湿砂",
               "site-6":"铜鸟的尾巴","site-8":"金箔背后","travel-2":"芦湾解竹排","travel-4":"把绳子搁下了",
               "travel-6":"那只铜鸟尾巴","travel-8":"金箔后面"}
    entries = json.loads((folder/"index.json").read_text(encoding="utf-8"))["entries"]
    windows = []
    for role in sorted({entry["role"] for entry in entries}):
        cast = json.loads((source_dir/(role+"-alignment.json")).read_text(encoding="utf-8"))
        cursor = 0
        for line in cast["utterances"]:
            key, text = line["id"], line["text"]
            chars = cast["characters"][cursor:cursor+len(text)]
            cursor += len(text)+2
            if key not in targets or targets[key] not in text:
                continue
            phrase = targets[key]
            i = text.index(phrase)
            entry = next(row for row in entries if row["id"] == key)
            rate, samples = read_wave(folder/(key+".wav"))
            offset = entry["startSample"]/rate
            start, end = chars[i][1]-offset, chars[i+len(phrase)-1][2]-offset
            row = {"id":key, "phrase":phrase, "startSeconds":round(start,3),"endSeconds":round(end,3),"transcriptions":[]}
            for margin in (.16, .62):
                left, right = max(0,round(rate*(start-margin))), min(len(samples),round(rate*(end+margin)))
                row["transcriptions"].append({"contextSeconds":margin, "text":transcribe(engine,rate,samples[left:right])})
            windows.append(row)
    return windows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-dir", required=True, type=Path)
    parser.add_argument("--runtime", type=Path)
    parser.add_argument("--folder", type=Path, default=ROOT/"public/assets/v15/voices")
    parser.add_argument("--json", type=Path, default=ROOT/"docs/v15/voice-transcription.json")
    parser.add_argument("--source-takes", type=Path, help="Recheck selected words in two unprompted acoustic contexts using source timestamps.")
    args = parser.parse_args()
    if args.runtime:
        sys.path.insert(0, str(args.runtime.resolve()))
    import sherpa_onnx
    weights = args.model_dir/"model.int8.onnx"
    with weights.open("rb") as stream:
        checksum = hashlib.file_digest(stream, "sha256").hexdigest()
    if checksum != MODEL_HASH:
        raise ValueError("Unexpected model SHA256")
    engine = sherpa_onnx.OfflineRecognizer.from_paraformer(
        paraformer=str(weights), tokens=str(args.model_dir/"tokens.txt"), provider="cpu",
        num_threads=3, decoding_method="greedy_search", debug=False)
    rows = []
    for file in sorted(args.folder.glob("*.wav")):
        rate, signal = read_wave(file)
        rows.append({"id": file.stem, "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
                     "hypothesis": transcribe(engine, rate, signal)})
    # Read the script only after completing all recognition, to keep scoring independent.
    lines = json.loads((ROOT/"src/v10/survey-voices.json").read_text(encoding="utf-8"))
    expected = {line["id"]: line["text"] for line in lines}
    if {row["id"] for row in rows} != set(expected):
        raise ValueError("The delivered WAV set differs from the script")
    substitutions = total = 0
    for row in rows:
        row["reference"] = expected[row["id"]]
        ref, hyp = characters(row["reference"]), characters(row["hypothesis"])
        row["changes"] = edits(ref, hyp)
        substitutions += len(row["changes"])
        total += len(ref)
    result = {"engine": "sherpa-onnx "+sherpa_onnx.__version__, "model": MODEL, "sha256": checksum,
              "modelUrl": "https://huggingface.co/csukuangfj/"+MODEL, "decoding": "greedy, without hotwords or prompting",
              "method": "NFKC, case fold, discard punctuation and whitespace; edit entries are [zero-based reference index, expected, decoded]. "
                        "CER includes homophones, numerals and distinctions a listener cannot hear. This is a lexical check, not a verdict on Mandarin diction, acting or emotion.",
              "referenceCharacters": total, "edits": substitutions, "characterErrorRate": round(substitutions/total,4),
              "exactCues": sum(not row["changes"] for row in rows), "clips": rows}
    if args.source_takes:
        result["spotChecks"] = spot_check(engine,args.folder,args.source_takes)
    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.json.write_text(json.dumps(result, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(f"{len(rows)} cues, {substitutions} written edits / {total} reference characters")


if __name__ == "__main__":
    main()
