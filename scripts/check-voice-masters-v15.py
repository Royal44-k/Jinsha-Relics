"""Inspect the actual game voice masters (PCM WAV, NumPy). Optional FFmpeg adds LUFS/dBTP.

Example: python scripts/check-voice-masters-v15.py public/assets/v15/voices --json docs/v15/voice-masters.json
Use --ffmpeg /path/to/ffmpeg for independently metered integrated loudness and true peak.
The report measures signals. Judging Mandarin diction, emotional intent and contextual
intelligibility still requires listening to both isolated voices and the in-game mix.
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]


def read_pcm(path):
    with wave.open(str(path)) as src:
        channels, width, rate, count, compression, _ = src.getparams()
        raw = src.readframes(count)
    if compression != "NONE" or width not in (1, 2, 3, 4) or rate < 8000 or not count:
        raise ValueError("Expected nonempty 8/16/24/32-bit PCM at 8 kHz or higher")
    if len(raw) != channels * width * count:
        raise ValueError("PCM data is truncated")
    if width == 1:
        pcm = np.frombuffer(raw, np.uint8).astype(np.int32) - 128
    elif width == 3:
        b = np.frombuffer(raw, np.uint8).reshape(-1, 3).astype(np.int32)
        pcm = b[:, 0] | b[:, 1] << 8 | b[:, 2] << 16
        pcm = (pcm ^ 0x800000) - 0x800000
    else:
        pcm = np.frombuffer(raw, "<i" + str(width))
    scale = 2 ** (width * 8 - 1)
    return pcm.reshape(-1, channels), scale, rate


def db(x):
    return round(float(20 * np.log10(x)), 2) if x > 0 else None


def longest_run(mask):
    edges = np.flatnonzero(np.diff(mask.astype(np.int8), prepend=0, append=0))
    return int(np.diff(edges.reshape(-1, 2), axis=1).max()) if len(edges) else 0


def ebu(path, binary):
    command = [binary, "-hide_banner", "-nostdin", "-nostats", "-i", str(path),
               "-af", "ebur128=peak=true:framelog=verbose", "-f", "null", "-"]
    result = subprocess.run(command, capture_output=True, check=True, timeout=40)
    summary = result.stderr.decode("utf-8", "replace").rsplit("Summary:", 1)[-1]
    def number(label):
        match = re.search(r"(?m)^\s*" + label + r":\s*(-?(?:\d+(?:\.\d+)?|inf))\s", summary)
        if match is None:
            raise ValueError("Cannot read FFmpeg ebur128 " + label)
        value = float(match.group(1))
        return value if np.isfinite(value) else None
    return {"integratedLUFS": number("I"), "truePeakDbTP": number("Peak")}


def voiced_pitch(signal, rate):
    """Normalized autocorrelation on 50 ms frames. Suppress ambiguous/unvoiced frames."""
    mono = signal[:, np.argmax((signal**2).mean(axis=0))]
    window, hop = round(rate*.050), round(rate*.020)
    if len(mono) < window:
        return None
    frames = np.lib.stride_tricks.sliding_window_view(mono, window)[::hop]
    frames = frames[(frames**2).mean(axis=1) > 10**(-38/10)]
    if not len(frames):
        return None
    frames = frames - frames.mean(axis=1, keepdims=True)
    fft_size = 1 << (2*window-1).bit_length()
    spectrum = np.fft.rfft(frames, n=fft_size)
    correlation = np.fft.irfft(spectrum * spectrum.conj(), n=fft_size)
    lags = np.arange(round(rate/450), round(rate/68)+1)
    energy = np.pad((frames**2).cumsum(axis=1), ((0, 0), (1, 0)))
    norm = np.sqrt(np.maximum(energy[:, window-lags]*(energy[:, -1:] - energy[:, lags]), 1e-20))
    score = correlation[:, lags]/norm
    peaks = (score[:, 1:-1] > score[:, :-2]) & (score[:, 1:-1] >= score[:, 2:])
    cutoff = np.maximum(.78, score.max(axis=1, keepdims=True)*.92)
    eligible = peaks & (score[:, 1:-1] >= cutoff)
    periods = lags[1:-1][np.argmax(eligible, axis=1)[eligible.any(axis=1)]]
    if len(periods) < 4:
        return None
    low, centre, high = np.percentile(rate/periods, [10, 50, 90])
    return {"frames": len(periods), "medianHz": round(float(centre),1),
            "p10Hz": round(float(low),1), "p90Hz": round(float(high),1),
            "p10To90Semitones": round(float(12*np.log2(high/low)),2)}


def measure(path, role, binary):
    pcm, scale, rate = read_pcm(path)
    count, channels = pcm.shape
    signal = pcm.astype(np.float64) / scale
    peak = float(np.abs(signal).max())
    clipped = (pcm == -scale) | (pcm == scale - 1)
    # A hot sample alternately in L and R must not look like a sustained clip.
    clip_run = max(longest_run(clipped[:, ch]) for ch in range(channels))
    block = max(1, round(rate * .020))
    starts = np.arange(0, count, block)
    lengths = np.diff(starts, append=count)
    power = np.add.reduceat(signal**2, starts, axis=0) / lengths[:, None]
    envelope = np.sqrt(power.max(axis=1))
    active = np.flatnonzero(envelope >= 10**(-48/20))
    digital_quiet = (envelope > 0) & (envelope < 10**(-48/20))
    head, tail, pause = count, count, 0
    if len(active):
        head = int(starts[active[0]])
        tail = int(count - starts[active[-1]] - lengths[active[-1]])
        pause = longest_run(envelope[active[0]:active[-1]+1] < 10**(-48/20)) * block
    row = {"id": path.stem, "role": role, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
           "seconds": round(count/rate, 3), "channels": channels, "sampleRate": rate,
           "samplePeakDbFS": db(peak), "fullScaleSamples": int(clipped.sum()), "maxFullScaleRun": clip_run,
           "dcDbFS": db(np.max(np.abs(signal.mean(axis=0)))),
           "leadingQuietMs": round(head * 1000/rate), "trailingQuietMs": round(tail * 1000/rate),
           "maxInteriorQuietMs": round(pause * 1000/rate), "quietNonzeroFrameCount": int(digital_quiet.sum()),
           "quietNonzeroRmsMedianDbFS": db(np.median(envelope[digital_quiet])) if digital_quiet.any() else None,
           "voicedPitchEstimate": voiced_pitch(signal, rate)}
    if binary:
        row.update(ebu(path, binary))
    issues = []
    if not len(active):
        issues.append("no audible frames")
    if clip_run >= 3:
        issues.append("consecutive full-scale samples")
    row["errors"] = issues
    return row


def inspect_edit_boundaries(folder, source_dir, clips):
    """Check retained samples against continuous deliverables and study all edit gaps."""
    entries = json.loads((folder / "index.json").read_text(encoding="utf-8"))["entries"]
    by_id = {row["id"]: row for row in entries}
    if len(by_id) != len(entries) or set(by_id) != {row["id"] for row in clips}:
        raise ValueError("source edit index differs from measured cues")
    measured_hash = {row["id"]: row["sha256"] for row in clips}
    report = {"cues": [], "joins": [], "warnings": []}
    for role in sorted({row["role"] for row in entries}):
        data = json.loads((source_dir / (role+"-alignment.json")).read_text(encoding="utf-8"))
        words, lines, rate = data["characters"], data["utterances"], data["rate"]
        if "".join(c[0] for c in words) != "\n\n".join(line["text"] for line in lines):
            raise ValueError(role + " source transcript mismatch")
        original = np.fromfile(source_dir / (role+".pcm"), dtype="<i2")
        cursor, previous = 0, None
        for line in lines:
            key = line["id"]
            entry = by_id[key]
            if line["text"] != entry["text"] or role != entry["role"] or measured_hash[key] != entry["sha256"]:
                raise ValueError(key + " index / source mismatch")
            chars = [c for c in words[cursor:cursor+len(line["text"])] if c[0].isalnum()]
            cursor += len(line["text"])+2
            start, end = entry["startSample"], entry["endSample"]
            output, _, output_rate = read_pcm(folder / (key+".wav"))
            source = original[start:end]
            if len(source) != len(output) or rate != output_rate or output.shape[1] != 1:
                raise ValueError(key + " source window / sample format mismatch")
            # Match independent gain on un-faded PCM and bound the rounding residual.
            margin = round(.005*rate)
            x = source[margin:-margin].astype(np.float64)
            y = output[margin:-margin, 0].astype(np.float64)
            gain = (x*y).sum()/(x*x).sum()
            residual = float(np.max(np.abs(x*gain-y)))
            if residual > 1:
                raise ValueError(key + " does not match the claimed continuous performance")
            first, last = chars[0], chars[-1]
            edge = {"id": key, "firstCharacter": first[0], "lastCharacter": last[0],
                    "firstAlignedOnsetAfterStartMs": round((first[1]-start/rate)*1000),
                    "endAfterLastAlignedOffsetMs": round((end/rate-last[2])*1000),
                    "pcmResidualMaxLSB": round(residual, 3)}
            report["cues"].append(edge)
            if previous:
                prev_id, prev_end, prev_last = previous
                if prev_end > start:
                    raise ValueError(f"{prev_id}/{key} source windows overlap")
                stride = round(.010*rate)
                segment = original[max(0,prev_end-stride):min(len(original),start+stride)].astype(np.float64)/32768
                starts = np.arange(0,len(segment),stride)
                sizes = np.diff(starts,append=len(segment))
                rms = np.sqrt(np.add.reduceat(segment**2, starts) / sizes)
                peak = db(rms.max())
                join = {"from": prev_id, "to": key, "removedGapMs": round((start-prev_end)*1000/rate),
                        "previousCutToNextWordMs": round(1000*(first[1]-prev_end/rate)),
                        "previousWordToNextCutMs": round(1000*(start/rate-prev_last[2])),
                        "maxRmsAroundJoinDbFS": peak}
                report["joins"].append(join)
                if peak is not None and peak > -42:
                    report["warnings"].append([prev_id, key, "review audible activity at edit"])
                if min(join["previousCutToNextWordMs"],join["previousWordToNextCutMs"]) < 0:
                    report["warnings"].append([prev_id, key, "adjacent character timestamp overlap"])
            if min(edge["firstAlignedOnsetAfterStartMs"],edge["endAfterLastAlignedOffsetMs"]) < 0:
                report["warnings"].append([key, "review own character timestamp at edge"])
            previous = key, end, last
    report["interpretation"] = ("Word timestamps are provider estimates; negative own-word margins require comparison with the actual waveform. "
                                "Join RMS covers the removed gap plus 10 ms of source on each side. Low-energy boundaries support cuts between lines, "
                                "but cannot assess pronunciation or acting.")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", type=Path, nargs="?", default=ROOT/"public/assets/v15/voices")
    parser.add_argument("--cues", type=Path, default=ROOT/"src/v10/survey-voices.json")
    parser.add_argument("--ffmpeg", default=shutil.which("ffmpeg"))
    parser.add_argument("--json", type=Path)
    parser.add_argument("--source-takes", type=Path, help="Inspect v15 alignment JSON and original PCM against each delivered edit")
    args = parser.parse_args()
    cues = json.loads(args.cues.read_text(encoding="utf-8"))
    ids = [cue["id"] for cue in cues]
    if len(ids) != len(set(ids)):
        parser.error("duplicate cue IDs")
    rows, errors = [], []
    for cue in cues:
        path = args.folder / (cue["id"] + ".wav")
        try:
            row = measure(path, cue["role"], args.ffmpeg)
        except (OSError, ValueError, wave.Error, EOFError, subprocess.SubprocessError) as error:
            errors.append({"id": cue["id"], "error": str(error)})
            continue
        rows.append(row)
        errors.extend({"id": cue["id"], "error": message} for message in row["errors"])
    report = {"folder": str(args.folder), "expected": len(cues), "measured": len(rows), "errors": errors,
              "method": [
                  "Quiet uses the louder channel in contiguous 20 ms RMS windows below -48 dBFS. Its boundaries have 20 ms resolution.",
                  "Quiet nonzero RMS includes fading consonants and room tone. It is a proxy, not measured room noise or speech-to-noise ratio.",
                  "Peak is sample peak. LUFS and oversampled true peak are included only when FFmpeg ebur128 ran.",
                  "Pitch estimates use autocorrelation in 50 ms frames from the strongest channel, within 68–450 Hz. Octave errors are possible. Melody or a mixed background makes this less reliable.",
                  "Silence and sustained full-scale clips fail. Acting, Mandarin tones, timbre and mix masking need a listening pass."
              ], "clips": rows}
    if args.source_takes:
        try:
            report["sourceBoundaries"] = inspect_edit_boundaries(args.folder, args.source_takes, rows)
        except (OSError, ValueError, KeyError, IndexError) as error:
            errors.append({"id": "source takes", "error": str(error)})
    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False)+"\n", encoding="utf-8")
    print(f"{len(rows)}/{len(cues)} audio files measured; {len(errors)} errors")
    for failure in errors:
        print(f"{failure['id']}: {failure['error']}")
    raise SystemExit(bool(errors))


if __name__ == "__main__":
    main()
