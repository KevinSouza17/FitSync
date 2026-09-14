import { useEffect, useState, useRef, useCallback } from "react";
import {
  Heart, MessageCircle, Share2, X, Plus, Music, Play, Loader2,
  Trash2, Send, Eye, ChevronUp, ChevronDown,
} from "lucide-react";

type TouchSwipe = {
  startY: number;
  currentY: number;
  active: boolean;
};
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { AvatarPreview } from "../components/ui/AvatarPreview";
import { ShareModal } from "../components/ShareModal";

interface SyncWithProfile {
  id: string;
  user_id: string;
  video_url: string;
  caption: string | null;
  music_track: string | null;
  duration_seconds: number;
  view_count: number;
  created_at: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface SyncComment {
  id: string;
  sync_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
  return matches || [];
}

export function Syncs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [syncs, setSyncs] = useState<SyncWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedSyncs, setLikedSyncs] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [showComments, setShowComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, SyncComment[]>>({});
  const [commentDraft, setCommentDraft] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadMusic, setUploadMusic] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadDuration, setUploadDuration] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [shareSync, setShareSync] = useState<SyncWithProfile | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<TouchSwipe>({ startY: 0, currentY: 0, active: false });

  const loadSyncs = useCallback(async () => {
    setLoading(true);
    const { data: syncData } = await supabase
      .from("syncs")
      .select("*, profiles:user_id(full_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(30);

    const syncList = (syncData ?? []) as unknown as SyncWithProfile[];
    setSyncs(syncList);

    if (syncList.length > 0) {
      const syncIds = syncList.map((s) => s.id);
      const [{ data: likes }, { data: myLikes }, { data: comments }] = await Promise.all([
        supabase.from("sync_likes").select("sync_id").in("sync_id", syncIds),
        supabase.from("sync_likes").select("sync_id").eq("user_id", user?.id ?? "").in("sync_id", syncIds),
        supabase.from("sync_comments").select("sync_id").in("sync_id", syncIds),
      ]);
      const lc: Record<string, number> = {};
      (likes || []).forEach((l) => { lc[l.sync_id] = (lc[l.sync_id] || 0) + 1; });
      setLikeCounts(lc);
      setLikedSyncs(new Set((myLikes || []).map((l) => l.sync_id)));
      const cc: Record<string, number> = {};
      (comments || []).forEach((c) => { cc[c.sync_id] = (cc[c.sync_id] || 0) + 1; });
      setCommentCounts(cc);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadSyncs();
  }, [loadSyncs]);

  useEffect(() => {
    if (syncs.length === 0) return;
    const currentSync = syncs[currentIndex];
    if (!currentSync) return;
    const video = videoRefs.current[currentSync.id];
    if (!video) return;
    video.play().catch(() => {});
    Object.entries(videoRefs.current).forEach(([id, v]) => {
      if (v && id !== currentSync.id) v.pause();
    });
    const handlePlay = () => {
      supabase.rpc("increment_sync_view", { p_sync_id: currentSync.id });
      setSyncs((prev) => prev.map((s) => s.id === currentSync.id ? { ...s, view_count: s.view_count + 1 } : s));
    };
    video.addEventListener("play", handlePlay);
    return () => video.removeEventListener("play", handlePlay);
  }, [currentIndex, syncs]);

  function handleScroll(direction: "up" | "down") {
    if (direction === "down" && currentIndex < syncs.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (direction === "up" && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (showComments || showUpload || shareSync) return;
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        handleScroll("down");
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        handleScroll("up");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function toggleLike(syncId: string) {
    const wasLiked = likedSyncs.has(syncId);
    if (wasLiked) {
      await supabase.from("sync_likes").delete().eq("sync_id", syncId).eq("user_id", user?.id ?? "");
      setLikedSyncs((prev) => { const n = new Set(prev); n.delete(syncId); return n; });
      setLikeCounts((prev) => ({ ...prev, [syncId]: Math.max((prev[syncId] || 0) - 1, 0) }));
    } else {
      await supabase.from("sync_likes").insert({ sync_id: syncId, user_id: user?.id ?? "" });
      setLikedSyncs((prev) => new Set(prev).add(syncId));
      setLikeCounts((prev) => ({ ...prev, [syncId]: (prev[syncId] || 0) + 1 }));
    }
  }

  async function loadComments(syncId: string) {
    const { data } = await supabase
      .from("sync_comments")
      .select("*, profiles:user_id(full_name, avatar_url)")
      .eq("sync_id", syncId)
      .order("created_at", { ascending: true });
    setComments((prev) => ({ ...prev, [syncId]: (data ?? []) as unknown as SyncComment[] }));
  }

  async function submitComment(syncId: string) {
    const text = commentDraft.trim();
    if (!text || !user) return;
    setCommentLoading(true);
    const { data } = await supabase
      .from("sync_comments")
      .insert({ sync_id: syncId, user_id: user?.id ?? "", content: text })
      .select("*, profiles:user_id(full_name, avatar_url)")
      .single();
    if (data) {
      setComments((prev) => ({
        ...prev,
        [syncId]: [...(prev[syncId] || []), data as unknown as SyncComment],
      }));
      setCommentCounts((prev) => ({ ...prev, [syncId]: (prev[syncId] || 0) + 1 }));
      setCommentDraft("");
    }
    setCommentLoading(false);
  }

  async function deleteSync(syncId: string) {
    await supabase.from("syncs").delete().eq("id", syncId);
    setSyncs((prev) => prev.filter((s) => s.id !== syncId));
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setUploadError("Selecione um arquivo de vídeo.");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setUploadError("O vídeo deve ter no máximo 100MB.");
      return;
    }
    setUploadError("");
    setUploadFile(file);
    const previewUrl = URL.createObjectURL(file);
    setUploadPreview(previewUrl);

    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      setUploadDuration(video.duration);
      if (video.duration > 180) {
        setUploadError("O vídeo deve ter no máximo 3 minutos.");
      }
    };
    video.src = previewUrl;
  }

  async function uploadSync() {
    if (!uploadFile || !user) return;
    if (uploadDuration > 180) {
      setUploadError("O vídeo deve ter no máximo 3 minutos.");
      return;
    }
    setUploading(true);
    setUploadError("");
    const ext = uploadFile.name.split(".").pop() || "mp4";
    const fileName = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("syncs")
      .upload(fileName, uploadFile, { contentType: uploadFile.type });
    if (upErr) {
      setUploadError("Erro ao enviar vídeo. Tente novamente.");
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("syncs").getPublicUrl(fileName);
    const videoUrl = urlData.publicUrl;
    const { data } = await supabase
      .from("syncs")
      .insert({
        user_id: user.id,
        video_url: videoUrl,
        caption: uploadCaption.trim() || null,
        music_track: uploadMusic.trim() || null,
        duration_seconds: Math.round(uploadDuration),
      })
      .select("*, profiles:user_id(full_name, avatar_url)")
      .single();
    if (data) {
      setSyncs((prev) => [data as unknown as SyncWithProfile, ...prev]);
      setCurrentIndex(0);
      setLikeCounts((prev) => ({ ...prev, [data.id]: 0 }));
      setCommentCounts((prev) => ({ ...prev, [data.id]: 0 }));
    }
    setUploading(false);
    setShowUpload(false);
    setUploadFile(null);
    setUploadCaption("");
    setUploadMusic("");
    setUploadPreview(null);
    setUploadDuration(0);
  }

  const uploadModal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => { if (!uploading) setShowUpload(false); }}>
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-surface-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-edge-base px-5 py-4">
          <h2 className="text-lg font-bold text-content-strong">Novo Sync</h2>
          <button onClick={() => { if (!uploading) { setShowUpload(false); setUploadFile(null); setUploadPreview(null); setUploadError(""); } }} className="text-content-muted hover:text-content-body">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          {!uploadFile ? (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-edge-base bg-surface-base py-12 transition-colors hover:border-primary-400 hover:bg-primary-50">
              <Plus className="mb-3 h-10 w-10 text-content-muted" />
              <p className="text-sm font-semibold text-content-body">Selecione um vídeo</p>
              <p className="mt-1 text-xs text-content-muted">MP4, MOV ou WebM · Máx 3 min · Máx 100MB</p>
              <input type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />
            </label>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "9/16", maxHeight: "300px" }}>
                {uploadPreview && <video src={uploadPreview} className="h-full w-full object-contain" controls />}
              </div>
              {uploadDuration > 0 && (
                <p className="text-center text-xs text-content-muted">Duração: {Math.floor(uploadDuration / 60)}:{String(Math.floor(uploadDuration % 60)).padStart(2, "0")}</p>
              )}
              <div>
                <label className="text-sm font-medium text-content-body">Legenda</label>
                <textarea
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  placeholder="Adicione uma legenda... Use #hashtags"
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-edge-base bg-surface-base px-4 py-2.5 text-sm text-content-strong placeholder:text-content-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-content-body">Música (opcional)</label>
                <input
                  type="text"
                  value={uploadMusic}
                  onChange={(e) => setUploadMusic(e.target.value)}
                  placeholder="Ex: Nome da música - Artista"
                  className="mt-1 w-full rounded-xl border border-edge-base bg-surface-base px-4 py-2.5 text-sm text-content-strong placeholder:text-content-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
            </>
          )}
          {uploadError && (
            <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">{uploadError}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => { setUploadFile(null); setUploadPreview(null); setUploadError(""); }}
              disabled={uploading}
              className="flex-1 rounded-xl border border-edge-base px-4 py-3 text-sm font-semibold text-content-body transition-colors hover:bg-surface-subtle disabled:opacity-40"
            >
              {uploadFile ? "Trocar vídeo" : "Cancelar"}
            </button>
            {uploadFile && (
              <button
                onClick={uploadSync}
                disabled={uploading || !!uploadError}
                className="flex-1 rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-40"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</span>
                ) : (
                  "Publicar"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-black lg:h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
      </div>
    );
  }

  if (syncs.length === 0) {
    return (
      <>
        <div className="flex h-[calc(100vh-64px)] flex-col items-center justify-center bg-black lg:h-screen">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/10">
              <Play className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Nenhum Sync ainda</h2>
            <p className="mt-2 text-sm text-white/60">Seja o primeiro a postar um vídeo!</p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-6 flex items-center gap-2 rounded-full bg-primary-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-700"
            >
              <Plus className="h-5 w-5" />
              Criar Sync
            </button>
          </div>
        </div>
        {showUpload && uploadModal}
      </>
    );
  }

  const currentSync = syncs[currentIndex];
  const isOwn = currentSync?.user_id === user?.id;

  return (
    <div className="relative h-[calc(100vh-64px)] overflow-hidden bg-black lg:h-screen lg:py-0">
      <div
        ref={containerRef}
        className="relative h-full w-full"
        onWheel={(e) => {
          if (showComments || shareSync) return;
          if (e.deltaY > 30) handleScroll("down");
          else if (e.deltaY < -30) handleScroll("up");
        }}
        onTouchStart={(e) => {
          touchRef.current = { startY: e.touches[0].clientY, currentY: e.touches[0].clientY, active: true };
        }}
        onTouchMove={(e) => {
          if (!touchRef.current.active) return;
          touchRef.current.currentY = e.touches[0].clientY;
        }}
        onTouchEnd={() => {
          if (!touchRef.current.active) return;
          const delta = touchRef.current.startY - touchRef.current.currentY;
          if (Math.abs(delta) > 50) {
            if (delta > 0) handleScroll("down");
            else handleScroll("up");
          }
          touchRef.current.active = false;
        }}
      >
        {syncs.map((sync, index) => (
          <div
            key={sync.id}
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
            style={{ opacity: index === currentIndex ? 1 : 0, pointerEvents: index === currentIndex ? "auto" : "none" }}
          >
            <video
              ref={(el) => { if (el) videoRefs.current[sync.id] = el; }}
              src={sync.video_url}
              loop
              playsInline
              muted={false}
              className="h-full w-full object-cover"
              onClick={() => {
                const video = videoRefs.current[sync.id];
                if (!video) return;
                if (video.paused) video.play().catch(() => {});
                else video.pause();
              }}
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />

            {/* Right action bar */}
            <div className="absolute bottom-24 right-3 flex flex-col items-center gap-4 z-10 sm:bottom-28 sm:right-4 sm:gap-5">
              <button onClick={() => toggleLike(sync.id)} className="flex flex-col items-center gap-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm transition-transform active:scale-90">
                    <Heart className={`h-7 w-7 transition-colors ${likedSyncs.has(sync.id) ? "fill-rose-500 text-rose-500" : "text-white"}`} />
                  </div>
                  <span className="text-xs font-semibold text-white">{formatCount(likeCounts[sync.id] || 0)}</span>
                </button>

              <button
                  onClick={() => {
                    if (showComments === sync.id) setShowComments(null);
                    else { setShowComments(sync.id); loadComments(sync.id); }
                  }}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm transition-transform active:scale-90">
                    <MessageCircle className="h-7 w-7 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-white">{formatCount(commentCounts[sync.id] || 0)}</span>
                </button>

              <button
                onClick={() => setShareSync(sync)}
                className="flex flex-col items-center gap-1"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm transition-transform active:scale-90">
                  <Share2 className="h-7 w-7 text-white" />
                </div>
                <span className="text-xs font-semibold text-white">Compartilhar</span>
              </button>

              <div className="flex flex-col items-center gap-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm">
                    <Eye className="h-7 w-7 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-white">{formatCount(sync.view_count)}</span>
                </div>

              {isOwn && (
                <button onClick={() => deleteSync(sync.id)} className="flex flex-col items-center gap-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm transition-transform active:scale-90">
                    <Trash2 className="h-7 w-7 text-white" />
                  </div>
                </button>
              )}
            </div>

            {/* Bottom info */}
            <div className="absolute bottom-24 left-3 right-20 z-10 sm:bottom-28 sm:left-4 sm:right-24">
              <div className="mb-3 flex items-center gap-3">
                <AvatarPreview src={sync.profiles?.avatar_url} name={sync.profiles?.full_name || "Usuario"} userId={sync.user_id} size="sm" />
                <button onClick={() => navigate(`/profile/${sync.user_id}`)} className="text-left">
                  <p className="text-sm font-bold text-white hover:underline">{sync.profiles?.full_name || "Usuario"}</p>
                </button>
                <span className="text-xs text-white/60">{timeAgo(sync.created_at)}</span>
              </div>

              {sync.caption && (
                <p className="mb-2 text-sm leading-relaxed text-white">
                  {sync.caption.split(/(#[\w\u00C0-\u024F]+)/g).map((part, i) =>
                    part.startsWith("#") ? (
                      <span key={i} className="font-semibold text-primary-400">{part}</span>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  )}
                </p>
              )}

              {sync.music_track && (
                <div className="flex items-center gap-2 text-xs text-white/80">
                  <Music className="h-3.5 w-3.5 animate-pulse" />
                  <span className="truncate">{sync.music_track}</span>
                </div>
              )}
            </div>

            {/* Navigation arrows */}
            {index === currentIndex && (
              <>
                {currentIndex > 0 && (
                  <button
                    onClick={() => handleScroll("up")}
                    className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                  >
                    <ChevronUp className="h-6 w-6" />
                  </button>
                )}
                {currentIndex < syncs.length - 1 && (
                  <button
                    onClick={() => handleScroll("down")}
                    className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                  >
                    <ChevronDown className="h-6 w-6" />
                  </button>
                )}
              </>
            )}
          </div>
        ))}

        {/* Upload FAB - centered at bottom */}
        <button
          onClick={() => setShowUpload(true)}
          className="absolute bottom-6 left-1/2 z-30 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition-transform hover:scale-110 active:scale-90"
        >
          <Plus className="h-7 w-7" />
        </button>
      </div>

      {/* Comments drawer */}
      {showComments && currentSync && (
        <div className="absolute inset-0 z-40 flex items-end" onClick={() => setShowComments(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative max-h-[70%] w-full overflow-hidden rounded-t-2xl bg-white dark:bg-surface-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-edge-base px-4 py-3">
              <h3 className="text-base font-bold text-content-strong">Comentários</h3>
              <button onClick={() => setShowComments(null)} className="text-content-muted hover:text-content-body">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto px-4 py-3">
              {(comments[currentSync.id] || []).length === 0 ? (
                <p className="py-8 text-center text-sm text-content-muted">Nenhum comentário ainda. Seja o primeiro!</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {(comments[currentSync.id] || []).map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <AvatarPreview src={c.profiles?.avatar_url} name={c.profiles?.full_name || "Usuario"} userId={c.user_id} size="sm" />
                      <div>
                        <p className="text-sm">
                          <span className="font-semibold text-content-strong">{c.profiles?.full_name || "Usuario"}</span>{" "}
                          <span className="text-content-body">{c.content}</span>
                        </p>
                        <p className="text-xs text-content-muted">{timeAgo(c.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-edge-base p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitComment(currentSync.id); }}
                  placeholder="Adicione um comentário..."
                  className="flex-1 rounded-full border border-edge-base bg-surface-base px-4 py-2.5 text-sm text-content-strong placeholder:text-content-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
                <button
                  onClick={() => submitComment(currentSync.id)}
                  disabled={!commentDraft.trim() || commentLoading}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:opacity-40"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ShareModal
        open={!!shareSync}
        onClose={() => setShareSync(null)}
        shareUrl={`${window.location.origin}/syncs`}
        shareText={`Confira este Sync! ${shareSync?.caption || ""}`}
        mediaUrl={shareSync?.video_url}
        mediaType="video"
      />

      {/* Upload modal */}
      {showUpload && uploadModal}
    </div>
  );
}
