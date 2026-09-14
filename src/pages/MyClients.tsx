import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, UserPlus, UtensilsCrossed, Dumbbell, Plus, Trash2, X, Pencil,
  CheckCircle2, Loader2, Activity, Target, Calendar, Scale, Flame,
  TrendingUp, ArrowUp, ArrowDown, Bell, Eye, ClipboardList, LineChart, Table2,
  Maximize2,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { AutoTextarea } from "../components/ui/textarea";
import { supabase } from "../lib/supabase";
import type { ClientPlan, Meal, WeightLog, WorkoutLog } from "../lib/types";
import { cn } from "../lib/utils";
import { ClientSpreadsheets } from "../components/ClientSpreadsheets";

interface ClientProfile {
  id: string; full_name: string; avatar_url: string | null;
  health_goal: string; daily_calorie_goal: number;
  weight_kg: number | null; height_cm: number | null; plan: string;
  goal_weight_kg: number | null; activity_level: string;
}
interface MealEntry { name: string; items: string; }
interface DayEntry { name: string; exercises: string; }
interface DietPlanContent { meals?: MealEntry[] }
interface WorkoutPlanContent { days?: DayEntry[] }

const initials = (name: string) =>
  name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

// ── SVG Line Chart component ──
function LineChartSVG({
  data,
  color,
  unit,
  height = 160,
}: {
  data: { label: string; value: number }[];
  color: string;
  unit: string;
  height?: number;
}) {
  const width = 600;
  const pad = { top: 20, right: 20, bottom: 30, left: 45 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  if (data.length < 2) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-content-muted">
        Sem dados suficientes para o gráfico
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const yMin = minVal - range * 0.1;
  const yMax = maxVal + range * 0.1;
  const yRange = yMax - yMin || 1;

  const points = data.map((d, i) => {
    const x = pad.left + (i / (data.length - 1)) * chartW;
    const y = pad.top + chartH - ((d.value - yMin) / yRange) * chartH;
    return { x, y, ...d };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${pad.top + chartH} L ${points[0].x.toFixed(1)} ${pad.top + chartH} Z`;

  const yTicks = 4;
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => yMin + (yRange * i) / yTicks);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`grad-${color.replace(/[^a-z]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Y-axis grid lines */}
      {yTickVals.map((v, i) => {
        const y = pad.top + chartH - ((v - yMin) / yRange) * chartH;
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={pad.left + chartW} y2={y} stroke="currentColor" strokeWidth="0.5" className="text-slate-200 dark:text-slate-700" />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="currentColor" className="text-slate-400">
              {Math.round(v)}
            </text>
          </g>
        );
      })}
      {/* Area + line */}
      <path d={areaD} fill={`url(#grad-${color.replace(/[^a-z]/gi, "")})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill={color} stroke="white" strokeWidth="1.5" />
          {(i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2)) && (
            <text x={p.x} y={pad.top + chartH + 18} textAnchor="middle" fontSize="10" fill="currentColor" className="text-slate-400">
              {p.label}
            </text>
          )}
        </g>
      ))}
      {/* Unit label */}
      <text x={pad.left - 35} y={pad.top - 8} fontSize="10" fill="currentColor" className="text-slate-400">
        {unit}
      </text>
    </svg>
  );
}

// ── Bar Chart component ──
function BarChartSVG({
  data,
  color,
  unit,
  height = 160,
}: {
  data: { label: string; value: number }[];
  color: string;
  unit: string;
  height?: number;
}) {
  const width = 600;
  const pad = { top: 20, right: 20, bottom: 30, left: 45 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  if (data.length < 1) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-content-muted">
        Sem dados suficientes para o gráfico
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barW = chartW / data.length * 0.65;
  const gap = chartW / data.length * 0.35;
  const yTicks = 4;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={`bar-${color.replace(/[^a-z]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {/* Y-axis grid */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = (maxVal * i) / yTicks;
        const y = pad.top + chartH - (v / maxVal) * chartH;
        return (
          <g key={i}>
            <line x1={pad.left} y1={y} x2={pad.left + chartW} y2={y} stroke="currentColor" strokeWidth="0.5" className="text-slate-200 dark:text-slate-700" />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="currentColor" className="text-slate-400">
              {Math.round(v)}
            </text>
          </g>
        );
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const barH = (d.value / maxVal) * chartH;
        const x = pad.left + i * (barW + gap) + gap / 2;
        const y = pad.top + chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx="4" fill={`url(#bar-${color.replace(/[^a-z]/gi, "")})`} />
            <text x={x + barW / 2} y={pad.top + chartH + 18} textAnchor="middle" fontSize="10" fill="currentColor" className="text-slate-400">
              {d.label}
            </text>
          </g>
        );
      })}
      <text x={pad.left - 35} y={pad.top - 8} fontSize="10" fill="currentColor" className="text-slate-400">
        {unit}
      </text>
    </svg>
  );
}

export function MyClients() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [allPlans, setAllPlans] = useState<ClientPlan[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ClientPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [planType, setPlanType] = useState<"diet" | "workout">("diet");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [calories, setCalories] = useState("");
  const [proteinPct, setProteinPct] = useState("");
  const [carbsPct, setCarbsPct] = useState("");
  const [fatPct, setFatPct] = useState("");
  const [meals, setMeals] = useState<MealEntry[]>([{ name: "", items: "" }]);
  const [days, setDays] = useState<DayEntry[]>([{ name: "", exercises: "" }]);
  const [tab, setTab] = useState<"plans" | "sheets" | "progress" | "profile">("plans");
  const [planFilter, setPlanFilter] = useState<"all" | "diet" | "workout">("all");
  const [progressTab, setProgressTab] = useState<"diet" | "workout">("diet");

  const [clientMeals, setClientMeals] = useState<Meal[]>([]);
  const [clientWeightLogs, setClientWeightLogs] = useState<WeightLog[]>([]);
  const [clientWorkoutLogs, setClientWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifMsg, setNotifMsg] = useState("");
  const [notifSending, setNotifSending] = useState(false);

  const macroGrams = (() => {
    const kcal = Number(calories) || 0;
    const pPct = Number(proteinPct) || 0;
    const cPct = Number(carbsPct) || 0;
    const fPct = Number(fatPct) || 0;
    return {
      protein: kcal && pPct ? Math.round((kcal * pPct) / 100 / 4) : null,
      carbs: kcal && cPct ? Math.round((kcal * cPct) / 100 / 4) : null,
      fat: kcal && fPct ? Math.round((kcal * fPct) / 100 / 9) : null,
    };
  })();
  const macroPctSum = (Number(proteinPct) || 0) + (Number(carbsPct) || 0) + (Number(fatPct) || 0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: aptData }, { data: planData }, { data: convData }] = await Promise.all([
        supabase.from("appointments").select("user_id").eq("professional_id", user.id),
        supabase.from("client_plans").select("client_id").eq("professional_id", user.id),
        supabase.from("conversations").select("user_a_id, user_b_id").or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`),
      ]);
      const ids = [...new Set([
        ...(aptData || []).map((a) => a.user_id),
        ...(planData || []).map((p) => p.client_id),
        ...(convData || []).flatMap((c) =>
          c.user_a_id === user.id ? [c.user_b_id] : [c.user_a_id]
        ),
      ])].filter((id) => id !== user.id);
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, health_goal, daily_calorie_goal, weight_kg, height_cm, plan, goal_weight_kg, activity_level")
          .in("id", ids);
        setClients((profiles as ClientProfile[]) || []);
        setSelectedId(ids[0]);
      } else {
        setClients([]);
        setSelectedId(null);
      }
      const { data: plans } = await supabase
        .from("client_plans").select("*").eq("professional_id", user.id)
        .order("created_at", { ascending: false });
      setAllPlans((plans as ClientPlan[]) || []);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (!selectedId || tab !== "progress") return;
    (async () => {
      setProgressLoading(true);
      const [mealsRes, weightRes, workoutRes] = await Promise.all([
        supabase.from("meals").select("*").eq("user_id", selectedId).order("logged_date", { ascending: false }).limit(30),
        supabase.from("weight_logs").select("*").eq("user_id", selectedId).order("logged_date", { ascending: false }).limit(30),
        supabase.from("workout_logs").select("*").eq("user_id", selectedId).order("logged_date", { ascending: false }).limit(30),
      ]);
      setClientMeals((mealsRes.data as Meal[]) || []);
      setClientWeightLogs((weightRes.data as WeightLog[]) || []);
      setClientWorkoutLogs((workoutRes.data as WorkoutLog[]) || []);
      setProgressLoading(false);
    })();
  }, [selectedId, tab]);

  const selectedClient = clients.find((c) => c.id === selectedId) ?? null;
  const clientPlans = useMemo(() => {
    const filtered = allPlans.filter((p) => p.client_id === selectedId);
    if (planFilter === "all") return filtered;
    return filtered.filter((p) => p.plan_type === planFilter);
  }, [allPlans, selectedId, planFilter]);

  const activePlansCount = allPlans.filter((p) => p.active).length;

  // Progress stats
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayMeals = clientMeals.filter((m) => m.logged_date === todayStr);
  const todayCalories = todayMeals.reduce((s, m) => s + Number(m.calories), 0);
  const latestWeight = clientWeightLogs[0];
  const prevWeight = clientWeightLogs[1];
  const weightDiff = latestWeight && prevWeight ? (Number(latestWeight.weight_kg) - Number(prevWeight.weight_kg)).toFixed(1) : null;

  // Chart data: weight progression (chronological order)
  const weightChartData = useMemo(() => {
    return [...clientWeightLogs]
      .reverse()
      .slice(-10)
      .map((w) => ({
        label: new Date(w.logged_date).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        value: Number(w.weight_kg),
      }));
  }, [clientWeightLogs]);

  // Chart data: calories per day (last 7 days)
  const caloriesChartData = useMemo(() => {
    const byDate: Record<string, number> = {};
    clientMeals.forEach((m) => {
      byDate[m.logged_date] = (byDate[m.logged_date] || 0) + Number(m.calories);
    });
    const dates = Object.keys(byDate).sort().slice(-7);
    return dates.map((d) => ({
      label: new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      value: byDate[d],
    }));
  }, [clientMeals]);

  // Chart data: workout volume per session (last 10)
  const workoutChartData = useMemo(() => {
    const byDate: Record<string, number> = {};
    clientWorkoutLogs.forEach((w) => {
      const vol = Number(w.weight_kg) * Number(w.sets_completed);
      byDate[w.logged_date] = (byDate[w.logged_date] || 0) + vol;
    });
    const dates = Object.keys(byDate).sort().slice(-10);
    return dates.map((d) => ({
      label: new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
      value: Math.round(byDate[d]),
    }));
  }, [clientWorkoutLogs]);

  // Macro breakdown for recent meals
  const avgProtein = clientMeals.length > 0
    ? Math.round(clientMeals.slice(0, 10).reduce((s, m) => s + Number(m.protein_g), 0) / Math.min(clientMeals.length, 10))
    : 0;
  const avgCarbs = clientMeals.length > 0
    ? Math.round(clientMeals.slice(0, 10).reduce((s, m) => s + Number(m.carbs_g), 0) / Math.min(clientMeals.length, 10))
    : 0;
  const avgFat = clientMeals.length > 0
    ? Math.round(clientMeals.slice(0, 10).reduce((s, m) => s + Number(m.fat_g), 0) / Math.min(clientMeals.length, 10))
    : 0;

  function resetForm() {
    setPlanType("diet"); setTitle(""); setDescription("");
    setCalories(""); setProteinPct(""); setCarbsPct(""); setFatPct("");
    setMeals([{ name: "", items: "" }]); setDays([{ name: "", exercises: "" }]);
    setSuccess(false); setSaveError(""); setEditingPlan(null);
  }
  function openNewPlan() {
    if (!selectedClient) return;
    resetForm();
    setModalOpen(true);
  }
  function openEditPlan(plan: ClientPlan) {
    setEditingPlan(plan);
    setPlanType(plan.plan_type as "diet" | "workout");
    setTitle(plan.title);
    setDescription(plan.description || "");
    setCalories(plan.target_calories?.toString() || "");
    if (plan.plan_type === "diet") {
      const content = plan.content as DietPlanContent;
      setMeals(content?.meals?.length ? content.meals : [{ name: "", items: "" }]);
      setDays([{ name: "", exercises: "" }]);
    } else {
      const content = plan.content as WorkoutPlanContent;
      setDays(content?.days?.length ? content.days : [{ name: "", exercises: "" }]);
      setMeals([{ name: "", items: "" }]);
    }
    setModalOpen(true);
  }
  const addMeal = () => setMeals((m) => [...m, { name: "", items: "" }]);
  const removeMeal = (i: number) => setMeals((m) => m.filter((_, idx) => idx !== i));
  const addDay = () => setDays((d) => [...d, { name: "", exercises: "" }]);
  const removeDay = (i: number) => setDays((d) => d.filter((_, idx) => idx !== i));

  async function savePlan() {
    if (!user || !selectedClient || !title.trim()) return;
    setSaving(true); setSaveError("");
    const content = planType === "diet"
      ? { meals: meals.filter((m) => m.name.trim()) }
      : { days: days.filter((d) => d.name.trim()) };
    const payload = {
      plan_type: planType, title: title.trim(), description: description.trim(),
      target_calories: planType === "diet" ? Number(calories) || null : null,
      target_protein_g: planType === "diet" ? macroGrams.protein : null,
      target_carbs_g: planType === "diet" ? macroGrams.carbs : null,
      target_fat_g: planType === "diet" ? macroGrams.fat : null,
      content, active: true,
    };
    if (editingPlan) {
      const { data, error } = await supabase.from("client_plans").update(payload).eq("id", editingPlan.id).select().single();
      if (error) { setSaveError(error.message); }
      else if (data) {
        setAllPlans((prev) => prev.map((p) => p.id === data.id ? data as ClientPlan : p));
        setSuccess(true);
        setTimeout(() => { setSuccess(false); setModalOpen(false); resetForm(); }, 1400);
      }
    } else {
      const { data, error } = await supabase.from("client_plans").insert({
        professional_id: user.id, client_id: selectedClient.id, ...payload,
      }).select().single();
      if (error) { setSaveError(error.message); }
      else if (data) {
        setAllPlans((prev) => [data as ClientPlan, ...prev]);
        setSuccess(true);
        setTimeout(() => { setSuccess(false); setModalOpen(false); resetForm(); }, 1400);
      }
    }
    setSaving(false);
  }

  async function deletePlan(id: string) {
    const { error } = await supabase.from("client_plans").delete().eq("id", id);
    if (!error) setAllPlans((prev) => prev.filter((p) => p.id !== id));
  }

  async function sendNotification() {
    if (!user || !selectedClient || !notifMsg.trim()) return;
    setNotifSending(true);
    const { error } = await supabase.from("notifications").insert({
      user_id: selectedClient.id,
      type: "pro_message",
      title: `${t("notifications.newFromPro")}`,
      body: notifMsg.trim(),
    });
    if (!error) {
      setNotifMsg(""); setNotifOpen(false);
    }
    setNotifSending(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <span className="ml-3 text-content-muted">{t("loading")}</span>
      </div>
    );
  }

  const taCls =
    "w-full rounded-lg border border-edge-base bg-surface-base px-3 py-2 text-sm text-content-strong placeholder:text-content-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:bg-surface-subtle";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-content-strong sm:text-3xl">{t("plans.title")}</h1>
        <p className="text-sm text-content-muted">{t("plans.subtitle")}</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md sm:gap-4">
        <Card className="bg-surface-card">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-content-strong">{clients.length}</p>
              <p className="text-xs text-content-muted">{t("pro.clientCount")}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-surface-card">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Activity className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-content-strong">{activePlansCount}</p>
              <p className="text-xs text-content-muted">{t("plans.active")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {clients.length === 0 ? (
        <Card className="mt-6 bg-surface-card">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-subtle text-content-muted">
              <UserPlus className="h-7 w-7" />
            </span>
            <p className="text-base font-semibold text-content-strong">{t("pro.noClients")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
          {/* Client list */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-content-muted">
              {t("pro.clientCount")}
            </h2>
            {clients.map((c) => {
              const count = allPlans.filter((p) => p.client_id === c.id && p.active).length;
              const active = c.id === selectedId;
              return (
                <button key={c.id} onClick={() => { setSelectedId(c.id); setTab("plans"); }}
                  className="text-left transition-all duration-200 hover:scale-[1.01] data-[on=true]:scale-[1.01]">
                  <Card className={cn("bg-surface-card transition-colors",
                    active ? "border-primary-500 ring-2 ring-primary-100" : "border-edge-base hover:border-primary-300")}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <Avatar className="h-11 w-11">
                        {c.avatar_url ? (
                          <AvatarImage src={c.avatar_url} alt={c.full_name} />
                        ) : (
                          <AvatarFallback className="bg-primary-50 font-bold text-sm text-primary-600">
                            {initials(c.full_name)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-content-strong">{c.full_name || t("pro.unnamedClient")}</p>
                        <p className="truncate text-xs text-content-muted">{c.health_goal || "—"}</p>
                        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-content-muted">
                          <span className="flex items-center gap-1"><Target className="h-3 w-3" />{c.daily_calorie_goal || 0} kcal</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{count}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          <div className="flex flex-col gap-4">
            {selectedClient ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {selectedClient.avatar_url ? (
                        <AvatarImage src={selectedClient.avatar_url} alt={selectedClient.full_name} />
                      ) : (
                        <AvatarFallback className="bg-primary-50 font-bold text-sm text-primary-600">
                          {initials(selectedClient.full_name)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <p className="text-sm font-bold text-content-strong">{selectedClient.full_name || t("pro.unnamedClient")}</p>
                      <p className="text-xs text-content-muted">{t("plans.assignTo")} {selectedClient.full_name || t("pro.unnamedClient")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setNotifOpen(true)} className="gap-1.5">
                      <Bell className="h-4 w-4" />{t("notifications.send")}
                    </Button>
                    <Button onClick={openNewPlan} className="gap-2"><Plus className="h-4 w-4" />{t("plans.new")}</Button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 rounded-xl bg-surface-subtle p-1">
                  {([
                    { k: "plans" as const, label: t("plans.title"), icon: ClipboardList },
                    { k: "sheets" as const, label: "Planilhas", icon: Table2 },
                    { k: "progress" as const, label: t("progress.title"), icon: TrendingUp },
                    { k: "profile" as const, label: t("profile.title"), icon: Eye },
                  ]).map((tb) => (
                    <button key={tb.k} onClick={() => setTab(tb.k)}
                      className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        tab === tb.k ? "bg-surface-card text-primary-600 shadow-sm" : "text-content-muted hover:text-content-strong")}>
                      <tb.icon className="h-4 w-4" />{tb.label}
                    </button>
                  ))}
                </div>

                {/* Plans tab with filter buttons */}
                {tab === "plans" && (
                  <div className="flex flex-col gap-4">
                    {/* Filter buttons */}
                    <div className="flex gap-2">
                      {([
                        { k: "all" as const, label: t("all"), icon: ClipboardList },
                        { k: "diet" as const, label: t("plans.diet"), icon: UtensilsCrossed },
                        { k: "workout" as const, label: t("plans.workout"), icon: Dumbbell },
                      ]).map((fb) => (
                        <button key={fb.k} onClick={() => setPlanFilter(fb.k)}
                          className={cn("flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                            planFilter === fb.k
                              ? "bg-primary-600 text-white shadow-sm"
                              : "bg-surface-card text-content-muted hover:bg-surface-subtle border border-edge-base")}>
                          <fb.icon className="h-4 w-4" />{fb.label}
                          <span className={cn("ml-1 rounded-full px-1.5 text-[10px] font-bold",
                            planFilter === fb.k ? "bg-white/20" : "bg-surface-subtle")}>
                            {fb.k === "all"
                              ? allPlans.filter((p) => p.client_id === selectedId).length
                              : allPlans.filter((p) => p.client_id === selectedId && p.plan_type === fb.k).length}
                          </span>
                        </button>
                      ))}
                    </div>

                    {clientPlans.length === 0 ? (
                      <Card className="bg-surface-card">
                        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-subtle text-content-muted">
                            {planFilter === "workout" ? <Dumbbell className="h-7 w-7" /> : <UtensilsCrossed className="h-7 w-7" />}
                          </span>
                          <p className="text-base font-semibold text-content-strong">{t("plans.noPlans")}</p>
                          <p className="text-xs text-content-muted">{t("plans.noPlansSub")}</p>
                          <Button onClick={openNewPlan} size="sm" className="mt-2 gap-2">
                            <Plus className="h-4 w-4" />{t("plans.new")}
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {clientPlans.map((p) => {
                          const diet = p.plan_type === "diet";
                          return (
                            <Card key={p.id} className="bg-surface-card">
                              <CardContent className="flex flex-col gap-3 p-4">
                                <div className="flex items-start justify-between gap-2">
                                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                                    diet ? "bg-orange-50 text-orange-600" : "bg-cyan-50 text-cyan-600")}>
                                    {diet ? <UtensilsCrossed className="h-5 w-5" /> : <Dumbbell className="h-5 w-5" />}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",
                                      p.active ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-500")}>
                                      {p.active ? t("plans.active") : t("plans.inactive")}
                                    </span>
                                    <button onClick={() => openEditPlan(p)} aria-label={t("plans.editPlan")}
                                      className="text-content-muted transition-colors hover:text-primary-600">
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => deletePlan(p.id)} aria-label={t("plans.deletePlan")}
                                      className="text-content-muted transition-colors hover:text-red-500">
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-content-strong">{p.title}</p>
                                  {p.description && <p className="mt-1 text-xs text-content-muted">{p.description}</p>}
                                </div>
                                {diet && (
                                  <div className="flex flex-wrap gap-2 text-[11px]">
                                    {p.target_calories != null && <span className="rounded-md bg-surface-subtle px-2 py-1 text-content-body">{p.target_calories} kcal</span>}
                                    {p.target_protein_g != null && <span className="rounded-md bg-surface-subtle px-2 py-1 text-content-body">P {p.target_protein_g}g</span>}
                                    {p.target_carbs_g != null && <span className="rounded-md bg-surface-subtle px-2 py-1 text-content-body">C {p.target_carbs_g}g</span>}
                                    {p.target_fat_g != null && <span className="rounded-md bg-surface-subtle px-2 py-1 text-content-body">G {p.target_fat_g}g</span>}
                                  </div>
                                )}
                                {diet && (p.content as DietPlanContent)?.meals?.length ? (
                                  <div className="flex flex-col gap-1.5 border-t border-edge-base pt-2">
                                    {(p.content as DietPlanContent).meals!.slice(0, 3).map((m, i) => (
                                      <div key={i} className="text-xs">
                                        <span className="font-medium text-content-strong">{m.name}</span>
                                        {m.items && <span className="text-content-muted"> — {m.items}</span>}
                                      </div>
                                    ))}
                                    {(p.content as DietPlanContent).meals!.length > 3 && (
                                      <span className="text-[11px] text-content-muted">+{(p.content as DietPlanContent).meals!.length - 3} {t("plans.more")}</span>
                                    )}
                                  </div>
                                ) : null}
                                {!diet && (p.content as WorkoutPlanContent)?.days?.length ? (
                                  <div className="flex flex-col gap-1.5 border-t border-edge-base pt-2">
                                    {(p.content as WorkoutPlanContent).days!.slice(0, 3).map((d, i) => (
                                      <div key={i} className="text-xs">
                                        <span className="font-medium text-primary-600">{d.name}</span>
                                        {d.exercises && <span className="text-content-muted"> — {d.exercises.slice(0, 60)}{d.exercises.length > 60 ? "…" : ""}</span>}
                                      </div>
                                    ))}
                                    {(p.content as WorkoutPlanContent).days!.length > 3 && (
                                      <span className="text-[11px] text-content-muted">+{(p.content as WorkoutPlanContent).days!.length - 3} {t("plans.more")}</span>
                                    )}
                                  </div>
                                ) : null}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Sheets tab */}
                {tab === "sheets" && selectedClient && (
                  <div className="flex flex-col gap-3">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/my-clients/${selectedClient.id}/spreadsheets`)}
                        className="gap-1.5"
                      >
                        <Maximize2 className="h-4 w-4" />
                        Abrir planilha em tela cheia
                      </Button>
                    </div>
                    <ClientSpreadsheets clientId={selectedClient.id} clientName={selectedClient.full_name || t("pro.unnamedClient")} />
                  </div>
                )}

                {/* Progress tab with diet/workout sub-tabs */}
                {tab === "progress" && (
                  progressLoading ? (
                    <div className="flex h-48 items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {/* Progress sub-tab buttons */}
                      <div className="flex gap-2">
                        {([
                          { k: "diet" as const, label: t("plans.diet"), icon: UtensilsCrossed },
                          { k: "workout" as const, label: t("plans.workout"), icon: Dumbbell },
                        ]).map((st) => (
                          <button key={st.k} onClick={() => setProgressTab(st.k)}
                            className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all",
                              progressTab === st.k
                                ? st.k === "diet"
                                  ? "bg-orange-500 text-white shadow-md"
                                  : "bg-cyan-500 text-white shadow-md"
                                : "bg-surface-card text-content-muted border border-edge-base hover:bg-surface-subtle")}>
                            <st.icon className="h-4 w-4" />{st.label}
                          </button>
                        ))}
                      </div>

                      {/* Diet progress */}
                      {progressTab === "diet" && (
                        <div className="flex flex-col gap-4">
                          {/* Stats cards */}
                          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            <Card className="bg-surface-card">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-content-muted"><Flame className="h-4 w-4" /><span className="text-xs">{t("dashboard.caloriesToday")}</span></div>
                                <p className="mt-1 text-2xl font-bold text-content-strong">{todayCalories}</p>
                                <p className="text-xs text-content-muted">kcal</p>
                              </CardContent>
                            </Card>
                            <Card className="bg-surface-card">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-content-muted"><UtensilsCrossed className="h-4 w-4" /><span className="text-xs">{t("dashboard.mealsToday")}</span></div>
                                <p className="mt-1 text-2xl font-bold text-content-strong">{todayMeals.length}</p>
                              </CardContent>
                            </Card>
                            <Card className="bg-surface-card">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-content-muted"><Scale className="h-4 w-4" /><span className="text-xs">{t("progress.currentWeight")}</span></div>
                                <p className="mt-1 text-2xl font-bold text-content-strong">{latestWeight ? `${latestWeight.weight_kg} kg` : "—"}</p>
                                {weightDiff && (
                                  <span className={cn("flex items-center gap-1 text-xs font-medium", Number(weightDiff) > 0 ? "text-red-500" : "text-green-600")}>
                                    {Number(weightDiff) > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                    {weightDiff} kg
                                  </span>
                                )}
                              </CardContent>
                            </Card>
                            <Card className="bg-surface-card">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-content-muted"><Target className="h-4 w-4" /><span className="text-xs">Meta</span></div>
                                <p className="mt-1 text-2xl font-bold text-content-strong">{selectedClient?.goal_weight_kg ?? "—"}</p>
                                <p className="text-xs text-content-muted">kg</p>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Calories chart */}
                          <Card className="bg-surface-card">
                            <CardContent className="p-5">
                              <div className="mb-3 flex items-center gap-2">
                                <LineChart className="h-4 w-4 text-orange-500" />
                                <h3 className="text-sm font-bold text-content-strong">Calorias por dia</h3>
                              </div>
                              {caloriesChartData.length > 0 ? (
                                <BarChartSVG data={caloriesChartData} color="#f97316" unit="kcal" />
                              ) : (
                                <p className="py-8 text-center text-sm text-content-muted">{t("progress.noMeals")}</p>
                              )}
                            </CardContent>
                          </Card>

                          {/* Weight progression chart */}
                          <Card className="bg-surface-card">
                            <CardContent className="p-5">
                              <div className="mb-3 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary-600" />
                                <h3 className="text-sm font-bold text-content-strong">{t("progress.weightHistory")}</h3>
                              </div>
                              {weightChartData.length >= 2 ? (
                                <LineChartSVG data={weightChartData} color="#3b82f6" unit="kg" />
                              ) : (
                                <p className="py-8 text-center text-sm text-content-muted">{t("progress.noWeightLogs")}</p>
                              )}
                            </CardContent>
                          </Card>

                          {/* Macro breakdown */}
                          <Card className="bg-surface-card">
                            <CardContent className="p-5">
                              <h3 className="mb-3 text-sm font-bold text-content-strong">Média de macros (10 refeições)</h3>
                              <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-xl bg-orange-50 p-3 text-center dark:bg-orange-950/30">
                                  <p className="text-xs text-content-muted">Proteína</p>
                                  <p className="mt-1 text-xl font-bold text-orange-600">{avgProtein}g</p>
                                </div>
                                <div className="rounded-xl bg-blue-50 p-3 text-center dark:bg-blue-950/30">
                                  <p className="text-xs text-content-muted">Carbo</p>
                                  <p className="mt-1 text-xl font-bold text-blue-600">{avgCarbs}g</p>
                                </div>
                                <div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-950/30">
                                  <p className="text-xs text-content-muted">Gordura</p>
                                  <p className="mt-1 text-xl font-bold text-amber-600">{avgFat}g</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Recent meals */}
                          <Card className="bg-surface-card">
                            <CardContent className="p-5">
                              <h3 className="mb-3 text-sm font-bold text-content-strong">{t("progress.recentMeals")}</h3>
                              {clientMeals.length === 0 ? (
                                <p className="py-4 text-center text-sm text-content-muted">{t("progress.noMeals")}</p>
                              ) : (
                                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                                  {clientMeals.slice(0, 10).map((m) => (
                                    <div key={m.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface-base">
                                      <div>
                                        <p className="text-sm font-medium text-content-strong">{m.name}</p>
                                        <p className="text-xs text-content-muted">{m.meal_type} · {new Date(m.logged_date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
                                      </div>
                                      <span className="text-xs font-medium text-content-body">{m.calories} kcal</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {/* Workout progress */}
                      {progressTab === "workout" && (
                        <div className="flex flex-col gap-4">
                          {/* Stats cards */}
                          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                            <Card className="bg-surface-card">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-content-muted"><Dumbbell className="h-4 w-4" /><span className="text-xs">{t("workout.sessions")}</span></div>
                                <p className="mt-1 text-2xl font-bold text-content-strong">{clientWorkoutLogs.length}</p>
                                <p className="text-xs text-content-muted">{t("progress.totalLogs")}</p>
                              </CardContent>
                            </Card>
                            <Card className="bg-surface-card">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-content-muted"><Activity className="h-4 w-4" /><span className="text-xs">Volume total</span></div>
                                <p className="mt-1 text-2xl font-bold text-content-strong">
                                  {clientWorkoutLogs.reduce((s, w) => s + Number(w.weight_kg) * Number(w.sets_completed), 0).toFixed(0)}
                                </p>
                                <p className="text-xs text-content-muted">kg·sets</p>
                              </CardContent>
                            </Card>
                            <Card className="bg-surface-card">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-content-muted"><Scale className="h-4 w-4" /><span className="text-xs">Carga média</span></div>
                                <p className="mt-1 text-2xl font-bold text-content-strong">
                                  {clientWorkoutLogs.length > 0
                                    ? (clientWorkoutLogs.reduce((s, w) => s + Number(w.weight_kg), 0) / clientWorkoutLogs.length).toFixed(1)
                                    : "—"}
                                </p>
                                <p className="text-xs text-content-muted">kg</p>
                              </CardContent>
                            </Card>
                            <Card className="bg-surface-card">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-content-muted"><Target className="h-4 w-4" /><span className="text-xs">Sets totais</span></div>
                                <p className="mt-1 text-2xl font-bold text-content-strong">
                                  {clientWorkoutLogs.reduce((s, w) => s + Number(w.sets_completed), 0)}
                                </p>
                                <p className="text-xs text-content-muted">sets</p>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Workout volume chart */}
                          <Card className="bg-surface-card">
                            <CardContent className="p-5">
                              <div className="mb-3 flex items-center gap-2">
                                <LineChart className="h-4 w-4 text-cyan-500" />
                                <h3 className="text-sm font-bold text-content-strong">Volume de treino por sessão</h3>
                              </div>
                              {workoutChartData.length >= 2 ? (
                                <BarChartSVG data={workoutChartData} color="#06b6d4" unit="kg·sets" />
                              ) : (
                                <p className="py-8 text-center text-sm text-content-muted">{t("progress.noWorkouts")}</p>
                              )}
                            </CardContent>
                          </Card>

                          {/* Recent workouts */}
                          <Card className="bg-surface-card">
                            <CardContent className="p-5">
                              <h3 className="mb-3 text-sm font-bold text-content-strong">{t("progress.recentWorkouts")}</h3>
                              {clientWorkoutLogs.length === 0 ? (
                                <p className="py-4 text-center text-sm text-content-muted">{t("progress.noWorkouts")}</p>
                              ) : (
                                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                                  {clientWorkoutLogs.slice(0, 10).map((w) => (
                                    <div key={w.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface-base">
                                      <div>
                                        <p className="text-sm font-medium text-content-strong">{w.exercise_name}</p>
                                        <p className="text-xs text-content-muted">{w.sets_completed} sets · {new Date(w.logged_date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
                                      </div>
                                      <span className="text-xs font-medium text-content-body">{w.weight_kg} kg</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* Profile tab */}
                {tab === "profile" && (
                  <Card className="bg-surface-card">
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-16 w-16">
                            {selectedClient.avatar_url ? (
                              <AvatarImage src={selectedClient.avatar_url} alt={selectedClient.full_name} />
                            ) : (
                              <AvatarFallback className="bg-primary-50 font-bold text-lg text-primary-600">
                                {initials(selectedClient.full_name)}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div>
                            <h3 className="text-lg font-bold text-content-strong">{selectedClient.full_name || t("pro.unnamedClient")}</h3>
                            <p className="text-sm text-content-muted">{selectedClient.health_goal || "—"}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {[
                            { label: t("profile.weight"), value: selectedClient.weight_kg ? `${selectedClient.weight_kg} kg` : "—" },
                            { label: t("profile.height"), value: selectedClient.height_cm ? `${selectedClient.height_cm} cm` : "—" },
                            { label: t("profile.goalWeight"), value: selectedClient.goal_weight_kg ? `${selectedClient.goal_weight_kg} kg` : "—" },
                            { label: t("dashboard.calorieGoal"), value: `${selectedClient.daily_calorie_goal || 0} kcal` },
                            { label: t("profile.activityLevel"), value: selectedClient.activity_level || "—" },
                            { label: t("profile.plan"), value: selectedClient.plan || "—" },
                          ].map((s) => (
                            <div key={s.label} className="rounded-xl bg-surface-subtle p-3">
                              <p className="text-xs text-content-muted">{s.label}</p>
                              <p className="mt-0.5 text-sm font-semibold text-content-strong">{s.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="bg-surface-card">
                <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-subtle text-content-muted">
                    <Users className="h-7 w-7" />
                  </span>
                  <p className="text-base font-semibold text-content-strong">{t("plans.selectClientFirst")}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Plan Modal (create + edit) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => { setModalOpen(false); resetForm(); }}>
          <Card className="w-full max-w-lg overflow-hidden rounded-b-none border-edge-base bg-surface-card shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-edge-base p-4">
              <h3 className="text-base font-bold text-content-strong">{editingPlan ? t("plans.editPlan") : t("plans.new")}</h3>
              <button onClick={() => { setModalOpen(false); resetForm(); }} className="text-content-muted transition-colors hover:text-content-strong">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4">
              {success ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <p className="text-sm font-semibold text-content-strong">{t("plans.success")}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {saveError && (
                    <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {(["diet", "workout"] as const).map((pt) => (
                      <button key={pt} onClick={() => setPlanType(pt)}
                        className={cn("flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                          planType === pt ? "border-primary-500 bg-primary-50 text-primary-600"
                            : "border-edge-base bg-surface-base text-content-muted hover:bg-surface-subtle")}>
                        {pt === "diet" ? <UtensilsCrossed className="h-4 w-4" /> : <Dumbbell className="h-4 w-4" />}
                        {t(`plans.${pt}`)}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-content-muted">{t("plans.planTitle")}</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("plans.planTitlePlaceholder")} />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-content-muted">{t("plans.description")}</label>
                    <AutoTextarea value={description} onChange={(e) => setDescription(e.target.value)}
                      placeholder={t("plans.descriptionPlaceholder")} minRows={2} className={taCls} />
                  </div>

                  {planType === "diet" ? (
                    <>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-content-muted">{t("plans.targetCalories")}</label>
                        <Input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="2000" />
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">{t("plans.macros")}</p>
                        <span className={`text-xs font-medium ${macroPctSum === 100 ? "text-green-600" : macroPctSum > 0 ? "text-amber-600" : "text-content-muted"}`}>
                          {macroPctSum}%{macroPctSum === 100 ? " ✓" : "/100%"}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[{ v: proteinPct, set: setProteinPct, k: "plans.protein", g: macroGrams.protein },
                          { v: carbsPct, set: setCarbsPct, k: "plans.carbs", g: macroGrams.carbs },
                          { v: fatPct, set: setFatPct, k: "plans.fat", g: macroGrams.fat }].map((m) => (
                          <div key={m.k} className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-content-muted">{t(m.k)} (%)</label>
                            <Input type="number" min="0" max="100" value={m.v} onChange={(e) => m.set(e.target.value)} placeholder="0" />
                            <span className="text-[11px] text-content-muted">≈ {m.g ?? 0}g</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">{t("plans.meals")}</p>
                        <Button variant="ghost" size="sm" onClick={addMeal} className="gap-1">
                          <Plus className="h-3.5 w-3.5" />{t("plans.addMeal")}
                        </Button>
                      </div>
                      <div className="flex flex-col gap-3">
                        {meals.map((meal, i) => (
                          <div key={i} className="rounded-xl border border-edge-base bg-surface-base p-3">
                            <div className="flex items-center gap-2">
                              <Input value={meal.name}
                                onChange={(e) => setMeals((m) => m.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                                placeholder={t("plans.mealName")} />
                              {meals.length > 1 && (
                                <button onClick={() => removeMeal(i)} className="text-content-muted transition-colors hover:text-red-500">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                            <AutoTextarea value={meal.items}
                              onChange={(e) => setMeals((m) => m.map((x, idx) => idx === i ? { ...x, items: e.target.value } : x))}
                              placeholder={t("plans.mealItemsPlaceholder")} minRows={2} className={cn("mt-2", taCls)} />
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">{t("plans.workoutDays")}</p>
                        <Button variant="ghost" size="sm" onClick={addDay} className="gap-1">
                          <Plus className="h-3.5 w-3.5" />{t("plans.addDay")}
                        </Button>
                      </div>
                      <div className="flex flex-col gap-3">
                        {days.map((day, i) => (
                          <div key={i} className="rounded-xl border border-edge-base bg-surface-base p-3">
                            <div className="flex items-center gap-2">
                              <Input value={day.name}
                                onChange={(e) => setDays((d) => d.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                                placeholder={t("plans.dayName")} />
                              {days.length > 1 && (
                                <button onClick={() => removeDay(i)} className="text-content-muted transition-colors hover:text-red-500">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                            <AutoTextarea value={day.exercises}
                              onChange={(e) => setDays((d) => d.map((x, idx) => idx === i ? { ...x, exercises: e.target.value } : x))}
                              placeholder={t("plans.exercisePlaceholder")} minRows={3} className={cn("mt-2", taCls)} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {!success && (
              <div className="flex items-center justify-end gap-2 border-t border-edge-base p-4">
                <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }}>{t("cancel")}</Button>
                <Button onClick={savePlan} disabled={saving || !title.trim()} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {editingPlan ? t("save") : t("plans.save")}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Notification modal */}
      {notifOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setNotifOpen(false)}>
          <Card className="w-full max-w-md overflow-hidden rounded-b-none border-edge-base bg-surface-card shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-edge-base p-4">
              <h3 className="text-base font-bold text-content-strong">{t("notifications.sendTo")} {selectedClient?.full_name || t("pro.unnamedClient")}</h3>
              <button onClick={() => setNotifOpen(false)} className="text-content-muted transition-colors hover:text-content-strong">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <AutoTextarea value={notifMsg} onChange={(e) => setNotifMsg(e.target.value)}
                placeholder={t("notifications.messagePlaceholder")} minRows={4} className={taCls} />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-edge-base p-4">
              <Button variant="outline" onClick={() => setNotifOpen(false)}>{t("cancel")}</Button>
              <Button onClick={sendNotification} disabled={notifSending || !notifMsg.trim()} className="gap-2">
                {notifSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                {t("notifications.send")}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
