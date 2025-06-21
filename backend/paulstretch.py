import numpy as np
import soundfile as sf
from pathlib import Path


def paulstretch_wav(src: Path, dst: Path, stretch: float = 8.0, window: float = 0.25) -> None:
    data, sr = sf.read(src)
    if data.ndim > 1:
        data = data.mean(axis=1)
    windowsize = int(window * sr)
    if windowsize < 16:
        windowsize = 16
    windowsize = windowsize // 2 * 2
    half = windowsize // 2

    end_size = int(sr * 0.05)
    if end_size < 16:
        end_size = 16
    if len(data) >= end_size:
        data[-end_size:] *= np.linspace(1, 0, end_size)

    start_pos = 0.0
    displace_pos = (windowsize * 0.5) / stretch
    window_arr = 0.5 - np.cos(np.arange(windowsize, dtype=float) * 2.0 * np.pi / (windowsize - 1)) * 0.5
    old_buf = np.zeros(windowsize)
    hinv_sqrt2 = (1 + np.sqrt(0.5)) * 0.5
    hinv_buf = hinv_sqrt2 - (1.0 - hinv_sqrt2) * np.cos(
        np.arange(half, dtype=float) * 2.0 * np.pi / half
    )

    out = []
    while True:
        istart_pos = int(np.floor(start_pos))
        buf = data[istart_pos : istart_pos + windowsize]
        if len(buf) < windowsize:
            buf = np.concatenate([buf, np.zeros(windowsize - len(buf))])
        buf *= window_arr
        freqs = np.abs(np.fft.rfft(buf))
        ph = np.random.uniform(0, 2 * np.pi, len(freqs)) * 1j
        freqs *= np.exp(ph)
        buf = np.fft.irfft(freqs)
        buf *= window_arr
        output = buf[:half] + old_buf[half:windowsize]
        old_buf = buf
        output *= hinv_buf
        output = np.clip(output, -1.0, 1.0)
        out.append(output)
        start_pos += displace_pos
        if start_pos >= len(data):
            break
    out_data = np.concatenate(out)
    sf.write(dst, out_data, sr)
