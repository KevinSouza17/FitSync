import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

interface AudioPlayerProps {
  url: string;
  isMine: boolean;
  label?: string;
}

export function AudioPlayer({ url, isMine, label = "Áudio" }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);

  // Decode the audio to build a waveform from real amplitude data
  useEffect(() => {
    let cancelled = false;
    async function buildWaveform() {
      try {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await ctx.decodeAudioData(buf);
        const channelData = audioBuffer.getChannelData(0);
        const samples = 32;
        const blockSize = Math.floor(channelData.length / samples);
        const peaks: number[] = [];
        for (let i = 0; i < samples; i++) {
          let max = 0;
          for (let j = 0; j < blockSize; j++) {
            const v = Math.abs(channelData[i * blockSize + j] || 0);
            if (v > max) max = v;
          }
          peaks.push(max);
        }
        const maxPeak = Math.max(...peaks, 0.001);
        if (!cancelled) setWaveform(peaks.map((p) => p / maxPeak));
        ctx.close();
      } catch {
        // Fallback: synthetic waveform
        if (!cancelled) {
          const synth: number[] = [];
          for (let i = 0; i < 32; i++) {
            synth.push(0.3 + Math.random() * 0.7);
          }
          setWaveform(synth);
        }
      }
    }
    buildWaveform();
    return () => { cancelled = true; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [url]);

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }

  function onLoadedMetadata() {
    if (audioRef.current) setDuration(audioRef.current.duration || 0);
  }

  function onTimeUpdate() {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      rafRef.current = requestAnimationFrame(onTimeUpdate);
    }
  }

  function onEnded() {
    setPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="flex items-center gap-2.5 py-1">
      <audio
        ref={audioRef}
        src={url}
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="hidden"
      />
      <button
        onClick={togglePlay}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${isMine ? "bg-white/20 hover:bg-white/30" : "bg-primary-50 hover:bg-primary-100"}`}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>

      {/* Waveform */}
      <div className="flex h-9 flex-1 items-center gap-[2px]">
        {waveform.map((peak, i) => {
          const active = i / waveform.length <= progress;
          const height = Math.max(4, peak * 28);
          return (
            <div
              key={i}
              className={`w-[3px] rounded-full transition-colors ${active ? (isMine ? "bg-white" : "bg-primary-500") : (isMine ? "bg-white/40" : "bg-slate-300")}`}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>

      {/* Duration */}
      <span className={`shrink-0 text-[11px] tabular-nums ${isMine ? "text-primary-100" : "text-slate-400"}`}>
        {fmt(playing || currentTime > 0 ? currentTime : duration)}
      </span>
    </div>
  );
}
