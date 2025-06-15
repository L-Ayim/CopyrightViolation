import { useEffect, useRef, useState } from "react";
import { FaPause, FaPlay, FaRedo } from "react-icons/fa";

export interface Stem {
  name: string;
  url: string;
}

export function CustomPlayer({
  stems,
  selected,
  preloaded = {},
}: {
  stems: Stem[];
  selected: string[];
  preloaded?: Record<string, AudioBuffer>;
}) {
  const audioCtxRef = useRef<AudioContext>();
  const buffersRef = useRef<Record<string, AudioBuffer>>({});
  const sourcesRef = useRef<Record<string, { src: AudioBufferSourceNode; gain: GainNode }>>({});
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [played, setPlayed] = useState(0);
  const [loop, setLoop] = useState(false);

  // Initialise AudioContext
  useEffect(() => {
    audioCtxRef.current = new AudioContext();
    return () => {
      audioCtxRef.current?.close();
    };
  }, []);

  // Merge preloaded buffers on mount
  useEffect(() => {
    if (Object.keys(preloaded).length) {
      buffersRef.current = { ...buffersRef.current, ...preloaded };
      const maxDur = Math.max(
        0,
        ...Object.values(preloaded).map((b) => b.duration)
      );
      if (maxDur > 0) {
        setDuration((d) => Math.max(d, maxDur));
      }
    }
  }, [preloaded]);

  // Load buffers when a stem is first selected
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    selected.forEach((name) => {
      if (!buffersRef.current[name]) {
        const stem = stems.find((s) => s.name === name);
        if (!stem) return;
        fetch(stem.url)
          .then((r) => r.arrayBuffer())
          .then((data) => ctx.decodeAudioData(data))
          .then((buffer) => {
            buffersRef.current[name] = buffer;
            setDuration(Math.max(duration, buffer.duration));
          });
      }
    });
  }, [selected, stems, duration]);

  // Update gain when selection changes
  useEffect(() => {
    Object.entries(sourcesRef.current).forEach(([name, { gain }]) => {
      gain.gain.value = selected.includes(name) ? 1 : 0;
    });
  }, [selected]);

  const playAll = (offset = pauseOffsetRef.current) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    startTimeRef.current = now - offset;
    Object.entries(buffersRef.current).forEach(([name, buffer]) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = selected.includes(name) ? 1 : 0;
      src.connect(gain).connect(ctx.destination);
      src.start(now, offset);
      sourcesRef.current[name] = { src, gain };
    });
    setIsPlaying(true);
  };

  const pauseAll = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    pauseOffsetRef.current = Math.min(
      ctx.currentTime - startTimeRef.current,
      duration,
    );
    Object.values(sourcesRef.current).forEach(({ src }) => {
      try {
        src.stop();
      } catch {
        /* ignore */
      }
    });
    sourcesRef.current = {};
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) pauseAll();
    else playAll();
  };

  const toggleLoop = () => {
    setLoop((p) => !p);
  };

  const seekTo = (t: number) => {
    Object.values(sourcesRef.current).forEach(({ src }) => src.stop());
    sourcesRef.current = {};
    pauseOffsetRef.current = t;
    playAll(t);
  };

  useEffect(() => {
    let raf: number;
    const update = () => {
      const ctx = audioCtxRef.current;
      if (ctx && isPlaying) {
        const t = ctx.currentTime - startTimeRef.current;
        setPlayed(t);
        if (t >= duration) {
          if (loop) {
            seekTo(0);
          } else {
            pauseOffsetRef.current = duration;
            sourcesRef.current = {};
            setIsPlaying(false);
            setPlayed(duration);
          }
        } else {
          raf = requestAnimationFrame(update);
        }
      }
    };
    if (isPlaying) update();
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, loop, duration]);

  return (
    <div className="w-full max-w-lg bg-black text-yellow-400 border border-yellow-400 p-4 rounded-lg space-y-4">
      <div className="flex space-x-2">
        <button
          onClick={togglePlay}
          className="flex-1 px-4 py-2 bg-yellow-400 text-black rounded font-bold flex items-center justify-center space-x-2"
        >
          {isPlaying ? <FaPause /> : <FaPlay />}
          <span className="sr-only">{isPlaying ? "Pause" : "Play"}</span>
        </button>
        <button
          onClick={toggleLoop}
          className={`flex-1 px-4 py-2 rounded font-bold flex items-center justify-center ${loop ? 'bg-yellow-400 text-black' : 'bg-black text-yellow-400'}`}
          title="Toggle Repeat"
        >
          <FaRedo />
          <span className="sr-only">Repeat</span>
        </button>
      </div>

      <input
        type="range"
        min={0}
        max={duration}
        value={played}
        onChange={(e) => seekTo(+e.target.value)}
        className="w-full h-2 rounded bg-black"
        style={{ accentColor: "#facc15" }}
      />

      <div className="text-sm text-center">
        {new Date(played * 1000).toISOString().substr(14, 5)} /{' '}
        {new Date(duration * 1000).toISOString().substr(14, 5)}
      </div>
    </div>
  );
}
