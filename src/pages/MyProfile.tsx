import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, Pencil, Heart, MessageCircle,
  ShieldCheck, X, Grid3X3, Trophy, Flame, Target, Calendar,
  TrendingUp, UserPlus, Sparkles,
} from "lucide-react";
import { AvatarPreview } from "../components/ui/AvatarPreview";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

interface ProfilePost {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
}

interface SuggestedProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_professional: boolean | null;
  professional_role: string | null;
}

interface StreakData {
  current_streak: number;
  longest_streak: number;
}

type ProfileTab = "posts" | "media";

function joinedDate(value: string | undefined) {
  if (!value) return "agosto de 2026";
  return new Date(value).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function MyProfile() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [suggested, setSuggested] = useState<SuggestedProfile[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);

  const loadProfileData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: rawPosts }, { count: followersCount }, { count: followingCount }, { data: streakData }] = await Promise.all([
      supabase.from("feed_posts").select("id, user_id, content, image_url, video_url, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("followee_id", user.id).eq("status", "accepted"),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", user.id).eq("status", "accepted"),
      supabase.from("diet_streaks").select("current_streak, longest_streak").eq("user_id", user.id).maybeSingle(),
    ]);

    const postRows = rawPosts ?? [];
    const postIds = postRows.map((post) => post.id);
    let likeCounts: Record<string, number> = {};
    let commentCounts: Record<string, number> = {};
    if (postIds.length > 0) {
      const [{ data: likes }, { data: comments }] = await Promise.all([
        supabase.from("feed_likes").select("post_id").in("post_id", postIds),
        supabase.from("feed_comments").select("post_id").in("post_id", postIds),
      ]);
      likeCounts = (likes ?? []).reduce<Record<string, number>>((map, like) => ({ ...map, [like.post_id]: (map[like.post_id] ?? 0) + 1 }), {});
      commentCounts = (comments ?? []).reduce<Record<string, number>>((map, comment) => ({ ...map, [comment.post_id]: (map[comment.post_id] ?? 0) + 1 }), {});
    }

    setPosts(postRows.map((post) => ({
      ...post,
      like_count: likeCounts[post.id] ?? 0,
      comment_count: commentCounts[post.id] ?? 0,
    })) as ProfilePost[]);
    setFollowers(followersCount ?? 0);
    setFollowing(followingCount ?? 0);
    setStreak(streakData as StreakData | null);

    const { data: suggestions } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, is_professional, professional_role")
      .neq("id", user.id)
      .limit(4);
    setSuggested((suggestions ?? []) as SuggestedProfile[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadProfileData(); }, [loadProfileData]);

  const name = profile?.full_name || user?.email?.split("@")[0] || "Usuario";
  const handle = profile?.handle ? `@${profile.handle}` : `@${name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "fitsync"}`;
  const visiblePosts = activeTab === "media" ? posts.filter((post) => post.image_url || post.video_url) : posts;
  const filteredSuggestions = suggested.filter((person) => (person.full_name ?? "").toLowerCase().includes(search.toLowerCase()));
  const mediaCount = posts.filter((p) => p.image_url || p.video_url).length;

  return (
    <div className="min-h-full bg-surface-base">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* Back + title */}
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Voltar" className="rounded-full p-2 transition-colors hover:bg-surface-subtle">
            <ArrowLeft className="h-5 w-5 text-content-body" />
          </button>
          <h1 className="text-xl font-bold text-content-strong">Meu perfil</h1>
          <button onClick={() => navigate("/settings")} className="ml-auto rounded-full p-2 transition-colors hover:bg-surface-subtle">
            <Search className="h-5 w-5 text-content-body" />
          </button>
        </div>

        {/* Profile hero card */}
        <Card className="overflow-hidden border-edge-base">
          <div className="relative h-36 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 sm:h-44">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.15),transparent_60%)]" />
          </div>
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div className="-mt-16 rounded-2xl border-4 border-surface-card bg-surface-card shadow-md dark:border-surface-card">
                  <AvatarPreview src={profile?.avatar_url} name={name} size="lg" className="h-24 w-24 rounded-2xl border-0" fallbackClassName="text-3xl" />
                </div>
                <div className="pb-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold text-content-strong">{name}</h2>
                    {profile?.is_professional && <ShieldCheck className="h-5 w-5 fill-sky-500 text-white" />}
                  </div>
                  <p className="text-sm text-content-muted">{handle}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/profile")} className="gap-1.5 self-start rounded-full sm:self-auto">
                <Pencil className="h-4 w-4" /> Editar perfil
              </Button>
            </div>

            {profile?.bio && <p className="mt-4 text-sm leading-relaxed text-content-body">{profile.bio}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-content-muted">
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Entrou em {joinedDate(profile?.created_at)}</span>
              {profile?.location_city && <span className="flex items-center gap-1.5">{profile.location_city}</span>}
            </div>

            <div className="mt-4 flex gap-6 text-sm">
              <button onClick={() => setActiveTab("posts")} className="hover:underline">
                <strong className="text-content-strong">{following}</strong> <span className="text-content-muted">Seguindo</span>
              </button>
              <button onClick={() => setActiveTab("posts")} className="hover:underline">
                <strong className="text-content-strong">{followers}</strong> <span className="text-content-muted">Seguidores</span>
              </button>
              <button onClick={() => setActiveTab("posts")} className="hover:underline">
                <strong className="text-content-strong">{posts.length}</strong> <span className="text-content-muted">Postagens</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Flame} label="Sequência" value={streak ? `${streak.current_streak} dias` : "0 dias"} color="text-orange-500" bg="bg-orange-50 dark:bg-orange-950/30" />
          <StatCard icon={Trophy} label="Recorde" value={streak ? `${streak.longest_streak} dias` : "0 dias"} color="text-amber-500" bg="bg-amber-50 dark:bg-amber-950/30" />
          <StatCard icon={Target} label="Meta diária" value={`${profile?.daily_calorie_goal ?? 0} kcal`} color="text-emerald-500" bg="bg-emerald-50 dark:bg-emerald-950/30" />
          <StatCard icon={TrendingUp} label="Postagens" value={`${posts.length}`} color="text-sky-500" bg="bg-sky-50 dark:bg-sky-950/30" />
        </div>

        {/* Setup checklist */}
        <Card className="mt-4 border-edge-base">
          <CardContent className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-content-strong">
              <Sparkles className="h-5 w-5 text-primary-500" />
              Complete seu perfil
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SetupCard icon={Pencil} color="from-emerald-500 to-teal-400" title="Editar dados" onClick={() => navigate("/profile")} />
              <SetupCard icon={UserPlus} color="from-sky-500 to-cyan-400" title="Siga pessoas" onClick={() => navigate("/feed")} />
              <SetupCard icon={Target} color="from-amber-400 to-orange-500" title="Defina metas" onClick={() => navigate("/goals")} />
              <SetupCard icon={Trophy} color="from-rose-500 to-pink-500" title="Conquistas" onClick={() => navigate("/achievements")} />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="mt-6 flex gap-1 border-b border-edge-base">
          {(["posts", "media"] as ProfileTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors ${activeTab === tab ? "text-content-strong" : "text-content-muted hover:text-content-body"}`}
            >
              {tab === "posts" ? <><Grid3X3 className="h-4 w-4" /> Postagens</> : <><Heart className="h-4 w-4" /> Mídia ({mediaCount})</>}
              {activeTab === tab && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary-500" />}
            </button>
          ))}
        </div>

        {/* Posts grid */}
        {loading ? (
          <div className="flex h-32 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" /></div>
        ) : visiblePosts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-semibold text-content-body">Ainda não há publicações</p>
            <p className="mt-1 text-sm text-content-muted">Compartilhe sua primeira conquista no Feed.</p>
            <Button size="sm" className="mt-4" onClick={() => navigate("/feed")}>Ir para o Feed</Button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visiblePosts.map((post) => (
              <button
                key={post.id}
                onClick={() => post.image_url && setLightbox(post.image_url)}
                className="group relative aspect-square overflow-hidden rounded-xl bg-surface-subtle text-left"
              >
                {post.image_url ? (
                  <img src={post.image_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : post.video_url ? (
                  <video src={post.video_url} className="h-full w-full object-cover" muted />
                ) : (
                  <div className="flex h-full items-center justify-center bg-primary-50 p-3 dark:bg-primary-950/30">
                    <p className="line-clamp-5 text-center text-xs text-content-body">{post.content}</p>
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/45 group-hover:opacity-100">
                  <span className="flex items-center gap-1 text-sm font-bold"><Heart className="h-4 w-4 fill-white" />{post.like_count}</span>
                  <span className="flex items-center gap-1 text-sm font-bold"><MessageCircle className="h-4 w-4" />{post.comment_count}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Suggestions */}
        <Card className="mt-6 border-edge-base">
          <CardContent className="p-5">
            <h3 className="mb-3 text-base font-bold text-content-strong">Pessoas sugeridas</h3>
            <div className="flex flex-col gap-1">
              {filteredSuggestions.map((person) => {
                const personName = person.full_name || "Usuario";
                return (
                  <button
                    key={person.id}
                    onClick={() => navigate(`/profile/${person.id}`)}
                    className="flex items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-surface-subtle"
                  >
                    <AvatarPreview src={person.avatar_url} name={personName} userId={person.id} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-content-strong">{personName}</p>
                      {person.is_professional && person.professional_role && (
                        <p className="truncate text-xs text-primary-600">{person.professional_role}</p>
                      )}
                    </div>
                    <span className="rounded-full bg-primary-600 px-3 py-1.5 text-xs font-bold text-white">Seguir</span>
                  </button>
                );
              })}
              {filteredSuggestions.length === 0 && <p className="py-4 text-sm text-content-muted">Nenhuma sugestão encontrada.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <button className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white">
            <X className="h-6 w-6" />
          </button>
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: { icon: typeof Flame; label: string; value: string; color: string; bg: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl ${bg} p-4`}>
      <Icon className={`h-6 w-6 ${color}`} />
      <div>
        <p className="text-lg font-bold text-content-strong">{value}</p>
        <p className="text-xs text-content-muted">{label}</p>
      </div>
    </div>
  );
}

function SetupCard({ icon: Icon, color, title, onClick }: { icon: typeof Pencil; color: string; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group text-left">
      <div className={`flex aspect-[1.15] items-center justify-center rounded-xl bg-gradient-to-br ${color} text-white shadow-sm transition-transform group-hover:-translate-y-0.5`}>
        <Icon className="h-7 w-7" />
      </div>
      <p className="mt-2 text-xs font-bold leading-snug text-content-body">{title}</p>
    </button>
  );
}
