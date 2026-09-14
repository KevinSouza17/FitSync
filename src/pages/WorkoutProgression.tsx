import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, Dumbbell, Calendar, Activity } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

interface WorkoutLog {
  id: string;
  exercise_name: string;
  sets_completed: number;
  reps_per_set: string;
  weight_kg: number;
  logged_date: string;
}

const W = 760;
const H = 320;
const PAD = { top: 24, right: 24, bottom: 48, left: 56 };

export function WorkoutProgression() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("workout_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("logged_date", { ascending: true });
      setLogs((data as WorkoutLog[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const exercises = useMemo(
    () => Array.from(new Set(logs.map((l) => l.exercise_name))).sort(),
    [logs]
  );

  useEffect(() => {
    if (exercises.length && !selected) setSelected(exercises[0]);
  }, [exercises, selected]);

  const series = useMemo(() => {
    const filtered = logs.filter((l) => l.exercise_name === selected);
    // Group by day, taking max weight per day
    const byDay = new Map<string, { date: string; weight: number; sets: number; reps: string }>();
    filtered.forEach((l) => {
      const existing = byDay.get(l.logged_date);
      if (!existing || l.weight_kg > existing.weight) {
        byDay.set(l.logged_date, {
          date: l.logged_date,
          weight: l.weight_kg,
          sets: l.sets_completed,
          reps: l.reps_per_set,
        });
      }
    });
    return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [logs, selected]);

  const dailySeries = series;

  const stats = useMemo(() => {
    if (!dailySeries.length) return null;
    const weights = dailySeries.map((s) => s.weight);
    const max = Math.max(...weights);
    const current = weights[weights.length - 1];
    const first = weights[0];
    const change = Number((current - first).toFixed(1));
    return { max, current, first, change, sessions: dailySeries.length };
  }, [dailySeries]);

  const fmtDate = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString(
      lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US",
      { day: "2-digit", month: "short" }
    );

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/workout")}
          className="w-fit -ml-2 text-content-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("back")}
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-content-strong">{t("workout.progression")}</h1>
            <p className="text-sm text-content-muted">{t("workout.progressionChart")}</p>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Dumbbell className="mb-3 h-12 w-12 text-content-muted opacity-40" />
            <p className="text-base font-medium text-content-strong">{t("workout.noLogs")}</p>
            <Button className="mt-4" onClick={() => navigate("/workout")}>
              {t("back")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-sm font-medium text-content-body">{t("workout.selectExercise")}</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-lg border border-edge-base bg-surface-card px-3 py-2 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 sm:w-72"
            >
              {exercises.map((ex) => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
          </div>

          {stats && dailySeries.length > 0 && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                icon={<TrendingUp className="h-4 w-4" />}
                label={t("workout.maxWeight")}
                value={`${stats.max} kg`}
              />
              <StatCard
                icon={<Calendar className="h-4 w-4" />}
                label={t("workout.lastSession")}
                value={`${stats.current} kg`}
              />
              <StatCard
                icon={<Activity className="h-4 w-4" />}
                label={t("workout.totalSessions")}
                value={String(stats.sessions)}
              />
              <StatCard
                icon={<Dumbbell className="h-4 w-4" />}
                label={t("workout.weightKg")}
                value={`${stats.change > 0 ? "+" : ""}${stats.change} kg`}
                accent={stats.change > 0 ? "up" : stats.change < 0 ? "down" : "neutral"}
              />
            </div>
          )}

          {dailySeries.length > 1 && (
            <Card>
              <CardContent className="p-4 sm:p-6">
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
                  <Chart series={dailySeries} fmtDate={fmtDate} />
                </svg>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-edge-base text-left text-xs uppercase tracking-wide text-content-muted">
                      <th className="pb-3 pr-4 font-medium">
                        <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{t("workout.lastSession")}</span>
                      </th>
                      <th className="pb-3 px-4 font-medium">{t("workout.weightKg")}</th>
                      <th className="pb-3 px-4 font-medium">Sets</th>
                      <th className="pb-3 pl-4 font-medium">Reps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...dailySeries].reverse().map((s, i) => (
                      <tr key={i} className="border-b border-edge-base last:border-0 hover:bg-surface-subtle">
                        <td className="py-3 pr-4 text-content-body">{fmtDate(s.date)}</td>
                        <td className="py-3 px-4 font-medium text-content-strong">{s.weight} kg</td>
                        <td className="py-3 px-4 text-content-body">{s.sets}</td>
                        <td className="py-3 pl-4 text-content-body">{s.reps}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "up" | "down" | "neutral";
}) {
  const accentColor =
    accent === "up" ? "text-green-600" : accent === "down" ? "text-red-500" : "text-content-strong";
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2 text-content-muted">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-subtle text-primary-600">
            {icon}
          </span>
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className={`mt-2 text-2xl font-bold ${accentColor}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Chart({ series, fmtDate }: { series: { date: string; weight: number }[]; fmtDate: (d: string) => string }) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const weights = series.map((s) => s.weight);
  const rawMax = Math.max(...weights);
  const rawMin = Math.min(...weights);
  const span = rawMax - rawMin || 1;
  const pad = span * 0.15;
  const yMax = rawMax + pad;
  const yMin = Math.max(0, rawMin - pad);
  const ySpan = yMax - yMin || 1;

  const n = series.length;
  const x = (i: number) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / ySpan) * innerH;

  const linePath = series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(s.weight).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${x(n - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;

  const gridLines = 5;
  const ticks = Array.from({ length: gridLines }, (_, i) => yMin + (ySpan * i) / (gridLines - 1));

  return (
    <>
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(99 102 241)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="rgb(99 102 241)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgb(79 70 229)" />
          <stop offset="100%" stopColor="rgb(139 92 246)" />
        </linearGradient>
      </defs>

      {ticks.map((tick, i) => {
        const ty = y(tick);
        return (
          <g key={i}>
            <line x1={PAD.left} y1={ty} x2={W - PAD.right} y2={ty} stroke="currentColor" strokeWidth={1} className="text-edge-base" />
            <text x={PAD.left - 10} y={ty + 4} textAnchor="end" fontSize={11} className="fill-content-muted">
              {tick.toFixed(0)}
            </text>
          </g>
        );
      })}

      <path d={areaPath} fill="url(#areaFill)" />
      <path d={linePath} fill="none" stroke="url(#lineStroke)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

      {series.map((s, i) => {
        const cx = x(i);
        const cy = y(s.weight);
        const labelEvery = Math.max(1, Math.ceil(n / 8));
        const showLabel = i % labelEvery === 0 || i === n - 1;
        return (
          <g key={i}>
            {showLabel && (
              <text x={cx} y={H - PAD.bottom + 20} textAnchor="middle" fontSize={10} className="fill-content-muted">
                {fmtDate(s.date)}
              </text>
            )}
            <circle cx={cx} cy={cy} r={4} fill="rgb(99 102 241)" stroke="white" strokeWidth={2} className="[stroke:rgb(255_255_255)] dark:[stroke:rgb(30_41_59)]" />
            <text x={cx} y={cy - 12} textAnchor="middle" fontSize={10} className="fill-content-strong font-medium" opacity={0}>
              {s.weight}
            </text>
            <circle cx={cx} cy={cy} r={14} fill="transparent">
              <title>{`${fmtDate(s.date)}: ${s.weight} kg`}</title>
            </circle>
          </g>
        );
      })}

      <text x={PAD.left - 38} y={PAD.top + innerH / 2} textAnchor="middle" fontSize={10} className="fill-content-muted" transform={`rotate(-90 ${PAD.left - 38} ${PAD.top + innerH / 2})`}>
        kg
      </text>
    </>
  );
}
