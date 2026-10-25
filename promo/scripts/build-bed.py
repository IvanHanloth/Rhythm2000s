# Cuts the film's sound beds from the recordings on the bar lines the shots use (SPEC.md "SHOTS").
# Run from promo/. Writes footage/bed.wav (Part 1, the quick cut) and footage/detail-bed.wav (Part 2).
# A segment is (take, start, duration), (take, start, source duration, rate) for a take played at
# another speed (pitch kept), ("gap", duration) for silence, or a list of (take, start, duration)
# mixed together (Part 1's four desktops).
import subprocess

QUICK = [("xp",1.401,2.1),("xp",3.501,2),("xp",9.501,4),("xp",49.501,2),("xp",5.501,2),("xp",7.501,2),
         ("mac",9.178,2),("mac",49.178,2),
         [("xp",13.501,4),("mac",4.678,4),("mac",20.178,4),("xp",24.001,4)],
         ("mac",69.178,2),("xp",69.501,2),("xp",73.501,4),("mac",75.178,2),("xp",80.501,2)]

# Part 2: one segment per shot of compositions/detail.html, in order (110 BPM; showcase takes pre-slowed
# to footage/*-110.mp4)
DETAIL = [
    ('gap', 11.6),
    ('xp-full', 6.25, 12.969),
    ('xp-full', 54.126, 8.727),
    ('mac-full', 29.106, 4.364),
    ('xp-full', 36.672, 4.364),
    ('mac-full', 42.197, 4.364),
    ('xp-full', 41.035, 4.364),
    ('guide-xp', 49.621, 4.364),
    ('guide-mac', 39.121, 4.364),
    ('xp-110', 1.637, 1.091),
    ('mac-110', 1.285, 1.091),
    ('xp-110', 6.001, 1.091),
    ('mac-110', 5.649, 1.091),
    ('xp-110', 10.365, 1.091),
    ('mac-110', 10.012, 1.091),
    ('xp-110', 14.728, 1.091),
    ('mac-110', 23.103, 1.091),
    ('xp-110', 27.819, 1.091),
    ('mac-110', 40.558, 1.091),
    ('xp-110', 23.456, 1.091),
    ('xp-110', 40.91, 1.091),
    ('xp-full', 126.126, 4.364),
    ('mac-full', 98.925, 4.364),
    ('xp-110', 75.819, 2.182),
    ('mac-110', 75.467, 2.182),
    ('xp-110', 80.183, 4.364),
    ('mac-110', 79.831, 4.364),
    ('xp-full', 171.95, 2.727),
    ('mac-full', 144.7, 2.727),
    ('editor-xp', 0.0, 6.4),
    ('editor-xp-edit', 0.0, 12.0),
    ('editor-xp', 55.5, 4.5),
    ('editor-mac-edit', 0.0, 3.0),
    ('editor-mac', 100.0, 4.5),
    ('editor-mac-walk', 0.0, 4.0),
    ('editor-mac', 112.5, 9.5),
]


def build(segs, out):
    args, fc, labels, n = [], "", [], 0
    for i, seg in enumerate(segs):
        if seg[0] == "gap":
            du = seg[1]
            args += ["-f", "lavfi", "-t", str(du), "-i", "anullsrc=r=48000:cl=stereo"]
            fc += f"[{n}:a]atrim=duration={du}[a{i}];"
            labels.append(f"[a{i}]")
            n += 1
            continue
        parts = seg if isinstance(seg, list) else [seg]
        rate = parts[0][3] if len(parts[0]) > 3 else 1.0
        du = parts[0][2] / rate  # the segment's length in the film
        ins = []
        for src, st, src_du, *_ in parts:
            args += ["-ss", str(st), "-t", str(src_du + 0.05), "-i", f"footage/{src}.mp4"]
            tempo = f"atempo={rate}," if rate != 1.0 else ""
            fc += f"[{n}:a]aresample=48000,aformat=channel_layouts=stereo,{tempo}atrim=duration={du:.4f}[r{n}];"
            ins.append(f"[r{n}]")
            n += 1
        if len(ins) > 1:
            # normalize=0 keeps each take at its own level; loudnorm below evens the whole bed out
            fc += "".join(ins) + f"amix=inputs={len(ins)}:normalize=0[m{i}];"
            src_label = f"[m{i}]"
        else:
            src_label = ins[0]
        fc += f"{src_label}afade=t=in:d=0.004,afade=t=out:st={du-0.004:.4f}:d=0.004[a{i}];"
        labels.append(f"[a{i}]")
    fc += "".join(labels) + f"concat=n={len(segs)}:v=0:a=1[out]"
    raw = out.replace(".wav", "-raw.wav")
    subprocess.run(["ffmpeg","-v","error","-y",*args,"-filter_complex",fc,"-map","[out]","-ac","2","-ar","48000","-c:a","pcm_f32le",raw],check=True)
    # Loudness to about -15 LUFS with peaks under -1.5 dBTP
    subprocess.run(["ffmpeg","-v","error","-y","-i",raw,"-af","loudnorm=I=-15:TP=-1.5:LRA=11:linear=false","-ar","48000",out],check=True)


build(QUICK, "footage/bed.wav")
build(DETAIL, "footage/detail-bed.wav")
