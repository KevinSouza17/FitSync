import { useEffect, useState } from "react";
import { Trophy, Lock, Star, Flame, Target, Users, Dumbbell, Droplets, ChefHat, Newspaper, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

interface Achievement {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  tier: string;
  xp_reward: number;
}

interface UserAchievement {
  achievement_id: string;
  earned_at: string;
}

const iconMap: Record<string, typeof Trophy> = {
  Trophy, Flame, Target, Users, Dumbbell, Droplets, ChefHat, Newspaper, UtensilsCrossed, Star,
};

const tierColors: Record<string, { bg: string; ring: string; text: string; label: string }> = {
  bronze: { bg: "bg-amber-50", ring: "ring-amber-200", text: "text-amber-600", label: "Bronze" },
  silver: { bg: "bg-slate-100", ring: "ring-slate-300", text: "text-slate-500", label: "Prata" },
  gold: { bg: "bg-yellow-50", ring: "ring-yellow-300", text: "text-yellow-600", label: "Ouro" },
};

export function Achievements() {
  const { user } = useAuth();
  const [all, setAll] = useState<Achievement[]>([]);
  const [earned, setEarned] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (user) {
        await supabase.rpc("check_and_grant_achievements", { p_user_id: user.id });
      }
      const [{ data: achievements }, { data: userAch }] = await Promise.all([
        supabase.from("achievements").select("*").order("tier").order("title"),
        supabase.from("user_achievements").select("achievement_id, earned_at").eq("user_id", user?.id ?? ""),
      ]);
      setAll(achievements ?? []);
      const map: Record<string, string> = {};
      (userAch ?? []).forEach((u: UserAchievement) => { map[u.achievement_id] = u.earned_at; });
      setEarned(map);
      setLoading(false);
    })();
  }, [user]);

  const earnedCount = Object.keys(earned).length;
  const totalXp = all.filter((a) => earned[a.id]).reduce((s, a) => s + a.xp_reward, 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-content-strong">
          <Trophy className="h-7 w-7 text-yellow-500" />
          Conquistas
        </h1>
        <p className="mt-0.5 text-sm text-content-muted">Desbloqueie conquistas enquanto evolui</p>
      </header>

      {/* Progress summary */}
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg">
            <Trophy className="h-8 w-8 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-content-muted">Progresso geral</p>
            <p className="text-2xl font-bold text-content-strong">{earnedCount} / {all.length}</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
              <div className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all" style={{ width: `${all.length ? (earnedCount / all.length) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-content-muted">XP Total</p>
            <p className="text-xl font-bold text-primary-600">{totalXp}</p>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {all.map((a) => {
            const isEarned = !!earned[a.id];
            const Icon = iconMap[a.icon] ?? Trophy;
            const tier = tierColors[a.tier] ?? tierColors.bronze;
            return (
              <Card key={a.id} className={`transition-all ${isEarned ? "" : "opacity-60"}`}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${isEarned ? `${tier.bg} ring-2 ${tier.ring}` : "bg-surface-subtle"}`}>
                    {isEarned ? <Icon className={`h-7 w-7 ${tier.text}`} /> : <Lock className="h-6 w-6 text-content-muted" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-content-strong">{a.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${tier.bg} ${tier.text}`}>{tier.label}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-content-muted">{a.description}</p>
                    {isEarned && (
                      <p className="mt-1 text-[10px] font-medium text-emerald-600">
                        Conquistado em {new Date(earned[a.id]).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-content-muted">+{a.xp_reward}</p>
                    <p className="text-[10px] font-medium text-content-muted">XP</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
