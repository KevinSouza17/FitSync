import { useEffect, useState, useCallback } from "react";
import {
  Heart, Send, Trash2, ImagePlus, X, Loader2, Plus, Pencil,
  MessageCircle, Share2, Ban, Flag, ZoomIn, Sparkles, TrendingUp, Hash, Search, Users,
} from "lucide-react";
import { AutoTextarea } from "../components/ui/textarea";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { AvatarPreview } from "../components/ui/AvatarPreview";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { StoryViewer } from "../components/StoryViewer";
import { ShareModal } from "../components/ShareModal";

interface PostWithProfile {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  media_type: string | null;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
}

interface CommentWithProfile {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

interface StoryWithProfile {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

interface SearchResult {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_professional: boolean | null;
  professional_role: string | null;
  handle: string | null;
}

type FeedTab = "foryou" | "following";

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
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

export function Feed() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [followingPosts, setFollowingPosts] = useState<PostWithProfile[]>([]);
  const [stories, setStories] = useState<StoryWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [mediaType, setMediaType] = useState<string>("image");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);
  const [storyInput, setStoryInput] = useState<HTMLInputElement | null>(null);
  const [storyUploading, setStoryUploading] = useState(false);
  const [activeStoryGroup, setActiveStoryGroup] = useState<{ userId: string; stories: StoryWithProfile[] } | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [followStatuses, setFollowStatuses] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommentWithProfile[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentLoading, setCommentLoading] = useState<Set<string>>(new Set());
  const [isBanned, setIsBanned] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [reportingPost, setReportingPost] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [reportingComment, setReportingComment] = useState<{ commentId: string; postId: string } | null>(null);
  const [commentReportReason, setCommentReportReason] = useState("");
  const [commentReportDesc, setCommentReportDesc] = useState("");
  const [commentReportSubmitting, setCommentReportSubmitting] = useState(false);
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null);
  const [feedTab, setFeedTab] = useState<FeedTab>("foryou");
  const [trendingTags, setTrendingTags] = useState<{ tag: string; post_count: number }[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagPosts, setTagPosts] = useState<PostWithProfile[]>([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [editingPost, setEditingPost] = useState<PostWithProfile | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [sharePost, setSharePost] = useState<PostWithProfile | null>(null);

  useEffect(() => {
    if (profile) {
      setIsBanned(!!profile.is_banned);
      setIsOwner(profile.role === "owner");
    }
  }, [profile]);

  const loadPosts = useCallback(async () => {
    const { data: postData } = await supabase
      .from("feed_posts")
      .select("*, profiles:user_id(full_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!postData) { setLoading(false); return; }
    const postIds = postData.map((p) => p.id);
    if (postIds.length === 0) { setPosts([]); setLoading(false); return; }
    const [{ data: likes }, { data: myLikes }, { data: commentCounts }] = await Promise.all([
      supabase.from("feed_likes").select("post_id").in("post_id", postIds),
      supabase.from("feed_likes").select("post_id").eq("user_id", user?.id ?? "").in("post_id", postIds),
      supabase.from("feed_comments").select("post_id").in("post_id", postIds),
    ]);
    const likeMap: Record<string, number> = {};
    (likes || []).forEach((l) => { likeMap[l.post_id] = (likeMap[l.post_id] || 0) + 1; });
    const myLikeSet = new Set((myLikes || []).map((l) => l.post_id));
    const commentMap: Record<string, number> = {};
    (commentCounts || []).forEach((c) => { commentMap[c.post_id] = (commentMap[c.post_id] || 0) + 1; });
    setPosts(postData.map((p) => ({
      ...p,
      profiles: p.profiles as PostWithProfile["profiles"],
      like_count: likeMap[p.id] || 0,
      liked_by_me: myLikeSet.has(p.id),
      comment_count: commentMap[p.id] || 0,
    })) as PostWithProfile[]);
    setLoading(false);
  }, [user]);

  const loadFollowingPosts = useCallback(async () => {
    if (!user) return;
    setFollowingLoading(true);
    const { data: following } = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", user.id)
      .eq("status", "accepted");
    const followedIds = (following || []).map((f) => f.followee_id);
    followedIds.push(user.id);
    if (followedIds.length === 0) { setFollowingPosts([]); setFollowingLoading(false); return; }
    const { data: postData } = await supabase
      .from("feed_posts")
      .select("*, profiles:user_id(full_name, avatar_url)")
      .in("user_id", followedIds)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!postData || postData.length === 0) { setFollowingPosts([]); setFollowingLoading(false); return; }
    const postIds = postData.map((p) => p.id);
    const [{ data: likes }, { data: myLikes }, { data: commentCounts }] = await Promise.all([
      supabase.from("feed_likes").select("post_id").in("post_id", postIds),
      supabase.from("feed_likes").select("post_id").eq("user_id", user.id).in("post_id", postIds),
      supabase.from("feed_comments").select("post_id").in("post_id", postIds),
    ]);
    const likeMap: Record<string, number> = {};
    (likes || []).forEach((l) => { likeMap[l.post_id] = (likeMap[l.post_id] || 0) + 1; });
    const myLikeSet = new Set((myLikes || []).map((l) => l.post_id));
    const commentMap: Record<string, number> = {};
    (commentCounts || []).forEach((c) => { commentMap[c.post_id] = (commentMap[c.post_id] || 0) + 1; });
    setFollowingPosts(postData.map((p) => ({
      ...p,
      profiles: p.profiles as PostWithProfile["profiles"],
      like_count: likeMap[p.id] || 0,
      liked_by_me: myLikeSet.has(p.id),
      comment_count: commentMap[p.id] || 0,
    })) as PostWithProfile[]);
    setFollowingLoading(false);
  }, [user]);

  const loadStories = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    const { data: following } = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", user.id)
      .eq("status", "accepted");
    const followedIds = (following || []).map((f) => f.followee_id);
    followedIds.push(user.id);
    if (followedIds.length === 0) { setStories([]); return; }
    const { data } = await supabase
      .from("stories")
      .select("*, profiles:user_id(full_name, avatar_url)")
      .in("user_id", followedIds)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(30);
    setStories((data ?? []) as StoryWithProfile[]);
  }, [user]);

  const loadTrending = useCallback(async () => {
    const { data } = await supabase
      .from("trending_hashtags")
      .select("tag, post_count")
      .limit(10);
    setTrendingTags((data ?? []) as { tag: string; post_count: number }[]);
  }, []);

  useEffect(() => {
    loadPosts();
    loadStories();
    loadTrending();
    loadFollowingPosts();
    const channel = supabase
      .channel("feed-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "feed_posts" }, () => { loadPosts(); if (feedTab === "following") loadFollowingPosts(); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "feed_posts" }, () => { loadPosts(); if (feedTab === "following") loadFollowingPosts(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "feed_likes" }, () => loadPosts())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "stories" }, () => loadStories())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "feed_comments" }, () => loadPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadPosts, loadStories, loadTrending, loadFollowingPosts]);

  // Debounced people search
  useEffect(() => {
    if (!searchOpen) return;
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc("search_profiles", { p_query: searchQuery.trim().replace(/^@/, ""), p_limit: 12 });
      setSearchResults((data ?? []) as SearchResult[]);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchOpen]);

  async function handleMediaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const isVideo = file.type.startsWith("video");
    if (isVideo) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.src = URL.createObjectURL(file);
      await new Promise<void>((resolve) => {
        v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(); };
        v.onerror = () => resolve();
      });
      if (v.duration > 180) {
        setError("O vídeo deve ter no máximo 3 minutos. Ele será postado no feed, mas vídeos curtos vão para os Syncs.");
        setUploading(false);
        return;
      }
      setVideoDuration(v.duration);
    } else {
      setVideoDuration(0);
    }
    const ext = file.name.split(".").pop();
    const fileName = `${user.id}/feed-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(fileName, file);
    if (upErr) { setError("Erro ao enviar arquivo"); setUploading(false); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
    const url = `${data.publicUrl}?t=${Date.now()}`;
    if (isVideo) {
      setVideoUrl(url);
      setMediaType("video");
      setImageUrl(null);
    } else {
      setImageUrl(url);
      setMediaType("image");
      setVideoUrl(null);
    }
    setUploading(false);
  }

  async function handleStoryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.type.startsWith("video")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = URL.createObjectURL(file);
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(video.src);
          resolve();
        };
        video.onerror = () => resolve();
      });
      if (video.duration > 61) {
        alert("O vídeo do story deve ter no máximo 60 segundos.");
        setStoryUploading(false);
        return;
      }
    }

    setStoryUploading(true);
    const ext = file.name.split(".").pop();
    const fileName = `${user.id}/story-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(fileName, file);
    if (upErr) { setStoryUploading(false); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
    const mediaType = file.type.startsWith("video") ? "video" : "image";
    await supabase.from("stories").insert({
      media_url: `${data.publicUrl}?t=${Date.now()}`,
      media_type: mediaType,
    });
    setStoryUploading(false);
    loadStories();
  }

  function parseHashtags(text: string): string[] {
    const matches = text.match(/#[\w\u00C0-\u024F]+/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
  }

  async function createPost(): Promise<boolean> {
    if (!content.trim() && !imageUrl && !videoUrl) { setError(t("feed.emptyError")); return false; }
    if (isBanned) { setError(t("feed.userBanned")); return false; }
    setPosting(true);
    setError("");
    const insertData: Record<string, unknown> = { content: content.trim(), media_type: mediaType };
    if (mediaType === "video" && videoUrl) insertData.video_url = videoUrl;
    else if (imageUrl) insertData.image_url = imageUrl;
    const { data, error: insertError } = await supabase
      .from("feed_posts")
      .insert(insertData)
      .select("*, profiles:user_id(full_name, avatar_url)")
      .single();
    if (insertError) {
      setError("Erro ao publicar. Tente novamente.");
      setPosting(false);
      return false;
    }
    if (data) {
      const newPost: PostWithProfile = {
        ...data,
        profiles: data.profiles as PostWithProfile["profiles"],
        like_count: 0,
        liked_by_me: false,
        comment_count: 0,
      };
      setPosts((prev) => [newPost, ...prev]);
      setFollowingPosts((prev) => [newPost, ...prev]);
      const tags = parseHashtags(content);
      if (tags.length > 0) {
        for (const tag of tags) {
          const { data: hd } = await supabase.from("hashtags").upsert({ tag }, { onConflict: "tag" }).select("id").maybeSingle();
          if (hd && data) {
            await supabase.from("post_hashtags").insert({ post_id: data.id, hashtag_id: hd.id });
          }
        }
        loadTrending();
      }
      setContent("");
      setImageUrl(null);
      setVideoUrl(null);
      setVideoDuration(0);
      setMediaType("image");

      // If it's a video ≤ 3 min, also post to Syncs
      if (mediaType === "video" && videoUrl && videoDuration > 0 && videoDuration <= 180 && data) {
        const syncFileName = `${user.id}/${Date.now()}-sync.${videoUrl.split(".").pop()?.split("?")[0] || "mp4"}`;
        // Re-upload to syncs bucket for proper CDN URL
        try {
          const resp = await fetch(videoUrl);
          const blob = await resp.blob();
          await supabase.storage.from("syncs").upload(syncFileName, blob, { contentType: blob.type });
          const { data: syncUrlData } = supabase.storage.from("syncs").getPublicUrl(syncFileName);
          await supabase.from("syncs").insert({
            user_id: user.id,
            video_url: syncUrlData.publicUrl,
            caption: content.trim() || null,
            music_track: null,
            duration_seconds: Math.round(videoDuration),
          });
        } catch {
          // Non-critical: feed post already succeeded
        }
      }
    }
    setPosting(false);
    return true;
  }

  async function toggleLike(postId: string, liked: boolean) {
    if (liked) {
      await supabase.from("feed_likes").delete().eq("post_id", postId).eq("user_id", user?.id ?? "");
    } else {
      await supabase.from("feed_likes").insert({ post_id: postId });
    }
    const updateFn = (prev: PostWithProfile[]) => prev.map((p) => p.id === postId ? {
      ...p, liked_by_me: !liked, like_count: p.like_count + (liked ? -1 : 1),
    } : p);
    setPosts(updateFn);
    setFollowingPosts(updateFn);
    setTagPosts(updateFn);
  }

  async function loadPostsByTag(tag: string) {
    setActiveTag(tag);
    setTagLoading(true);
    const { data: tagRow } = await supabase.from("hashtags").select("id").eq("tag", tag).maybeSingle();
    if (!tagRow) { setTagPosts([]); setTagLoading(false); return; }
    const { data: phData } = await supabase
      .from("post_hashtags")
      .select("post_id")
      .eq("hashtag_id", tagRow.id);
    const postIds = (phData || []).map((p) => p.post_id);
    if (postIds.length === 0) { setTagPosts([]); setTagLoading(false); return; }
    const { data: postData } = await supabase
      .from("feed_posts")
      .select("*, profiles:user_id(full_name, avatar_url)")
      .in("id", postIds)
      .order("created_at", { ascending: false })
      .limit(30);
    if (!postData || postData.length === 0) { setTagPosts([]); setTagLoading(false); return; }
    const [{ data: likes }, { data: myLikes }, { data: commentCounts }] = await Promise.all([
      supabase.from("feed_likes").select("post_id").in("post_id", postIds),
      supabase.from("feed_likes").select("post_id").eq("user_id", user?.id ?? "").in("post_id", postIds),
      supabase.from("feed_comments").select("post_id").in("post_id", postIds),
    ]);
    const likeMap: Record<string, number> = {};
    (likes || []).forEach((l) => { likeMap[l.post_id] = (likeMap[l.post_id] || 0) + 1; });
    const myLikeSet = new Set((myLikes || []).map((l) => l.post_id));
    const commentMap: Record<string, number> = {};
    (commentCounts || []).forEach((c) => { commentMap[c.post_id] = (commentMap[c.post_id] || 0) + 1; });
    setTagPosts(postData.map((p) => ({
      ...p,
      profiles: p.profiles as PostWithProfile["profiles"],
      like_count: likeMap[p.id] || 0,
      liked_by_me: myLikeSet.has(p.id),
      comment_count: commentMap[p.id] || 0,
    })) as PostWithProfile[]);
    setTagLoading(false);
  }

  async function deletePost(id: string) {
    await supabase.from("feed_posts").delete().eq("id", id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setFollowingPosts((prev) => prev.filter((p) => p.id !== id));
    setTagPosts((prev) => prev.filter((p) => p.id !== id));
  }

  function openEditPost(post: PostWithProfile) {
    setEditingPost(post);
    setEditContent(post.content);
  }

  async function saveEditPost() {
    if (!editingPost) return;
    const trimmed = editContent.trim();
    if (!trimmed && !editingPost.image_url && !editingPost.video_url) return;
    setEditSaving(true);
    const { data } = await supabase
      .from("feed_posts")
      .update({ content: trimmed })
      .eq("id", editingPost.id)
      .select("*, profiles:user_id(full_name, avatar_url)")
      .single();
    if (data) {
      const updated: PostWithProfile = {
        ...editingPost,
        ...data,
        profiles: data.profiles as PostWithProfile["profiles"],
      };
      const updateFn = (prev: PostWithProfile[]) => prev.map((p) => p.id === editingPost.id ? { ...p, content: trimmed } : p);
      setPosts(updateFn);
      setFollowingPosts(updateFn);
      setTagPosts(updateFn);
      // Re-sync hashtags
      const tags = parseHashtags(trimmed);
      await supabase.from("post_hashtags").delete().eq("post_id", editingPost.id);
      for (const tag of tags) {
        const { data: hd } = await supabase.from("hashtags").upsert({ tag }, { onConflict: "tag" }).select("id").maybeSingle();
        if (hd) {
          await supabase.from("post_hashtags").insert({ post_id: editingPost.id, hashtag_id: hd.id });
        }
      }
      loadTrending();
    }
    setEditSaving(false);
    setEditingPost(null);
    setEditContent("");
  }

  async function deletePostAsOwner(id: string) {
    await supabase.rpc("delete_post_as_owner", { p_post_id: id });
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setFollowingPosts((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleFollow(targetUserId: string) {
    if (!user) return;
    const { data } = await supabase.rpc("follow_user", { p_followee_id: targetUserId });
    const status = data || "pending";
    setFollowStatuses((prev) => ({ ...prev, [targetUserId]: status }));
  }

  async function handleUnfollow(targetUserId: string) {
    if (!user) return;
    setFollowStatuses((prev) => ({ ...prev, [targetUserId]: "" }));
    await supabase.from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("followee_id", targetUserId);
  }

  async function toggleComments(postId: string) {
    const next = new Set(expandedComments);
    if (next.has(postId)) {
      next.delete(postId);
    } else {
      next.add(postId);
      if (!commentsByPost[postId]) {
        const { data } = await supabase
          .from("feed_comments")
          .select("*, profiles:user_id(full_name, avatar_url)")
          .eq("post_id", postId)
          .order("created_at", { ascending: true });
        setCommentsByPost((prev) => ({ ...prev, [postId]: (data ?? []) as CommentWithProfile[] }));
      }
    }
    setExpandedComments(next);
  }

  async function submitComment(postId: string) {
    const text = (commentDrafts[postId] || "").trim();
    if (!text || !user) return;
    setCommentLoading((prev) => new Set(prev).add(postId));
    const { data } = await supabase
      .from("feed_comments")
      .insert({ post_id: postId, content: text })
      .select("*, profiles:user_id(full_name, avatar_url)")
      .single();
    if (data) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), data as CommentWithProfile],
      }));
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      const updateFn = (prev: PostWithProfile[]) => prev.map((p) => p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p);
      setPosts(updateFn);
      setFollowingPosts(updateFn);
      setTagPosts(updateFn);
    }
    setCommentLoading((prev) => { const n = new Set(prev); n.delete(postId); return n; });
  }

  async function deleteComment(commentId: string, postId: string) {
    await supabase.from("feed_comments").delete().eq("id", commentId);
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).filter((c) => c.id !== commentId),
    }));
    const updateFn = (prev: PostWithProfile[]) => prev.map((p) => p.id === postId ? { ...p, comment_count: p.comment_count - 1 } : p);
    setPosts(updateFn);
    setFollowingPosts(updateFn);
    setTagPosts(updateFn);
  }

  async function handleShare(post: PostWithProfile) {
    setSharePost(post);
  }

  async function handleBanUser(userId: string) {
    await supabase.rpc("ban_user", { p_target: userId, p_ban: true });
    alert(t("feed.banUser"));
  }

  async function submitReport(postId: string) {
    if (!reportReason.trim() || !user) return;
    setReportSubmitting(true);
    const { error } = await supabase.from("post_reports").insert({
      post_id: postId,
      reporter_id: user.id,
      reason: reportReason.trim(),
      description: reportDesc.trim() || null,
    });
    setReportingPost(null);
    setReportReason("");
    setReportDesc("");
    setReportSubmitting(false);
    if (error) {
      alert("Erro ao enviar denúncia: " + error.message);
    } else {
      alert("Denúncia enviada. O administrador irá analisar.");
    }
  }

  async function deleteStory(storyId: string) {
    await supabase.from("stories").delete().eq("id", storyId).eq("user_id", user?.id ?? "");
    loadStories();
  }

  async function confirmDeleteStory() {
    if (!deletingStoryId) return;
    await deleteStory(deletingStoryId);
    setDeletingStoryId(null);
  }

  async function reportComment(commentId: string, _postId: string) {
    if (!commentReportReason.trim() || !user) return;
    setCommentReportSubmitting(true);
    const { error } = await supabase.from("comment_reports").insert({
      comment_id: commentId,
      reporter_id: user.id,
      reason: commentReportReason.trim(),
      description: commentReportDesc.trim() || null,
    });
    setCommentReportSubmitting(false);
    setReportingComment(null);
    setCommentReportReason("");
    setCommentReportDesc("");
    if (error) {
      alert("Erro ao enviar denúncia. Talvez você já tenha denunciado este comentário.");
    } else {
      alert("Denúncia enviada. O administrador irá analisar.");
    }
  }

  const storiesByUser = stories.reduce((acc, s) => {
    if (!acc[s.user_id]) acc[s.user_id] = [];
    acc[s.user_id].push(s);
    return acc;
  }, {} as Record<string, StoryWithProfile[]>);

  const taCls = "w-full rounded-xl border border-edge-base bg-surface-base px-4 py-3 text-sm text-content-strong placeholder:text-content-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

  const activePosts = feedTab === "following" ? followingPosts : posts;
  const activeLoading = feedTab === "following" ? followingLoading : loading;

  function renderPostCard(post: PostWithProfile) {
    const name = post.profiles?.full_name || "Usuario";
    const isOwn = post.user_id === user?.id;
    const followStatus = followStatuses[post.user_id];
    const showComments = expandedComments.has(post.id);
    return (
      <Card key={post.id}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <AvatarPreview
                src={post.profiles?.avatar_url}
                name={name}
                userId={post.user_id}
                size="sm"
              />
              <div>
                <button onClick={() => navigate(`/profile/${post.user_id}`)} className="text-left">
                  <p className="text-sm font-semibold text-content-strong hover:underline">{name}</p>
                </button>
                <p className="text-xs text-content-muted">{timeAgo(post.created_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isOwn && (
                followStatus === "pending" || followStatus === "accepted" ? (
                  <button onClick={() => handleUnfollow(post.user_id)} className="rounded-lg px-3 py-1 text-xs font-medium text-content-muted transition-colors hover:bg-surface-subtle">
                    {followStatus === "accepted" ? t("feed.following") : t("feed.followPending")}
                  </button>
                ) : (
                  <button onClick={() => handleFollow(post.user_id)} className="rounded-lg bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600 transition-colors hover:bg-primary-100">
                    {t("feed.follow")}
                  </button>
                )
              )}
              <div className="flex items-center gap-1">
                {!isOwn && (
                  <button onClick={() => setReportingPost(post.id)} className="rounded-lg p-1.5 text-content-muted transition-colors hover:bg-amber-50 hover:text-amber-600" title="Denunciar">
                    <Flag className="h-4 w-4" />
                  </button>
                )}
                {isOwn ? (
                  <>
                    <button onClick={() => openEditPost(post)} className="rounded-lg p-1.5 text-content-muted transition-colors hover:bg-primary-50 hover:text-primary-600" title="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => deletePost(post.id)} className="rounded-lg p-1.5 text-content-muted transition-colors hover:bg-red-50 hover:text-red-600" title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : isOwner ? (
                  <>
                    <button onClick={() => handleBanUser(post.user_id)} className="rounded-lg p-1.5 text-content-muted transition-colors hover:bg-red-50 hover:text-red-600" title={t("feed.banUser")}>
                      <Ban className="h-4 w-4" />
                    </button>
                    <button onClick={() => deletePostAsOwner(post.id)} className="rounded-lg p-1.5 text-content-muted transition-colors hover:bg-red-50 hover:text-red-600" title={t("feed.deletePostModeration")}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : null}
              </div>
            </div>
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
              <img src={post.image_url} alt="" className="w-full rounded-xl object-contain" style={{ maxHeight: "600px" }} />
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 opacity-0 transition-all group-hover:bg-black/10 group-hover:opacity-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shadow-lg">
                  <ZoomIn className="h-5 w-5 text-slate-700" />
                </div>
              </div>
            </button>
          )}
          {post.video_url && (
            <video src={post.video_url} controls playsInline className="mt-3 w-full rounded-xl" />
          )}

          {/* Report modal */}
          {reportingPost === post.id && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-amber-900">Denunciar postagem</h4>
                <button onClick={() => setReportingPost(null)} className="text-amber-700 hover:text-amber-900">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="mt-3 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-content-strong focus:outline-none"
              >
                <option value="">Selecione o motivo</option>
                <option value="spam">Spam ou conteúdo repetitivo</option>
                <option value="harassment">Assédio ou bullying</option>
                <option value="inappropriate">Conteúdo inadequado</option>
                <option value="misinformation">Desinformação</option>
                <option value="violence">Ameaça ou violência</option>
                <option value="other">Outro</option>
              </select>
              <textarea
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
                placeholder="Descreva o problema (opcional)..."
                rows={2}
                className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-content-strong placeholder:text-content-muted focus:outline-none"
              />
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setReportingPost(null)}>Cancelar</Button>
                <Button size="sm" onClick={() => submitReport(post.id)} disabled={!reportReason || reportSubmitting} className="gap-2">
                  {reportSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                  Enviar denúncia
                </Button>
              </div>
            </div>
          )}

          {/* Action bar */}
          <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3">
            <button
              onClick={() => toggleLike(post.id, post.liked_by_me)}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${post.liked_by_me ? "text-rose-600" : "text-content-muted hover:text-rose-500"}`}
            >
              <Heart className={`h-4 w-4 ${post.liked_by_me ? "fill-rose-500" : ""}`} />
              {post.like_count > 0 && <span>{post.like_count}</span>}
            </button>
            <button
              onClick={() => toggleComments(post.id)}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${showComments ? "text-primary-600" : "text-content-muted hover:text-primary-500"}`}
            >
              <MessageCircle className="h-4 w-4" />
              {post.comment_count > 0 && <span>{post.comment_count}</span>}
            </button>
            <button
              onClick={() => handleShare(post)}
              className="flex items-center gap-1.5 text-sm font-medium text-content-muted transition-colors hover:text-primary-500"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          {/* Comments section */}
          {showComments && (
            <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3">
              {(commentsByPost[post.id] || []).length === 0 ? (
                <p className="text-xs text-content-muted">{t("feed.noComments")}</p>
              ) : (
                (commentsByPost[post.id] || []).map((c) => {
                  const cName = c.profiles?.full_name || "Usuario";
                  const cIsOwn = c.user_id === user?.id;
                  return (
                    <div key={c.id} className="flex items-start gap-2">
                      <AvatarPreview
                        src={c.profiles?.avatar_url}
                        name={cName}
                        userId={c.user_id}
                        size="xs"
                      />
                      <div className="flex-1">
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <div className="flex items-center justify-between">
                            <button onClick={() => navigate(`/profile/${c.user_id}`)} className="text-xs font-semibold text-content-strong hover:underline">{cName}</button>
                            <div className="flex items-center gap-2">
                              {!cIsOwn && (
                                <button onClick={() => setReportingComment({ commentId: c.id, postId: post.id })} className="text-content-muted transition-colors hover:text-amber-500" title="Denunciar comentário">
                                  <Flag className="h-3 w-3" />
                                </button>
                              )}
                              {(cIsOwn || isOwner) && (
                                <button onClick={() => deleteComment(c.id, post.id)} className="text-content-muted transition-colors hover:text-red-500">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="mt-0.5 break-words text-sm text-content-body">{c.content}</p>
                        </div>
                        <p className="mt-0.5 pl-3 text-[10px] text-content-muted">{timeAgo(c.created_at)}</p>
                      </div>
                    </div>
                  );
                })
              )}
              {!isBanned && (
                <div className="flex items-center gap-2">
                  <input
                    value={commentDrafts[post.id] || ""}
                    onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitComment(post.id); } }}
                    placeholder={t("feed.commentPlaceholder")}
                    className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                  <button
                    onClick={() => submitComment(post.id)}
                    disabled={!(commentDrafts[post.id] || "").trim() || commentLoading.has(post.id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white transition-colors hover:bg-primary-700 disabled:opacity-40"
                  >
                    {commentLoading.has(post.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col">
      {/* Sticky header with tabs */}
      <header className="sticky top-0 z-20 border-b border-edge-base bg-white/90 backdrop-blur dark:bg-surface-card/90">
        <div className="flex items-center justify-between px-4 py-2">
          <h1 className="text-lg font-bold text-content-strong">{t("feed.title")}</h1>
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-full border border-edge-base px-3 py-1.5 text-sm text-content-muted transition-colors hover:bg-surface-subtle"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Buscar pessoas</span>
          </button>
        </div>
        <nav className="flex">
          {(["foryou", "following"] as FeedTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setFeedTab(tab); if (tab === "following") loadFollowingPosts(); }}
              className={`relative flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-bold transition-colors ${feedTab === tab ? "text-content-strong" : "text-content-muted hover:text-content-body"}`}
            >
              {tab === "foryou" ? (
                <><Sparkles className="h-4 w-4" /> Para você</>
              ) : (
                <><Users className="h-4 w-4" /> Seguindo</>
              )}
              {feedTab === tab && <span className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-primary-500" />}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Trending topics */}
        {trendingTags.length > 0 && (
          <div className="rounded-xl border border-edge-base bg-surface-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary-600" />
              <h3 className="text-sm font-semibold text-content-strong">Em alta</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {trendingTags.map((tag) => (
                <button
                  key={tag.tag}
                  onClick={() => activeTag === tag.tag ? setActiveTag(null) : loadPostsByTag(tag.tag)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${activeTag === tag.tag ? "bg-primary-600 text-white shadow-sm" : "bg-primary-50 text-primary-600 hover:bg-primary-100"}`}
                >
                  <Hash className="h-3 w-3" />
                  {tag.tag}
                  <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${activeTag === tag.tag ? "bg-white/20 text-white" : "bg-primary-100 text-primary-700"}`}>
                    {tag.post_count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Hashtag-filtered posts */}
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
                {tagPosts.map((post) => renderPostCard(post))}
              </div>
            )}
          </div>
        )}

        {/* Stories bar */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          <button
            onClick={() => storyInput?.click()}
            disabled={storyUploading || isBanned}
            className="flex flex-col items-center gap-1.5"
          >
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-primary-300 bg-primary-50 transition-colors hover:border-primary-500 hover:bg-primary-100 disabled:opacity-40">
              {storyUploading ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
              ) : (
                <Plus className="h-6 w-6 text-primary-500" />
              )}
            </div>
            <span className="max-w-[64px] truncate text-[10px] font-medium text-content-muted">
              {storyUploading ? "..." : t("feed.addStory")}
            </span>
          </button>
          <input ref={(el) => setStoryInput(el)} type="file" accept="image/*,video/*" onChange={handleStoryUpload} className="hidden" />

          {Object.entries(storiesByUser).map(([uid, userStories]) => {
            const first = userStories[0];
            const name = first.profiles?.full_name || "Usuario";
            const isOwn = uid === user?.id;
            return (
              <div key={uid} className="flex flex-col items-center gap-1.5">
                <button onClick={() => { setActiveStoryGroup({ userId: uid, stories: userStories }); setActiveStoryIndex(0); }} className="relative h-16 w-16 rounded-full bg-gradient-to-tr from-primary-400 to-primary-600 p-0.5">
                  <div className="h-full w-full overflow-hidden rounded-full border-2 border-white">
                    {first.profiles?.avatar_url ? (
                      <img src={first.profiles.avatar_url} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-primary-100 text-sm font-bold text-primary-600">{initials(name)}</div>
                    )}
                  </div>
                  {isOwn && (
                    <span onClick={(e) => { e.stopPropagation(); setDeletingStoryId(first.id); }} className="absolute -right-0.5 -top-0.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-colors hover:bg-red-600">
                      <X className="h-3 w-3" />
                    </span>
                  )}
                </button>
                <span className="max-w-[64px] truncate text-[10px] font-medium text-content-muted">
                  {isOwn ? "Voce" : name.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Story viewer */}
        {activeStoryGroup && (
          <StoryViewer
            group={activeStoryGroup}
            index={activeStoryIndex}
            onIndexChange={setActiveStoryIndex}
            onClose={() => { setActiveStoryGroup(null); setActiveStoryIndex(0); }}
            allGroups={Object.entries(storiesByUser).map(([uid, ss]) => ({ userId: uid, stories: ss }))}
            onGroupChange={(g) => { setActiveStoryGroup(g); setActiveStoryIndex(0); }}
          />
        )}

        {isBanned && (
          <Card><CardContent className="flex items-center gap-3 py-4 text-sm text-red-600">
            <Ban className="h-5 w-5 shrink-0" />
            {t("feed.userBanned")}
          </CardContent></Card>
        )}

        {/* Posts */}
        {activeTag ? null : activeLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : activePosts.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center py-16 text-center">
            <Heart className="mb-3 h-12 w-12 text-slate-200" />
            <h3 className="text-base font-semibold text-content-body">
              {feedTab === "following" ? "Nada por aqui ainda" : t("feed.noPosts")}
            </h3>
            <p className="mt-1 text-sm text-content-muted">
              {feedTab === "following" ? "Siga pessoas para ver as postagens delas aqui." : t("feed.noPostsSub")}
            </p>
          </CardContent></Card>
        ) : (
          <div className="flex flex-col gap-4">
            {activePosts.map((post) => renderPostCard(post))}
          </div>
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

        {/* Floating post button */}
        {!isBanned && (
          <button
            onClick={() => setComposerOpen(true)}
            className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg shadow-primary-600/30 transition-all hover:scale-105 hover:bg-primary-700 active:scale-95"
            title={t("feed.post")}
          >
            <Plus className="h-6 w-6" />
          </button>
        )}

        {/* Post composer modal */}
        {composerOpen && !isBanned && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setComposerOpen(false)}>
            <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-edge-base bg-surface-card p-5 pb-safe shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-content-strong">{t("feed.post")}</h2>
                <button onClick={() => setComposerOpen(false)} className="rounded-full p-1.5 text-content-muted transition-colors hover:bg-surface-subtle">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-col gap-3">
                <AutoTextarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t("feed.placeholder")}
                  minRows={3}
                  className={taCls}
                />
                {imageUrl && (
                  <div className="relative">
                    <img src={imageUrl} alt="" className="max-h-64 rounded-xl object-cover" />
                    <button onClick={() => { setImageUrl(null); setMediaType("image"); }} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {videoUrl && (
                  <div className="relative">
                    <video src={videoUrl} controls className="max-h-64 rounded-xl" />
                    <button onClick={() => { setVideoUrl(null); setVideoDuration(0); setMediaType("image"); }} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {error && <p className="text-sm text-red-500">{error}</p>}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input ref={(el) => setFileInput(el)} type="file" accept="image/*,video/*" onChange={handleMediaUpload} className="hidden" />
                    <Button variant="outline" size="sm" onClick={() => fileInput?.click()} disabled={uploading} className="gap-2">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      Foto/Vídeo
                    </Button>
                  </div>
                  <Button onClick={async () => { const ok = await createPost(); if (ok) setComposerOpen(false); }} disabled={posting} className="gap-2">
                    {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {t("feed.post")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Story delete confirmation */}
        {deletingStoryId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeletingStoryId(null)}>
            <div className="w-full max-w-sm rounded-2xl bg-surface-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-bold text-content-strong">Excluir story?</h3>
              <p className="mt-1 text-sm text-content-muted">Esta ação não pode ser desfeita.</p>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setDeletingStoryId(null)}>Cancelar</Button>
                <Button size="sm" onClick={confirmDeleteStory} className="gap-2 bg-red-600 hover:bg-red-700">
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Comment report modal */}
        {reportingComment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setReportingComment(null)}>
            <div className="w-full max-w-sm rounded-2xl bg-surface-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-content-strong">Denunciar comentário</h3>
                <button onClick={() => setReportingComment(null)} className="text-content-muted hover:text-content-strong">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <select
                value={commentReportReason}
                onChange={(e) => setCommentReportReason(e.target.value)}
                className="mt-3 w-full rounded-lg border border-edge-base bg-surface-base px-3 py-2 text-sm text-content-strong focus:outline-none"
              >
                <option value="">Selecione o motivo</option>
                <option value="spam">Spam ou conteúdo repetitivo</option>
                <option value="harassment">Assédio ou bullying</option>
                <option value="inappropriate">Conteúdo inadequado</option>
                <option value="misinformation">Desinformação</option>
                <option value="violence">Ameaça ou violência</option>
                <option value="other">Outro</option>
              </select>
              <textarea
                value={commentReportDesc}
                onChange={(e) => setCommentReportDesc(e.target.value)}
                placeholder="Descreva o problema (opcional)..."
                rows={2}
                className="mt-2 w-full rounded-lg border border-edge-base bg-surface-base px-3 py-2 text-sm text-content-strong placeholder:text-content-muted focus:outline-none"
              />
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setReportingComment(null)}>Cancelar</Button>
                <Button size="sm" onClick={() => reportComment(reportingComment.commentId, reportingComment.postId)} disabled={!commentReportReason || commentReportSubmitting} className="gap-2">
                  {commentReportSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
                  Enviar denúncia
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit post modal */}
        {editingPost && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center" onClick={() => { setEditingPost(null); setEditContent(""); }}>
            <div className="w-full max-w-lg rounded-t-2xl bg-surface-card p-5 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-content-strong">Editar postagem</h2>
                <button onClick={() => { setEditingPost(null); setEditContent(""); }} className="rounded-full p-1.5 text-content-muted transition-colors hover:bg-surface-subtle">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <AutoTextarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Escreva algo..."
                minRows={3}
                className={taCls}
              />
              {(editingPost.image_url || editingPost.video_url) && (
                <p className="mt-2 text-xs text-content-muted">A mídia anexada não pode ser alterada.</p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setEditingPost(null); setEditContent(""); }}>Cancelar</Button>
                <Button size="sm" onClick={saveEditPost} disabled={editSaving} className="gap-2">
                  {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* People search modal */}
        {searchOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSearchOpen(false)}>
            <div className="mt-[10vh] w-full max-w-lg rounded-2xl bg-surface-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-content-strong">Buscar pessoas</h2>
                <button onClick={() => setSearchOpen(false)} className="rounded-full p-1.5 text-content-muted transition-colors hover:bg-surface-subtle">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <label className="flex items-center gap-3 rounded-full border border-edge-base bg-surface-base px-4 py-2.5 text-content-muted focus-within:border-primary-500">
                <Search className="h-5 w-5" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Digite o @ ou nome..."
                  className="w-full bg-transparent text-sm text-content-strong outline-none"
                  autoFocus
                />
              </label>
              <div className="mt-4 flex flex-col gap-1">
                {searchLoading ? (
                  <div className="flex h-20 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="py-8 text-center text-sm text-content-muted">
                    {searchQuery.trim() ? "Nenhum resultado encontrado." : "Comece a digitar para buscar pessoas."}
                  </p>
                ) : (
                  searchResults.map((person) => {
                    const name = person.full_name || "Usuario";
                    const handle = person.handle ? `@${person.handle}` : "";
                    return (
                      <button
                        key={person.id}
                        onClick={() => { navigate(`/profile/${person.id}`); setSearchOpen(false); }}
                        className="flex items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-surface-subtle"
                      >
                        <AvatarPreview src={person.avatar_url} name={name} userId={person.id} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-content-strong">{name}</p>
                          {handle && <p className="truncate text-xs text-content-muted">{handle}</p>}
                          {person.is_professional && person.professional_role && (
                            <p className="truncate text-xs text-primary-600">{person.professional_role}</p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
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
