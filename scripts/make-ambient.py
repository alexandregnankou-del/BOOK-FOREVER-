"""Génère une boucle ambient douce (48 s) pour la lecture — 100 % synthétisée, libre de droits."""
import numpy as np
import wave
import os

SR = 44100
BPM = 56
BEAT = 60 / BPM
BAR = 4 * BEAT

CHORDS = [
    [220.00, 261.63, 329.63],   # Am
    [174.61, 220.00, 261.63],   # F
    [261.63, 329.63, 392.00],   # C
    [196.00, 246.94, 293.66],   # G
]

MELODY = [
    (0.5, 659.25), (2.5, 587.33), (3.0, 523.25),
    (4.5, 523.25), (6.0, 440.00),
    (8.5, 587.33), (10.0, 523.25),
    (12.5, 493.88), (14.0, 440.00),
]

total = 16 * BAR
n = int(total * SR)
t = np.arange(n) / SR
left = np.zeros(n)
right = np.zeros(n)


def pad(freq, dur, amp=0.16):
    m = int(dur * SR)
    x = np.arange(m) / SR
    env = np.minimum(1.0, x / 1.8) * np.minimum(1.0, (dur - x) / 2.2)
    env = np.clip(env, 0, 1) ** 1.4
    vib = 1 + 0.0018 * np.sin(2 * np.pi * 0.23 * x)
    sig = np.zeros(m)
    for k, a in ((1, 1.0), (2, 0.32), (3, 0.14), (4, 0.06)):
        sig += a * np.sin(2 * np.pi * freq * k * vib * x)
    return amp * env * sig


def bell(freq, dur=3.2, amp=0.10):
    m = int(dur * SR)
    x = np.arange(m) / SR
    env = np.exp(-x * 1.9) * (1 - np.exp(-x * 60))
    sig = np.sin(2 * np.pi * freq * x) + 0.3 * np.sin(2 * np.pi * freq * 2.01 * x)
    return amp * env * sig


for bar in range(16):
    start = int(bar * BAR * SR)
    chord = CHORDS[bar % 4]
    for i, f in enumerate(chord):
        p = pad(f, BAR * 1.05, amp=0.13 if i == 0 else 0.085)
        m = min(len(p), n - start)
        pan = 0.5 + (i - 1) * 0.22
        left[start:start + m] += p[:m] * (1 - pan)
        right[start:start + m] += p[:m] * pan

for beat, freq in MELODY:
    start = int(beat * BEAT * SR) % n
    b = bell(freq)
    m = min(len(b), n - start)
    left[start:start + m] += b[:m] * 0.7
    right[start:start + m] += b[:m] * 0.7

# réverbération douce : quelques échos décroissants
for delay_ms, gain in ((137, 0.30), (239, 0.20), (347, 0.13)):
    d = int(SR * delay_ms / 1000)
    left[d:] += gain * left[:-d].copy()
    right[d:] += gain * right[:-d].copy()

# lissage du raccord de boucle (fondu croisé 1,2 s)
fade = int(1.2 * SR)
env = np.ones(n)
env[:fade] = np.linspace(0, 1, fade)
env[-fade:] = np.linspace(1, 0, fade)
left *= env
right *= env

peak = max(np.abs(left).max(), np.abs(right).max())
left = (left / peak) * 0.30
right = (right / peak) * 0.30

stereo = np.stack([left, right], axis=1)
pcm = (stereo * 32767).astype(np.int16)

os.makedirs('public/audio', exist_ok=True)
with wave.open('public/audio/lecture.wav', 'w') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

print(f'boucle : {total:.1f} s · {n} échantillons · WAV écrit')
