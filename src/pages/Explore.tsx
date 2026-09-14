import { useEffect, useState, useCallback } from "react";
import {
  Heart, MessageCircle, Share2, X, Loader2, TrendingUp, Hash,
  Sparkles, Flame, Eye, ZoomIn,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { AvatarPreview } from "../components/ui/AvatarPreview";
import { ShareModal } from "../components/ShareModal";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

interface RecommendedPost {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  media_type: string | null;
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
  recommendation_score: number;
  recommendation_reason: string | null;
}

interface TrendingPost {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  media_type: string | null;
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
  trending_score: number;
}

interface TrendingTag {
  tag: string;
  posts_24h: number;
  posts_7d: number;
  likes_24h: number;
  comments_24h: number;
  trending_score: number;
  post_count: number;
}

interface UserInterest {
  tag: string;
  interest_score: number;
}

type ExploreTab = "trending" | "recommended";

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

function formatScore(score: number): string {
  if (score >= 1000) return `${(score / 1000).toFixed(1)}k`;
  return Math.round(score).toString();
}

export function Explore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<ExploreTab>("trending");
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<TrendingPost[]>([]);
  const [recommendedPosts, setRecommendedPosts] = useState<RecommendedPost[]>([]);
  const [userInterests, setUserInterests] = useState<UserInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagPosts, setTagPosts] = useState<RecommendedPost[]>([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [sharePost, setSharePost] = useState<RecommendedPost | TrendingPost | null>(null);

  const loadTrendingTags = useCallback(async () => {
    const { data } = await supabase
      .from("trending_hashtags_enhanced")
      .select("tag, posts_24h, posts_7d, likes_24h, comments_24h, trending_score, post_count")
      .limit(15);
    setTrendingTags((data ?? []) as TrendingTag[]);
  }, []);

  const loadTrendingPosts = useCallback(async () => {
    const { data } = await supabase.rpc("get_trending_posts", { p_limit: 20 });
    setTrendingPosts((data ?? []) as TrendingPost[]);
    const posts = (data ?? []) as TrendingPost[];
    if (posts.length > 0) {
      const postIds = posts.map((p) => p.id);
      const [{ data: likes }, { data: myLikes }, { data: comments }] = await Promise.all([
        supabase.from("feed_likes").select("post_id").in("post_id", postIds),
        supabase.from("feed_likes").select("post_id").eq("user_id", user?.id ?? "").in("post_id", postIds),
        supabase.from("feed_comments").select("post_id").in("post_id", postIds),
      ]);
      const lc: Record<string, number> = {};
      (likes || []).forEach((l) => { lc[l.post_id] = (lc[l.post_id] || 0) + 1; });
      const cc: Record<string, number> = {};
      (comments || []).forEach((c) => { cc[c.post_id] = (cc[c.post_id] || 0) + 1; });
      setLikeCounts(lc);
      setCommentCounts(cc);
      setLikedPosts(new Set((myLikes || []).map((l) => l.post_id)));
    }
  }, [user]);

  const loadRecommendedPosts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc("get_recommended_posts", { p_user_id: user.id, p_limit: 20 });
    setRecommendedPosts((data ?? []) as RecommendedPost[]);
    const posts = (data ?? []) as RecommendedPost[];
    if (posts.length > 0) {
      const postIds = posts.map((p) => p.id);
      const [{ data: likes }, { data: myLikes }, { data: comments }] = await Promise.all([
        supabase.from("feed_likes").select("post_id").in("post_id", postIds),
        supabase.from("feed_likes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
        supabase.from("feed_comments").select("post_id").in("post_id", postIds),
      ]);
      const lc: Record<string, number> = {};
      (likes || []).forEach((l) => { lc[l.post_id] = (lc[l.post_id] || 0) + 1; });
      const cc: Record<string, number> = {};
      (comments || []).forEach((c) => { cc[c.post_id] = (cc[c.post_id] || 0) + 1; });
      setLikeCounts(lc);
      setCommentCounts(cc);
      setLikedPosts(new Set((myLikes || []).map((l) => l.post_id)));
    }
  }, [user]);

  const loadUserInterests = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc("get_user_interests", { p_user_id: user.id });
    setUserInterests((data ?? []) as UserInterest[]);
  }, [user]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([
        loadTrendingTags(),
        loadTrendingPosts(),
        loadUserInterests(),
      ]);
      if (user) await loadRecommendedPosts();
      setLoading(false);
    }
    load();
  }, [loadTrendingTags, loadTrendingPosts, loadRecommendedPosts, loadUserInterests, user]);

  async function toggleLike(postId: string) {
    const wasLiked = likedPosts.has(postId);
    if (wasLiked) {
      await supabase.from("feed_likes").delete().eq("post_id", postId).eq("user_id", user?.id ?? "");
      setLikedPosts((prev) => { const n = new Set(prev); n.delete(postId); return n; });
      setLikeCounts((prev) => ({ ...prev, [postId]: Math.max((prev[postId] || 0) - 1, 0) }));
    } else {
      await supabase.from("feed_likes").insert({ post_id: postId });
      setLikedPosts((prev) => new Set(prev).add(postId));
      setLikeCounts((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
    }
  }

  async function loadPostsByTag(tag: string) {
    setActiveTag(tag);
    setTagLoading(true);
    const { data: tagRow } = await supabase.from("hashtags").select("id").eq("tag", tag).maybeSingle();
    if (!tagRow) { setTagPosts([]); setTagLoading(false); return; }
    const { data: phData } = await supabase.from("post_hashtags").select("post_id").eq("hashtag_id", tagRow.id);
    const postIds = (phData || []).map((p) => p.post_id);
    if (postIds.length === 0) { setTagPosts([]); setTagLoading(false); return; }
    const { data: postData } = await supabase
      .from("feed_posts")
      .select("*, profiles:user_id(full_name, avatar_url)")
      .in("id", postIds)
      .order("created_at", { ascending: false })
      .limit(30);
    setTagPosts((postData ?? []).map((p) => ({
      ...p,
      full_name: p.profiles?.full_name ?? null,
      avatar_url: p.profiles?.avatar_url ?? null,
      recommendation_score: 0,
      recommendation_reason: null,
    })) as RecommendedPost[]);
    setTagLoading(false);
  }

  async function handleShare(post: RecommendedPost | TrendingPost) {
    setSharePost(post);
  }

  function renderPostCard(
    post: RecommendedPost | TrendingPost,
    score: number,
    reason: string | null,
  ) {
    const name = post.full_name || "Usuario";
    const isLiked = likedPosts.has(post.id);
    const likes = likeCounts[post.id] || 0;
    const comments = commentCounts[post.id] || 0;

    return (
      <Card key={post.id}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <AvatarPreview src={post.avatar_url} name={name} userId={post.user_id} size="sm" />
              <div>
                <button onClick={() => navigate(`/profile/${post.user_id}`)} className="text-left">
                  <p className="text-sm font-semibold text-content-strong hover:underline">{name}</p>
                </button>
                <p className="text-xs text-content-muted">{timeAgo(post.created_at)}</p>
              </div>
            </div>
            {reason && (
              <span className="flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-600">
                <Sparkles className="h-3 w-3" />
                {reason}
              </span>
            )}
          </div>

          {post.content && (
            <p className="mt-3 break-words text-sm leading-relaxed text-content-body">
              {post.content.split(/(#[\w\u00C0-\u024F]+)/g).map((part, i) =>
                part.startsWith("#") ? (
                  <button
                    key={i}
                    onClick={() => loadPostsByTag(part.slice(1).toLowerCase())}
                    className="font-medium text-primary-600 hover:underline"
                  >
                    {part}
                  </button>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </p>
          )}

          {post.image_url && (
            <button onClick={() => setLightboxUrl(post.image_url)} className="group relative mt-3 block w-full">
              <img src={post.image_url} alt="" className="w-full rounded-xl object-contain" style={{ maxHeight: "500px" }} />
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 opacity-0 transition-all group-hover:bg-black/10 group-hover:opacity-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shadow-lg">
                  <ZoomIn className="h-5 w-5 text-slate-700" />
                </div>
              </div>
            </button>
          )}
          {post.video_url && <video src={post.video_url} controls playsInline className="mt-3 w-full rounded-xl" />}

          <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3">
            <button
              onClick={() => toggleLike(post.id)}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${isLiked ? "text-rose-600" : "text-content-muted hover:text-rose-500"}`}
            >
              <Heart className={`h-4 w-4 ${isLiked ? "fill-rose-500" : ""}`} />
              {likes > 0 && <span>{likes}</span>}
            </button>
            <a
              href={`/feed`}
              onClick={(e) => { e.preventDefault(); navigate("/feed"); }}
              className="flex items-center gap-1.5 text-sm font-medium text-content-muted transition-colors hover:text-primary-500"
            >
              <MessageCircle className="h-4 w-4" />
              {comments > 0 && <span>{comments}</span>}
            </a>
            <button
              onClick={() => handleShare(post)}
              className="flex items-center gap-1.5 text-sm font-medium text-content-muted transition-colors hover:text-primary-500"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-content-muted">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              {formatScore(score)}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activePosts = activeTag ? tagPosts : tab === "trending" ? trendingPosts : recommendedPosts;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      <header className="sticky top-0 z-20 border-b border-edge-base bg-white/90 backdrop-blur dark:bg-surface-card/90">
        <div className="flex items-center justify-between px-4 py-2">
          <h1 className="text-lg font-bold text-content-strong">Explorar</h1>
        </div>
        <nav className="flex">
          {(["trending", "recommended"] as ExploreTab[]).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => { setTab(tabKey); setActiveTag(null); }}
              className={`relative flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-bold transition-colors ${tab === tabKey ? "text-content-strong" : "text-content-muted hover:text-content-body"}`}
            >
              {tabKey === "trending" ? (
                <><Flame className="h-4 w-4" /> Em alta</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Para voce</>
              )}
              {tab === tabKey && <span className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-primary-500" />}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex flex-col gap-4 px-4 py-4">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : (
          <>
            {/* User interests (only on recommended tab) */}
            {tab === "recommended" && userInterests.length > 0 && !activeTag && (
              <div className="rounded-xl border border-primary-200 bg-primary-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary-600" />
                  <h3 className="text-sm font-semibold text-content-strong">Seus interesses</h3>
                </div>
                <p className="mb-3 text-xs text-content-muted">Com base nas postagens que voce curte e comenta</p>
                <div className="flex flex-wrap gap-2">
                  {userInterests.slice(0, 8).map((interest) => (
                    <button
                      key={interest.tag}
                      onClick={() => loadPostsByTag(interest.tag)}
                      className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-100"
                    >
                      <Hash className="h-3 w-3" />
                      {interest.tag}
                      <span className="ml-1 rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] text-primary-700">
                        {Math.round(interest.interest_score)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending hashtags */}
            {trendingTags.length > 0 && !activeTag && (
              <div className="rounded-xl border border-edge-base bg-surface-card p-4">
                <div className="mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary-600" />
                  <h3 className="text-sm font-semibold text-content-strong">Trending topics</h3>
                </div>
                <div className="flex flex-col gap-1.5">
                  {trendingTags.slice(0, 8).map((tag, i) => (
                    <button
                      key={tag.tag}
                      onClick={() => loadPostsByTag(tag.tag)}
                      className="flex items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-surface-subtle"
                    >
                      <span className="w-5 text-sm font-bold text-content-muted">{i + 1}</span>
                      <div className="flex-1">
                        <p className="flex items-center gap-1 text-sm font-semibold text-content-strong">
                          <Hash className="h-3.5 w-3.5 text-primary-600" />
                          {tag.tag}
                        </p>
                        <p className="text-xs text-content-muted">
                          {tag.posts_24h} posts hoje · {tag.likes_24h} curtidas · {tag.comments_24h} comentarios
                        </p>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] font-bold text-orange-500">
                        <Flame className="h-3.5 w-3.5" />
                        {formatScore(tag.trending_score)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active tag filter */}
            {activeTag && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-1.5 text-base font-semibold text-content-strong">
                    <Hash className="h-4 w-4 text-primary-600" />
                    {activeTag}
                  </h2>
                  <button onClick={() => setActiveTag(null)} className="text-sm text-content-muted hover:text-content-body">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {tagLoading ? (
                  <div className="flex h-40 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                  </div>
                ) : tagPosts.length === 0 ? (
                  <Card><CardContent className="py-12 text-center text-sm text-content-muted">
                    Nenhuma postagem com esta hashtag ainda.
                  </CardContent></Card>
                ) : (
                  <div className="flex flex-col gap-4">
                    {tagPosts.map((post) => renderPostCard(post, post.recommendation_score, post.recommendation_reason))}
                  </div>
                )}
              </div>
            )}

            {/* Posts list */}
            {!activeTag && (
              activePosts.length === 0 ? (
                <Card><CardContent className="flex flex-col items-center py-16 text-center">
                  <Sparkles className="mb-3 h-12 w-12 text-slate-200" />
                  <h3 className="text-base font-semibold text-content-body">
                    {tab === "trending" ? "Nada em alta agora" : "Nenhuma recomendacao ainda"}
                  </h3>
                  <p className="mt-1 text-sm text-content-muted">
                    {tab === "trending"
                      ? "As postagens mais populares das ultimas 24h aparecerão aqui."
                      : "Curta e comente postagens para recebermos recomendacoes personalizadas."}
                  </p>
                </CardContent></Card>
              ) : (
                <div className="flex flex-col gap-4">
                  {tab === "trending"
                    ? (activePosts as TrendingPost[]).map((post) =>
                        renderPostCard(post, post.trending_score, null))
                    : (activePosts as RecommendedPost[]).map((post) =>
                        renderPostCard(post, post.recommendation_score, post.recommendation_reason))}
                </div>
              )
            )}
          </>
        )}

        {/* Photo lightbox */}
        {lightboxUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setLightboxUrl(null)}>
            <button className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20">
              <X className="h-6 w-6" />
            </button>
            <img src={lightboxUrl} alt="" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          </div>
        )}
      </div>
      <ShareModal
        open={!!sharePost}
        onClose={() => setSharePost(null)}
        shareUrl={`${window.location.origin}/profile/${sharePost?.user_id}`}
        shareText={sharePost?.content || "Confira este post no FitSync!"}
        mediaUrl={sharePost?.video_url || sharePost?.image_url}
        mediaType={sharePost?.video_url ? "video" : "image"}
      />
    </div>
  );
}
