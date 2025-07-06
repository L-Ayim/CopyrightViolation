// src/components/CustomPlayer.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { FaPause, FaPlay, FaRedo } from "react-icons/fa";
import { PitchShifter } from "soundtouchjs";
import { toast } from "react-toastify";

// Exported as a type so TS erases it in the emitted JS
export type Stem = {
  name: string;
  url: string;
};

export default function CustomPlayer({
  stems,
  selected,
  preloaded = {},
}: {
  stems: Stem[];
  selected: string[];
  preloaded?: Record<string, AudioBuffer>;
}) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const buffersRef = useRef<Record<string, AudioBuffer>>({});
  const sourcesRef = useRef<Record<string, { shifter: PitchShifter; gain: GainNode }>>({});
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

  // Merge any preloaded buffers
  useEffect(() => {
    if (Object.keys(preloaded).length) {
      buffersRef.current = { ...buffersRef.current, ...preloaded };
      const maxDur = Math.max(0, ...Object.values(preloaded).map((b) => b.duration));
      if (maxDur > 0) setDuration((d) => Math.max(d, maxDur));
    }
  }, [preloaded]);

  // Fetch & decode stems on demand
  useEffect(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    selected.forEach((name) => {
      if (!buffersRef.current[name]) {
        const stem = stems.find((s) => s.name === name);
        if (!stem) return;

        fetch(stem.url)
          .then((r) => {
            if (!r.ok) throw new Error(`Network error ${r.status}`);
            return r.arrayBuffer();
          })
          .then((data) => ctx.decodeAudioData(data))
          .then((buffer) => {
            buffersRef.current[name] = buffer;
            setDuration((d) => Math.max(d, buffer.duration));
            toast.success(`Loaded stem: ${name}`);
          })
          .catch((err) => {
            console.error("Error loading stem", name, err);
            toast.error(`Failed to load ${name}: ${err.message}`);
          });
      }
    });
  }, [selected, stems]);

  // Update gains when selection changes
  useEffect(() => {
    Object.entries(sourcesRef.current).forEach(([name, { gain }]) => {
      gain.gain.value = selected.includes(name) ? 1 : 0;
    });
  }, [selected]);

  // Play all loaded buffers
  const playAll = useCallback(
    (offset = pauseOffsetRef.current) => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const now = ctx.currentTime;
      startTimeRef.current = now - offset;

      Object.entries(buffersRef.current).forEach(([name, buffer]) => {
        const shifter = new PitchShifter(ctx, buffer, 1024);
        shifter.pitchSemitones = 0;
        shifter.tempo = 1;

        const gain = ctx.createGain();
        gain.gain.value = selected.includes(name) ? 1 : 0;

        shifter.connect(gain);
        gain.connect(ctx.destination);
        shifter.percentagePlayed = offset / buffer.duration;
        shifter.on("play", (d: { timePlayed: number }) => setPlayed(d.timePlayed));

        sourcesRef.current[name] = { shifter, gain };
      });

      setIsPlaying(true);
      toast.info("Playback started");
    },
    [selected]
  );

  // Pause all
  const pauseAll = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    pauseOffsetRef.current = Math.min(played, duration);
    Object.values(sourcesRef.current).forEach(({ shifter }) => {
      try {
        shifter.disconnect();
      } catch {
        // ignore errors during disconnect
      }
    });
    sourcesRef.current = {};
    setIsPlaying(false);
    toast.info("Playback paused");
  }, [played, duration]);

  const togglePlay = () => (isPlaying ? pauseAll() : playAll());
  const toggleLoop = () => setLoop((p) => !p);

  const seekTo = useCallback(
    (t: number) => {
      Object.values(sourcesRef.current).forEach(({ shifter }) => shifter.disconnect());
      sourcesRef.current = {};
      pauseOffsetRef.current = t;
      playAll(t);
      toast.info(`Seeked to ${Math.floor(t)}s`);
    },
    [playAll]
  );

  // Handle end-of-track
  useEffect(() => {
    if (!isPlaying) return;
    if (played >= duration) {
      if (loop) seekTo(0);
      else {
        pauseOffsetRef.current = duration;
        sourcesRef.current = {};
        setIsPlaying(false);
        toast.info("Playback ended");
      }
    }
  }, [played, isPlaying, loop, duration, seekTo]);

  return (
    <div className="w-full max-w-lg mx-auto bg-black text-yellow-400 border border-yellow-400 p-4 rounded-lg space-y-4">
      <div className="flex space-x-2">
        <button
          onClick={togglePlay}
          className={`flex-1 px-4 py-2 rounded font-bold flex items-center justify-center space-x-2 ${
            isPlaying ? "bg-yellow-400 text-black" : "bg-black text-yellow-400"
          }`}
        >
          {isPlaying ? <FaPause /> : <FaPlay />}
          <span className="sr-only">{isPlaying ? "Pause" : "Play"}</span>
        </button>
        <button
          onClick={toggleLoop}
          className={`flex-1 px-4 py-2 rounded font-bold flex items-center justify-center ${
            loop ? "bg-yellow-400 text-black" : "bg-black text-yellow-400"
          }`}
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
        {new Date(played * 1000).toISOString().substr(14, 5)} /{" "}
        {new Date(duration * 1000).toISOString().substr(14, 5)}
      </div>
    </div>
  );
}
