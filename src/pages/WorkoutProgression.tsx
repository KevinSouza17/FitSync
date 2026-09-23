import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingDown, TrendingUp, Dumbbell, Calendar, Activity } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

interface WorkoutLog {
  id: string;
  exercise_name: string;
  sets_completed: number | null;
  reps_per_set: string | null;
  weight_kg: number | null;
  logged_date: string;
}

interface WeeklyPoint {
  week: string;
  label: string;
  weight: number;
  reps: number;
  sessions: number;
}

const W = 760;
const H = 320;
const PAD = { top: 24, right: 24, bottom: 50, left: 58 };

type Metric = "weight" | "reps";

function parseReps(value: string | null) {
  return (value ?? "").split(/[,;/\s]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 0);
}

function startOfWeek(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function formatDate(dateString: string, lang: string, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US", options);
}

export function WorkoutProgression() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [selected, setSelected] = useState("");
  const [metric, setMetric] = useState<Metric>("weight");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("workout_logs").select("id, exercise_name, sets_completed, reps_per_set, weight_kg, logged_date").eq("user_id", user.id).order("logged_date", { ascending: true });
      setLogs((data as WorkoutLog[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const exercises = useMemo(() => Array.from(new Set(logs.map((log) => log.exercise_name))).sort(), [logs]);

  useEffect(() => {
    if (exercises.length && !selected) setSelected(exercises[0]);
  }, [exercises, selected]);

  const weeklySeries = useMemo<WeeklyPoint[]>(() => {
    const weeks = new Map<string, WeeklyPoint>();
    logs.filter((log) => log.exercise_name === selected).forEach((log) => {
      const week = startOfWeek(log.logged_date);
      const reps = parseReps(log.reps_per_set).reduce((sum, value) => sum + value, 0);
      const point = weeks.get(week) ?? { week, label: formatDate(week, lang), weight: 0, reps: 0, sessions: 0 };
      point.weight = Math.max(point.weight, Number(log.weight_kg ?? 0));
      point.reps += reps;
      point.sessions += 1;
      weeks.set(week, point);
    });
    return Array.from(weeks.values()).sort((a, b) => a.week.localeCompare(b.week));
  }, [logs, selected, lang]);

  const stats = useMemo(() => {
    if (!weeklySeries.length) return null;
    const values = weeklySeries.map((point) => point[metric]);
    const first = values[0];
    const current = values[values.length - 1];
    const change = Number((current - first).toFixed(1));
    return { first, current, change, best: Math.max(...values), sessions: weeklySeries.reduce((sum, point) => sum + point.sessions, 0) };
  }, [metric, weeklySeries]);

  const metricLabel = metric === "weight" ? "Carga máxima semanal" : "Repetições semanais";
  const metricUnit = metric === "weight" ? "kg" : "reps";

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/workout")} className="-ml-2 w-fit text-content-muted"><ArrowLeft className="h-4 w-4" />{t("back")}</Button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600"><TrendingUp className="h-5 w-5 text-white" /></div><div><h1 className="text-2xl font-bold text-content-strong">{t("workout.progression")}</h1><p className="text-sm text-content-muted">Evolução semanal por exercício</p></div></div>
        </div>
      </header>

      {loading ? <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" /></div> : logs.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-16 text-center"><Dumbbell className="mb-3 h-12 w-12 text-content-muted opacity-40" /><p className="text-base font-medium text-content-strong">{t("workout.noLogs")}</p><Button className="mt-4" onClick={() => navigate("/workout")}>{t("back")}</Button></CardContent></Card>
      ) : (
        <>
          <div className="grid gap-3 rounded-2xl border border-edge-base bg-surface-card p-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="text-sm font-medium text-content-body">Exercício<select value={selected} onChange={(e) => setSelected(e.target.value)} className="mt-1.5 flex h-10 w-full rounded-lg border border-edge-base bg-surface-base px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 sm:min-w-72">{exercises.map((exercise) => <option key={exercise} value={exercise}>{exercise}</option>)}</select></label>
            <div className="grid grid-cols-2 rounded-lg bg-surface-subtle p-1"><button onClick={() => setMetric("weight")} className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${metric === "weight" ? "bg-surface-card text-primary-600 shadow-sm" : "text-content-muted"}`}>Carga</button><button onClick={() => setMetric("reps")} className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${metric === "reps" ? "bg-surface-card text-primary-600 shadow-sm" : "text-content-muted"}`}>Reps</button></div>
          </div>

          {stats && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard icon={<Activity className="h-4 w-4" />} label="Atual" value={`${stats.current} ${metricUnit}`} /><StatCard icon={<TrendingUp className="h-4 w-4" />} label="Melhor marca" value={`${stats.best} ${metricUnit}`} /><StatCard icon={<Calendar className="h-4 w-4" />} label="Sessões" value={String(stats.sessions)} /><StatCard icon={stats.change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} label="Variação" value={`${stats.change > 0 ? "+" : ""}${stats.change} ${metricUnit}`} accent={stats.change > 0 ? "up" : stats.change < 0 ? "down" : "neutral"} /></div>}

          {weeklySeries.length > 1 ? <Card><CardContent className="p-4 sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-content-strong">{metricLabel}</h2><p className="text-xs text-content-muted">Cada ponto representa uma semana de treino</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${stats && stats.change >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{stats && stats.change >= 0 ? "Tendência de alta" : "Tendência de queda"}</span></div><svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet"><Chart series={weeklySeries} metric={metric} unit={metricUnit} /></svg></CardContent></Card> : <Card><CardContent className="py-10 text-center text-sm text-content-muted">Registre pelo menos duas semanas para visualizar a tendência.</CardContent></Card>}

          <Card><CardContent className="p-4 sm:p-6"><div className="mb-4 flex items-center gap-2"><Calendar className="h-4 w-4 text-primary-600" /><h2 className="font-semibold text-content-strong">Resumo semanal</h2></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-edge-base text-left text-xs uppercase tracking-wide text-content-muted"><th className="pb-3 pr-4 font-medium">Semana</th><th className="px-4 pb-3 font-medium">Carga máx.</th><th className="px-4 pb-3 font-medium">Reps</th><th className="pb-3 pl-4 font-medium">Sessões</th></tr></thead><tbody>{[...weeklySeries].reverse().map((point) => <tr key={point.week} className="border-b border-edge-base last:border-0 hover:bg-surface-subtle"><td className="py-3 pr-4 font-medium text-content-body">{point.label}</td><td className="px-4 py-3 text-content-strong">{point.weight} kg</td><td className="px-4 py-3 text-content-body">{point.reps}</td><td className="py-3 pl-4 text-content-body">{point.sessions}</td></tr>)}</tbody></table></div></CardContent></Card>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent = "neutral" }: { icon: React.ReactNode; label: string; value: string; accent?: "up" | "down" | "neutral" }) {
  const color = accent === "up" ? "text-emerald-600" : accent === "down" ? "text-red-500" : "text-content-strong";
  return <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-content-muted"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary-600">{icon}</span><span className="text-xs font-medium">{label}</span></div><p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p></CardContent></Card>;
}

function Chart({ series, metric, unit }: { series: WeeklyPoint[]; metric: Metric; unit: string }) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const values = series.map((point) => point[metric]);
  const rawMax = Math.max(...values);
  const rawMin = Math.min(...values);
  const span = rawMax - rawMin || Math.max(rawMax * 0.2, 1);
  const yMax = rawMax + span * 0.15;
  const yMin = Math.max(0, rawMin - span * 0.15);
  const ySpan = yMax - yMin || 1;
  const x = (index: number) => PAD.left + (series.length === 1 ? innerW / 2 : (index / (series.length - 1)) * innerW);
  const y = (value: number) => PAD.top + innerH - ((value - yMin) / ySpan) * innerH;
  const linePath = series.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point[metric]).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${x(series.length - 1).toFixed(1)},${PAD.top + innerH} L${x(0).toFixed(1)},${PAD.top + innerH} Z`;
  const ticks = Array.from({ length: 5 }, (_, index) => yMin + (ySpan * index) / 4);
  return <><defs><linearGradient id="weeklyArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgb(79 70 229)" stopOpacity="0.25" /><stop offset="100%" stopColor="rgb(79 70 229)" stopOpacity="0" /></linearGradient><linearGradient id="weeklyLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="rgb(37 99 235)" /><stop offset="100%" stopColor="rgb(124 58 237)" /></linearGradient></defs>{ticks.map((tick, index) => <g key={index}><line x1={PAD.left} y1={y(tick)} x2={W - PAD.right} y2={y(tick)} stroke="currentColor" strokeWidth={1} className="text-edge-base" /><text x={PAD.left - 10} y={y(tick) + 4} textAnchor="end" fontSize={11} className="fill-content-muted">{tick.toFixed(0)}</text></g>)}<path d={areaPath} fill="url(#weeklyArea)" /><path d={linePath} fill="none" stroke="url(#weeklyLine)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />{series.map((point, index) => { const cx = x(index); const cy = y(point[metric]); const showLabel = index % Math.max(1, Math.ceil(series.length / 7)) === 0 || index === series.length - 1; return <g key={point.week}><circle cx={cx} cy={cy} r={5} fill="rgb(37 99 235)" stroke="white" strokeWidth={2} className="dark:[stroke:rgb(30_41_59)]" /><title>{`${point.label}: ${point[metric]} ${unit}`}</title>{showLabel && <text x={cx} y={H - PAD.bottom + 21} textAnchor="middle" fontSize={10} className="fill-content-muted">{point.label}</text>}</g>; })}<text x={PAD.left - 42} y={PAD.top + innerH / 2} textAnchor="middle" fontSize={10} className="fill-content-muted" transform={`rotate(-90 ${PAD.left - 42} ${PAD.top + innerH / 2})`}>{unit}</text></>;
}
