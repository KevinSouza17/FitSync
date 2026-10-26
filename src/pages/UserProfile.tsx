import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Heart, Trash2, Loader2, MessageCircle, Share2, Lock, Unlock,
  Users, UserPlus, UserMinus, Calendar, MapPin,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { AvatarPreview } from "../components/ui/AvatarPreview";
import { StoryViewer } from "../components/StoryViewer";
import { ShareModal } from "../components/ShareModal";
import type { StoryItem, StoryGroup } from "../components/StoryViewer";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { supabase } from "../lib/supabase";

interface ProfileData {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_private: boolean;
  is_banned: boolean;
  role: string | null;
  is_professional: boolean | null;
  professional_role: string | null;
  location_city: string | null;
  created_at: string;
}

interface PostWithProfile {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
}

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

export function UserProfile() {
  const { id: paramId } = useParams();
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState<string>("");
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [canView, setCanView] = useState(true);
  const [profileStories, setProfileStories] = useState<StoryItem[]>([]);
  const [activeStoryGroup, setActiveStoryGroup] = useState<StoryGroup | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [sharePost, setSharePost] = useState<PostWithProfile | null>(null);

  const profileId = paramId || user?.id || "";
  const isOwnProfile = profileId === user?.id;
  const myRole = profile?.role;

  useEffect(() => {
    setIsOwner(myRole === "owner");
  }, [myRole]);

  const loadData = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);

    const { data: pData } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, bio, is_private, is_banned, role, is_professional, professional_role, location_city, created_at")
      .eq("id", profileId)
      .maybeSingle();

    if (!pData) { setLoading(false); return; }
    setProfileData(pData as ProfileData);

    // Check follow status
    if (user && !isOwnProfile) {
      const { data: followData } = await supabase
        .from("follows")
        .select("status")
        .eq("follower_id", user.id)
        .eq("followee_id", profileId)
        .maybeSingle();
      setFollowStatus(followData?.status ?? "");
    }

    // Follower/following counts
    const [{ count: fCount }, { count: fgCount }] = await Promise.all([
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("followee_id", profileId).eq("status", "accepted"),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", profileId).eq("status", "accepted"),
    ]);
    setFollowerCount(fCount ?? 0);
    setFollowingCount(fgCount ?? 0);

    // Determine if viewer can see posts
    const targetPrivate = (pData as ProfileData).is_private;
    if (targetPrivate && !isOwnProfile) {
      if (followStatus === "accepted" || isOwner) {
        setCanView(true);
      } else {
        setCanView(false);
      }
    } else {
      setCanView(true);
    }

    // Load stories for this profile
    const now = new Date().toISOString();
    const { data: sData } = await supabase
      .from("stories")
      .select("*, profiles:user_id(full_name, avatar_url)")
      .eq("user_id", profileId)
      .gt("expires_at", now)
      .order("created_at", { ascending: false });
    setProfileStories((sData ?? []) as StoryItem[]);

    // Load posts
    if (canView || isOwnProfile) {
      const { data: postData } = await supabase
        .from("feed_posts")
        .select("*, profiles:user_id(full_name, avatar_url)")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (postData && postData.length > 0) {
        const postIds = postData.map((p) => p.id);
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
      } else {
        setPosts([]);
      }
    }
    setLoading(false);
  }, [profileId, user, isOwnProfile, followStatus, isOwner, canView]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleFollow() {
    if (!user) return;
    const { data } = await supabase.rpc("follow_user", { p_followee_id: profileId });
    setFollowStatus(data || "pending");
  }

  async function handleUnfollow() {
    if (!user) return;
    setFollowStatus("");
    await supabase.from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("followee_id", profileId);
  }

  async function togglePrivacy() {
    if (!profileData || !isOwnProfile) return;
    const newPrivate = !profileData.is_private;
    setProfileData({ ...profileData, is_private: newPrivate });
    await supabase.from("profiles").update({ is_private: newPrivate }).eq("id", user?.id);
  }

  async function toggleLike(postId: string, liked: boolean) {
    if (liked) {
      await supabase.from("feed_likes").delete().eq("post_id", postId).eq("user_id", user?.id ?? "");
    } else {
      await supabase.from("feed_likes").insert({ post_id: postId });
    }
    setPosts((prev) => prev.map((p) => p.id === postId ? {
      ...p, liked_by_me: !liked, like_count: p.like_count + (liked ? -1 : 1),
    } : p));
  }

  async function deletePost(id: string) {
    await supabase.from("feed_posts").delete().eq("id", id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleBanUser() {
    if (!isOwner || !profileData) return;
    const newBanned = !profileData.is_banned;
    setProfileData({ ...profileData, is_banned: newBanned });
    await supabase.rpc("ban_user", { p_target: profileId, p_ban: newBanned });
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const name = profileData?.full_name || "Usuario";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Profile header */}
      <Card>
        <CardContent className="p-0">
          <div className="h-32 w-full overflow-hidden rounded-t-2xl bg-gradient-to-br from-primary-600 via-primary-500 to-primary-400" />
          <div className="px-6 pb-5">
            <div className="flex items-start justify-between">
              <button
                onClick={() => {
                  if (profileStories.length > 0) {
                    setActiveStoryGroup({ userId: profileId, stories: profileStories });
                    setActiveStoryIndex(0);
                  }
                }}
                className={`-mt-10 shrink-0 ${profileStories.length > 0 ? "cursor-pointer" : "cursor-default"}`}
                title={profileStories.length > 0 ? "Ver stories" : undefined}
              >
                <div className={`h-20 w-20 rounded-full ring-4 ring-white shadow-lg ${profileStories.length > 0 ? "bg-gradient-to-tr from-primary-400 to-primary-600 p-0.5" : ""}`}>
                  <AvatarPreview
                    src={profileData?.avatar_url}
                    name={name}
                    size="lg"
                    className="border-2 border-white"
                    fallbackClassName="text-2xl"
                  />
                </div>
              </button>
              <div className="flex items-center gap-2">
                {isOwnProfile ? (
                  <Button variant="outline" size="sm" onClick={togglePrivacy} className="gap-2">
                    {profileData?.is_private ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    {profileData?.is_private ? t("feed.profilePrivate") : t("feed.profilePublic")}
                  </Button>
                ) : (
                  followStatus === "pending" || followStatus === "accepted" ? (
                    <Button variant="outline" size="sm" onClick={handleUnfollow} className="gap-2">
                      <UserMinus className="h-4 w-4" />
                      {followStatus === "accepted" ? t("feed.following") : t("feed.followPending")}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={handleFollow} className="gap-2">
                      <UserPlus className="h-4 w-4" />
                      {t("feed.follow")}
                    </Button>
                  )
                )}
                {isOwner && !isOwnProfile && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBanUser}
                    className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
                  >
                    {profileData?.is_banned ? t("feed.unbanUser") : t("feed.banUser")}
                  </Button>
                )}
              </div>
            </div>
            <h1 className="mt-3 text-xl font-bold text-content-strong">{name}</h1>
            {profileData?.is_professional && (
              <p className="text-sm font-medium text-primary-600">{profileData.professional_role}</p>
            )}
            {profileData?.bio && <p className="mt-2 text-sm text-content-body">{profileData.bio}</p>}
            {profileData?.location_city && (
              <p className="mt-1 flex items-center gap-1 text-xs text-content-muted">
                <MapPin className="h-3 w-3" />{profileData.location_city}
              </p>
            )}
            {profileData?.is_banned && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                {t("feed.bannedUser")}
              </p>
            )}
            {/* Stats */}
            <div className="mt-4 flex gap-5">
              <div>
                <span className="text-lg font-bold text-content-strong">{posts.length}</span>
                <span className="ml-1 text-sm text-content-muted">{t("feed.posts")}</span>
              </div>
              <div>
                <span className="text-lg font-bold text-content-strong">{followerCount}</span>
                <span className="ml-1 text-sm text-content-muted">{t("feed.followers")}</span>
              </div>
              <div>
                <span className="text-lg font-bold text-content-strong">{followingCount}</span>
                <span className="ml-1 text-sm text-content-muted">{t("feed.followingCount")}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Private profile message */}
      {!canView && !isOwnProfile ? (
        <Card><CardContent className="flex flex-col items-center py-12 text-center">
          <Lock className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-content-body">{t("feed.privateProfileMsg")}</p>
          <p className="mt-1 text-xs text-content-muted">{t("feed.follow")} + {t("feed.followPending").toLowerCase()}</p>
        </CardContent></Card>
      ) : posts.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12 text-center">
          <MessageCircle className="mb-3 h-10 w-10 text-slate-200" />
          <p className="text-sm font-medium text-content-body">{t("feed.noPosts")}</p>
        </CardContent></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => {
            const isOwn = post.user_id === user?.id;
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
                        <p className="text-sm font-semibold text-content-strong">{name}</p>
                        <p className="text-xs text-content-muted">{timeAgo(post.created_at)}</p>
                      </div>
                    </div>
                    {(isOwn || isOwner) && (
                      <button onClick={() => deletePost(post.id)} className="text-content-muted transition-colors hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {post.content && <p className="mt-3 break-words text-sm leading-relaxed text-content-body">{post.content}</p>}
                  {post.image_url && <img src={post.image_url} alt="" className="mt-3 max-h-96 rounded-xl object-cover" />}
                  <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3">
                    <button
                      onClick={() => toggleLike(post.id, post.liked_by_me)}
                      className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${post.liked_by_me ? "text-rose-600" : "text-content-muted hover:text-rose-500"}`}
                    >
                      <Heart className={`h-4 w-4 ${post.liked_by_me ? "fill-rose-500" : ""}`} />
                      {post.like_count > 0 && <span>{post.like_count}</span>}
                    </button>
                    <button className="flex items-center gap-1.5 text-sm font-medium text-content-muted hover:text-primary-500">
                      <MessageCircle className="h-4 w-4" />
                      {post.comment_count > 0 && <span>{post.comment_count}</span>}
                    </button>
                    <button onClick={() => setSharePost(post)} className="flex items-center gap-1.5 text-sm font-medium text-content-muted hover:text-primary-500">
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {/* Story viewer */}
      {activeStoryGroup && (
        <StoryViewer
          group={activeStoryGroup}
          index={activeStoryIndex}
          onIndexChange={setActiveStoryIndex}
          onClose={() => { setActiveStoryGroup(null); setActiveStoryIndex(0); }}
          allGroups={[activeStoryGroup]}
          onGroupChange={() => {}}
        />
      )}
      <ShareModal
        open={!!sharePost}
        onClose={() => setSharePost(null)}
        shareUrl={`${window.location.origin}/profile/${sharePost?.user_id}`}
        shareText={sharePost?.content || "Confira este post no FitSync!"}
        mediaUrl={sharePost?.image_url}
        mediaType="image"
      />
    </div>
  );
}
