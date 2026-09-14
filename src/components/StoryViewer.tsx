import { useEffect, useState, useRef } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export interface StoryItem {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

export interface StoryGroup {
  userId: string;
  stories: StoryItem[];
}

interface StoryViewerProps {
  group: StoryGroup;
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  allGroups: StoryGroup[];
  onGroupChange: (g: StoryGroup) => void;
}

const IMAGE_STORY_DURATION = 5000;
const VIDEO_STORY_DURATION = 60000;

export function StoryViewer({ group, index, onIndexChange, onClose, allGroups, onGroupChange }: StoryViewerProps) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pausedRef = useRef(false);

  const story = group.stories[index];
  const groupIdx = allGroups.findIndex((g) => g.userId === group.userId);

  function nextStory() {
    if (index < group.stories.length - 1) {
      onIndexChange(index + 1);
    } else if (groupIdx < allGroups.length - 1) {
      onGroupChange(allGroups[groupIdx + 1]);
    } else {
      onClose();
    }
  }

  function prevStory() {
    if (index > 0) {
      onIndexChange(index - 1);
    } else if (groupIdx > 0) {
      const prevGroup = allGroups[groupIdx - 1];
      onGroupChange(prevGroup);
      onIndexChange(prevGroup.stories.length - 1);
    }
  }

  function handleClick(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) {
      prevStory();
    } else {
      nextStory();
    }
  }

  function handlePauseDown() {
    pausedRef.current = true;
    if (videoRef.current) videoRef.current.pause();
  }

  function handlePauseUp() {
    pausedRef.current = false;
    if (videoRef.current) videoRef.current.play().catch(() => {});
  }

  // Progress timer
  useEffect(() => {
    setProgress(0);
    pausedRef.current = false;
    if (story?.media_type === "video" && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
    const duration = story?.media_type === "video" ? VIDEO_STORY_DURATION : IMAGE_STORY_DURATION;
    const start = Date.now();
    timerRef.current = window.setInterval(() => {
      if (pausedRef.current) return;
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p);
      if (p >= 1) {
        if (timerRef.current) clearInterval(timerRef.current);
        nextStory();
      }
    }, 50);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.userId, index]);

  // Keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") nextStory();
      if (e.key === "ArrowLeft") prevStory();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, group]);

  if (!story) return null;
  const name = story.profiles?.full_name || "Usuario";

  function storyTimeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `${mins}min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* Close */}
      <button onClick={onClose} className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-2 text-white backdrop-blur transition-colors hover:bg-white/20">
        <X className="h-5 w-5" />
      </button>

      {/* Nav arrows (desktop) */}
      <button onClick={prevStory} className="absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition-colors hover:bg-white/20 md:block">
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button onClick={nextStory} className="absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition-colors hover:bg-white/20 md:block">
        <ChevronRight className="h-6 w-6" />
      </button>

      {/* Story container */}
      <div className="relative h-full w-full max-w-md" onClick={handleClick} onPointerDown={handlePauseDown} onPointerUp={handlePauseUp} onPointerLeave={handlePauseUp}>
        {/* Progress bars */}
        <div className="absolute left-0 right-0 top-0 z-10 flex gap-1 p-3">
          {group.stories.map((_, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full rounded-full bg-white transition-all duration-75"
                style={{ width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute left-0 right-0 top-6 z-10 flex items-center gap-2 px-4 pt-2">
          {story.profiles?.avatar_url ? (
            <img src={story.profiles.avatar_url} alt={name} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
              {name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}
            </div>
          )}
          <span className="text-sm font-semibold text-white drop-shadow">{name}</span>
          <span className="ml-1.5 text-xs text-white/70 drop-shadow">{storyTimeAgo(story.created_at)}</span>
        </div>

        {/* Media */}
        {story.media_type === "video" ? (
          <video
            ref={videoRef}
            src={story.media_url}
            autoPlay
            playsInline
            className="h-full w-full object-contain"
            onEnded={nextStory}
          />
        ) : (
          <img src={story.media_url} alt="" className="h-full w-full object-contain" />
        )}

        {/* Caption */}
        {story.caption && (
          <p className="absolute bottom-20 left-4 right-4 z-10 rounded-lg bg-black/40 px-4 py-2 text-sm text-white backdrop-blur">
            {story.caption}
          </p>
        )}

        {/* Tap hint */}
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-[11px] text-white/50">
          Toque na esquerda/direita para navegar · Segure para pausar
        </div>
      </div>
    </div>
  );
}
