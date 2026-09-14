import { useEffect, useState, useCallback } from "react";
import { Ban, Shield, Trash2, Loader2, Search, ShieldCheck, Flag, Check, X } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

interface UserRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_banned: boolean;
  role: string | null;
  created_at: string;
}

interface PostRow {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

interface ReportRow {
  id: string;
  post_id: string;
  reporter_id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  post: PostRow | null;
  reporter: { full_name: string | null; avatar_url: string | null } | null;
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function timeAgo(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const reasonLabels: Record<string, string> = {
  spam: "Spam ou conteúdo repetitivo",
  harassment: "Assédio ou bullying",
  inappropriate: "Conteúdo inadequado",
  misinformation: "Desinformação",
  violence: "Ameaça ou violência",
  other: "Outro",
};

export function Moderation() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"users" | "posts" | "reports">("reports");

  const isOwner = profile?.role === "owner";

  const loadData = useCallback(async () => {
    const [{ data: userData }, { data: postData }, { data: reportData }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url, is_banned, role, created_at").order("created_at", { ascending: false }),
      supabase.from("feed_posts").select("*, profiles:user_id(full_name, avatar_url)").order("created_at", { ascending: false }).limit(100),
      supabase.from("post_reports").select("*, post:post_id(*, profiles:user_id(full_name, avatar_url)), reporter:reporter_id(full_name, avatar_url)").order("created_at", { ascending: false }),
    ]);
    setUsers((userData ?? []) as UserRow[]);
    setPosts((postData ?? []) as PostRow[]);
    setReports((reportData ?? []) as unknown as ReportRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isOwner) { navigate("/dashboard"); return; }
    loadData();
  }, [isOwner, navigate, loadData]);

  async function toggleBan(userId: string, currentlyBanned: boolean) {
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_banned: !currentlyBanned } : u));
    await supabase.rpc("ban_user", { p_target: userId, p_ban: !currentlyBanned });
  }

  async function deletePost(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    await supabase.rpc("delete_post_as_owner", { p_post_id: postId });
  }

  async function resolveReport(reportId: string, action: "resolved" | "dismissed") {
    setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status: action } : r));
    await supabase.from("post_reports").update({ status: action, reviewed_at: new Date().toISOString() }).eq("id", reportId);
  }

  if (!isOwner) return null;

  const filteredUsers = users.filter((u) =>
    !search.trim() || (u.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const pendingReports = reports.filter((r) => r.status === "pending");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-content-strong">{t("feed.moderation")}</h1>
          <p className="text-sm text-content-muted">Painel do dono - banir, desbanir e moderar postagens</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab("reports")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors ${tab === "reports" ? "border-b-2 border-primary-600 text-primary-600" : "text-content-muted hover:text-content-strong"}`}
        >
          <Flag className="h-4 w-4" />
          Denúncias ({pendingReports.length})
        </button>
        <button
          onClick={() => setTab("users")}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors ${tab === "users" ? "border-b-2 border-primary-600 text-primary-600" : "text-content-muted hover:text-content-strong"}`}
        >
          Usuarios ({users.length})
        </button>
        <button
          onClick={() => setTab("posts")}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors ${tab === "posts" ? "border-b-2 border-primary-600 text-primary-600" : "text-content-muted hover:text-content-strong"}`}
        >
          Postagens ({posts.length})
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="flex h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : tab === "reports" ? (
        <div className="flex flex-col gap-3">
          {reports.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center py-12 text-center">
              <Flag className="mb-3 h-10 w-10 text-slate-200" />
              <p className="text-sm font-medium text-content-body">Nenhuma denúncia recebida</p>
            </CardContent></Card>
          ) : (
            reports.map((r) => (
              <Card key={r.id} className={r.status !== "pending" ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        {r.reporter?.avatar_url ? <AvatarImage src={r.reporter.avatar_url} alt="" /> : <AvatarFallback className="bg-primary-50 text-[10px] font-bold text-primary-600">{initials(r.reporter?.full_name || "?")}</AvatarFallback>}
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold text-content-strong">{r.reporter?.full_name || "?"}</p>
                        <p className="text-xs text-content-muted">{timeAgo(r.created_at)}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                      r.status === "pending" ? "bg-amber-50 text-amber-700" :
                      r.status === "resolved" ? "bg-green-50 text-green-700" :
                      "bg-slate-100 text-slate-500"
                    }`}>
                      {r.status === "pending" ? "Pendente" : r.status === "resolved" ? "Resolvido" : "Ignorado"}
                    </span>
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-content-muted">Motivo: {reasonLabels[r.reason] || r.reason}</p>
                    {r.description && <p className="mt-1 text-sm text-content-body">{r.description}</p>}
                  </div>
                  {r.post && (
                    <div className="mt-3 rounded-xl bg-surface-subtle p-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          {r.post.profiles?.avatar_url ? <AvatarImage src={r.post.profiles.avatar_url} alt="" /> : <AvatarFallback className="bg-primary-50 text-[10px] font-bold text-primary-600">{initials(r.post.profiles?.full_name || "?")}</AvatarFallback>}
                        </Avatar>
                        <p className="text-xs font-semibold text-content-strong">{r.post.profiles?.full_name || "?"}</p>
                      </div>
                      {r.post.content && <p className="mt-2 break-words text-sm text-content-body">{r.post.content}</p>}
                      {r.post.image_url && <img src={r.post.image_url} alt="" className="mt-2 max-h-60 w-full rounded-lg object-contain" />}
                      {r.post.video_url && <video src={r.post.video_url} controls className="mt-2 max-h-60 w-full rounded-lg" />}
                    </div>
                  )}
                  {r.status === "pending" && (
                    <div className="mt-3 flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => resolveReport(r.id, "dismissed")} className="gap-1.5">
                        <X className="h-3.5 w-3.5" /> Ignorar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { if (r.post) { deletePost(r.post.id); } resolveReport(r.id, "resolved"); }} className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" /> Excluir post
                      </Button>
                      {r.post && (
                        <Button size="sm" variant="outline" onClick={() => { toggleBan(r.post.user_id, false); resolveReport(r.id, "resolved"); }} className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50">
                          <Ban className="h-3.5 w-3.5" /> Banir usuário
                        </Button>
                      )}
                      <Button size="sm" onClick={() => resolveReport(r.id, "resolved")} className="gap-1.5">
                        <Check className="h-3.5 w-3.5" /> Resolver
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : tab === "users" ? (
        <div className="flex flex-col gap-2">
          {filteredUsers.map((u) => (
            <Card key={u.id}>
              <CardContent className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {u.avatar_url ? <AvatarImage src={u.avatar_url} alt={u.full_name || ""} /> : <AvatarFallback className="bg-primary-50 text-sm font-bold text-primary-600">{initials(u.full_name || "?")}</AvatarFallback>}
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-content-strong">{u.full_name || "Sem nome"}</p>
                      {u.role === "owner" && <ShieldCheck className="h-3.5 w-3.5 text-primary-600" />}
                      {u.is_banned && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">{t("feed.bannedUser")}</span>}
                    </div>
                    <p className="text-xs text-content-muted">{timeAgo(u.created_at)}</p>
                  </div>
                </div>
                {u.role !== "owner" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleBan(u.id, u.is_banned)}
                    className={`gap-2 ${u.is_banned ? "border-green-200 text-green-600 hover:bg-green-50" : "border-red-200 text-red-600 hover:bg-red-50"}`}
                  >
                    {u.is_banned ? t("feed.unbanUser") : t("feed.banUser")}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {posts.filter((p) => !search.trim() || (p.content || "").toLowerCase().includes(search.toLowerCase()) || (p.profiles?.full_name || "").toLowerCase().includes(search.toLowerCase())).map((p) => (
            <Card key={p.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      {p.profiles?.avatar_url ? <AvatarImage src={p.profiles.avatar_url} alt="" /> : <AvatarFallback className="bg-primary-50 text-[10px] font-bold text-primary-600">{initials(p.profiles?.full_name || "?")}</AvatarFallback>}
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-content-strong">{p.profiles?.full_name || "?"}</p>
                      <p className="text-xs text-content-muted">{timeAgo(p.created_at)}</p>
                    </div>
                  </div>
                  <button onClick={() => deletePost(p.id)} className="rounded-lg p-1.5 text-content-muted transition-colors hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {p.content && <p className="mt-2 break-words text-sm text-content-body">{p.content}</p>}
                {p.image_url && <img src={p.image_url} alt="" className="mt-2 max-h-60 w-full rounded-lg object-contain" />}
                {p.video_url && <video src={p.video_url} controls className="mt-2 max-h-60 w-full rounded-lg" />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
