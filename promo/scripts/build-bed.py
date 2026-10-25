# Cuts footage/bed.wav from the recordings on the bar lines the film uses (SPEC.md "SHOTS"). Run from promo/.
import subprocess, sys
segs = [("xp",1.401,2.1),("xp",3.501,2),("xp",9.501,4),("xp",49.501,2),("xp",13.501,2),("xp",15.501,2),
        ("mac",36.678,2),("mac",49.178,2),("mac",5.178,4),("mac",69.178,2),("xp",69.501,2),("xp",73.501,4),
        ("mac",75.178,2),("xp",80.501,2)]
args, fc = [], ""
for i,(src,st,du) in enumerate(segs):
    args += ["-ss", str(st), "-t", str(du), "-i", f"footage/{src}.mp4"]
    fc += f"[{i}:a]aresample=48000,atrim=duration={du},afade=t=in:d=0.004,afade=t=out:st={du-0.004:.3f}:d=0.004[a{i}];"
fc += "".join(f"[a{i}]" for i in range(len(segs))) + f"concat=n={len(segs)}:v=0:a=1[out]"
subprocess.run(["ffmpeg","-v","error","-y",*args,"-filter_complex",fc,"-map","[out]","-ac","2","-ar","48000","footage/bed-raw.wav"],check=True)
# Loudness to about -15 LUFS with peaks under -1.5 dBTP
subprocess.run(["ffmpeg","-v","error","-y","-i","footage/bed-raw.wav","-af","loudnorm=I=-15:TP=-1.5:LRA=11:linear=false","-ar","48000","footage/bed.wav"],check=True)
