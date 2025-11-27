@echo off
echo Generating 20 pitch variants...
echo.

REM Generate pitch variants from 1.05x to 2.0x in 0.05 increments
ffmpeg -i blip.wav -af "asetrate=44100*1.05,aresample=44100" -y blip_p01.wav
echo Created blip_p01.wav (1.05x)

ffmpeg -i blip.wav -af "asetrate=44100*1.10,aresample=44100" -y blip_p02.wav
echo Created blip_p02.wav (1.10x)

ffmpeg -i blip.wav -af "asetrate=44100*1.15,aresample=44100" -y blip_p03.wav
echo Created blip_p03.wav (1.15x)

ffmpeg -i blip.wav -af "asetrate=44100*1.20,aresample=44100" -y blip_p04.wav
echo Created blip_p04.wav (1.20x)

ffmpeg -i blip.wav -af "asetrate=44100*1.25,aresample=44100" -y blip_p05.wav
echo Created blip_p05.wav (1.25x)

ffmpeg -i blip.wav -af "asetrate=44100*1.30,aresample=44100" -y blip_p06.wav
echo Created blip_p06.wav (1.30x)

ffmpeg -i blip.wav -af "asetrate=44100*1.35,aresample=44100" -y blip_p07.wav
echo Created blip_p07.wav (1.35x)

ffmpeg -i blip.wav -af "asetrate=44100*1.40,aresample=44100" -y blip_p08.wav
echo Created blip_p08.wav (1.40x)

ffmpeg -i blip.wav -af "asetrate=44100*1.45,aresample=44100" -y blip_p09.wav
echo Created blip_p09.wav (1.45x)

ffmpeg -i blip.wav -af "asetrate=44100*1.50,aresample=44100" -y blip_p10.wav
echo Created blip_p10.wav (1.50x)

ffmpeg -i blip.wav -af "asetrate=44100*1.55,aresample=44100" -y blip_p11.wav
echo Created blip_p11.wav (1.55x)

ffmpeg -i blip.wav -af "asetrate=44100*1.60,aresample=44100" -y blip_p12.wav
echo Created blip_p12.wav (1.60x)

ffmpeg -i blip.wav -af "asetrate=44100*1.65,aresample=44100" -y blip_p13.wav
echo Created blip_p13.wav (1.65x)

ffmpeg -i blip.wav -af "asetrate=44100*1.70,aresample=44100" -y blip_p14.wav
echo Created blip_p14.wav (1.70x)

ffmpeg -i blip.wav -af "asetrate=44100*1.75,aresample=44100" -y blip_p15.wav
echo Created blip_p15.wav (1.75x)

ffmpeg -i blip.wav -af "asetrate=44100*1.80,aresample=44100" -y blip_p16.wav
echo Created blip_p16.wav (1.80x)

ffmpeg -i blip.wav -af "asetrate=44100*1.85,aresample=44100" -y blip_p17.wav
echo Created blip_p17.wav (1.85x)

ffmpeg -i blip.wav -af "asetrate=44100*1.90,aresample=44100" -y blip_p18.wav
echo Created blip_p18.wav (1.90x)

ffmpeg -i blip.wav -af "asetrate=44100*1.95,aresample=44100" -y blip_p19.wav
echo Created blip_p19.wav (1.95x)

ffmpeg -i blip.wav -af "asetrate=44100*2.00,aresample=44100" -y blip_p20.wav
echo Created blip_p20.wav (2.00x)

echo.
echo Done! All 20 pitch variants created.
pause
