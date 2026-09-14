import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp, ArrowDown, Scale, Trophy, ChevronRight } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { WeightLog } from "../lib/types";
import { useI18n } from "../context/I18nContext";

export function Progress() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("progress-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "weight_logs" },
        () => loadData()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" },
        () => loadData()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from("weight_logs")
      .select("*")
      .order("logged_date", { ascending: false })
      .limit(30);
    if (data) setWeightLogs(data.reverse());
    setLoading(false);
  }

  const latest = weightLogs[weightLogs.length - 1];
  const prev = weightLogs[weightLogs.length - 2];
  const weightDiff = latest && prev ? (Number(latest.weight_kg) - Number(prev.weight_kg)).toFixed(1) : null;
  const height = profile?.height_cm;
  const bmi = latest && height ? (Number(latest.weight_kg) / ((height / 100) ** 2)).toFixed(1) : null;
  const goalWeight = profile?.goal_weight_kg;
  const weightToGoal = latest && goalWeight ? (Number(latest.weight_kg) - goalWeight).toFixed(1) : null;

  const maxWeight = weightLogs.length > 0 ? Math.max(...weightLogs.map((w) => Number(w.weight_kg))) : 80;
  const minWeight = weightLogs.length > 0 ? Math.min(...weightLogs.map((w) => Number(w.weight_kg))) : 60;
  const range = maxWeight - minWeight || 1;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-bold text-content-strong">{t("progress.title")}</h1>
        <p className="mt-0.5 text-sm text-content-muted">{t("progress.subtitle")}</p>
      </header>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              {
                label: "Peso atual",
                value: latest ? `${latest.weight_kg} kg` : "–",
                diff: weightDiff ? `${Number(weightDiff) > 0 ? "+" : ""}${weightDiff} kg` : null,
                up: weightDiff ? Number(weightDiff) > 0 : false,
              },
              {
                label: "IMC",
                value: bmi ?? "–",
                diff: null,
                up: false,
              },
              {
                label: "Para o objetivo",
                value: weightToGoal ? `${weightToGoal} kg` : "–",
                diff: goalWeight ? `Meta: ${goalWeight} kg` : null,
                up: false,
              },
              {
                label: "Registros",
                value: String(weightLogs.length),
                diff: "total de pesagens",
                up: true,
              },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="p-5">
                  <p className="text-xs text-content-muted">{s.label}</p>
                  <p className="mt-1 text-2xl font-bold text-content-strong">{s.value}</p>
                  {s.diff && (
                    <div className={`mt-1 flex items-center gap-1 text-xs font-medium ${s.up ? "text-green-600" : "text-primary-600"}`}>
                      {typeof s.up === "boolean" && s.diff.startsWith("+") && <ArrowUp className="h-3 w-3" />}
                      {typeof s.up === "boolean" && s.diff.startsWith("-") && <ArrowDown className="h-3 w-3" />}
                      {s.diff}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* Weight chart */}
            <Card>
              <CardContent className="p-5">
                <h2 className="mb-4 text-base font-semibold text-content-strong">Histórico de Peso</h2>
                {weightLogs.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <Scale className="mb-2 h-10 w-10 text-slate-200" />
                    <p className="text-sm text-content-muted">Nenhum peso registrado ainda</p>
                    <p className="mt-1 text-xs text-content-muted">Registre seu peso no Dashboard para ver o gráfico</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex items-end gap-1.5" style={{ height: "160px" }}>
                      {weightLogs.slice(-14).map((log, i) => {
                        const chartH = 130;
                        const h = Math.max(8, ((Number(log.weight_kg) - minWeight) / range) * chartH + 16);
                        const isLast = i === weightLogs.slice(-14).length - 1;
                        return (
                          <div key={log.id} className="group relative flex flex-1 flex-col items-center justify-end">
                            <div
                              className={`w-full rounded-t-md transition-all ${isLast ? "bg-primary-600" : "bg-primary-200"}`}
                              style={{ height: `${h}px` }}
                            />
                            <span className="mt-1 text-[10px] text-content-muted truncate" style={{ writingMode: "vertical-rl" }}>
                              {new Date(log.logged_date).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" })}
                            </span>
                            <div className="absolute bottom-full mb-1 hidden rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:block whitespace-nowrap">
                              {log.weight_kg} kg
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Weight history list */}
            <Card>
              <CardContent className="p-5">
                <h2 className="mb-4 text-base font-semibold text-content-strong">Registros Recentes</h2>
                {weightLogs.length === 0 ? (
                  <p className="py-4 text-center text-sm text-content-muted">Nenhum registro encontrado</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                    {[...weightLogs].reverse().map((log, i) => {
                      const prev = [...weightLogs].reverse()[i + 1];
                      const diff = prev ? (Number(log.weight_kg) - Number(prev.weight_kg)).toFixed(1) : null;
                      return (
                        <div key={log.id} className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-surface-base">
                          <div>
                            <p className="text-sm font-medium text-content-strong">{log.weight_kg} kg</p>
                            <p className="text-xs text-content-muted">
                              {new Date(log.logged_date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                            </p>
                          </div>
                          {diff !== null && (
                            <span className={`flex items-center gap-1 text-xs font-medium ${Number(diff) > 0 ? "text-red-500" : Number(diff) < 0 ? "text-green-600" : "text-content-muted"}`}>
                              {Number(diff) > 0 ? <ArrowUp className="h-3 w-3" /> : Number(diff) < 0 ? <ArrowDown className="h-3 w-3" /> : null}
                              {Number(diff) !== 0 ? `${Number(diff) > 0 ? "+" : ""}${diff} kg` : "Igual"}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Link to="/achievements">
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                  <Trophy className="h-6 w-6 text-amber-500" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-content-strong">Conquistas</h2>
                  <p className="mt-0.5 text-sm text-content-muted">Veja suas medalhas e marcos desbloqueados</p>
                </div>
                <ChevronRight className="h-5 w-5 text-content-muted" />
              </CardContent>
            </Card>
          </Link>
        </>
      )}
    </div>
  );
}
