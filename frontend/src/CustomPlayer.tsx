import { useEffect, useRef, useState } from "react";

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
  const sourcesRef = useRef<Record<string, AudioBufferSourceNode>>({});
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [played, setPlayed] = useState(0);

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

  const playAll = (offset = pauseOffsetRef.current) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;
    startTimeRef.current = now - offset;
    Object.entries(buffersRef.current)
      .filter(([name]) => selected.includes(name))
      .forEach(([name, buffer]) => {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start(now, offset);
        sourcesRef.current[name] = src;
      });
    setIsPlaying(true);
  };

  const pauseAll = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    pauseOffsetRef.current = ctx.currentTime - startTimeRef.current;
    Object.values(sourcesRef.current).forEach((src) => src.stop());
    sourcesRef.current = {};
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) pauseAll();
    else playAll();
  };

  const seekTo = (t: number) => {
    Object.values(sourcesRef.current).forEach((src) => src.stop());
    sourcesRef.current = {};
    pauseOffsetRef.current = t;
    playAll(t);
  };

  useEffect(() => {
    let raf: number;
    const update = () => {
      const ctx = audioCtxRef.current;
      if (ctx && isPlaying) {
        setPlayed(ctx.currentTime - startTimeRef.current);
        raf = requestAnimationFrame(update);
      }
    };
    if (isPlaying) update();
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  return (
    <div className="w-full max-w-lg bg-yellow-400 text-black p-4 rounded-lg space-y-4">
      <button
        onClick={togglePlay}
        className="px-4 py-2 bg-black text-yellow-400 rounded font-bold"
      >
        {isPlaying ? "❚❚ Pause" : "▶ Play"}
      </button>

      <input
        type="range"
        min={0}
        max={duration}
        value={played}
        onChange={(e) => seekTo(+e.target.value)}
        style={{ accentColor: "black" }}
        className="w-full"
      />

      <div className="text-sm">
        {new Date(played * 1000).toISOString().substr(14, 5)} /{' '}
        {new Date(duration * 1000).toISOString().substr(14, 5)}
      </div>
    </div>
  );
}
