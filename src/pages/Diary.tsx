import { useEffect, useState } from "react";
import { Plus, Check, ChevronRight, Dumbbell, Apple, Droplets, Moon, X, Trash2 } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { Progress } from "../components/ui/progress";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { DiaryTask, Exercise } from "../lib/types";
import { useI18n } from "../context/I18nContext";

const today = new Date().toISOString().slice(0, 10);

const workoutTypes = ["Superior A", "Superior B", "Inferior A", "Inferior B", "Full Body", "Cardio"];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function Diary() {
  const { profile, user } = useAuth();
  const { t } = useI18n();

  const categoryOptions = [
    { value: "Hidratação", label: t("diary.hydration") },
    { value: "Treino", label: t("diary.workout") },
    { value: "Nutrição", label: t("diary.nutrition") },
    { value: "Descanso", label: t("diary.rest") },
    { value: "Geral", label: t("diary.general") },
  ];
  const [tasks, setTasks] = useState<DiaryTask[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [waterTotal, setWaterTotal] = useState(0);
  const [totalCalories, setTotalCalories] = useState(0);
  const [loading, setLoading] = useState(true);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskText, setTaskText] = useState("");
  const [taskCategory, setTaskCategory] = useState("Geral");

  const [showExModal, setShowExModal] = useState(false);
  const [exForm, setExForm] = useState({ name: "", sets: "3x12", weight_kg: "", workout_type: "Superior A" });
  const [saving, setSaving] = useState(false);

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Usuário";
  const height = profile?.height_cm;
  const weight = profile?.weight_kg;
  const bmi = height && weight ? (weight / ((height / 100) ** 2)).toFixed(1) : null;

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel("diary-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "diary_tasks", filter: `task_date=eq.${today}` }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "exercises", filter: `exercise_date=eq.${today}` }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "water_logs", filter: `logged_date=eq.${today}` }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "meals", filter: `logged_date=eq.${today}` }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadData() {
    setLoading(true);
    const [tasksRes, exRes, waterRes, mealsRes] = await Promise.all([
      supabase.from("diary_tasks").select("*").eq("task_date", today).order("sort_order").order("created_at"),
      supabase.from("exercises").select("*").eq("exercise_date", today).order("created_at"),
      supabase.from("water_logs").select("amount_liters").eq("logged_date", today),
      supabase.from("meals").select("calories").eq("logged_date", today),
    ]);
    if (tasksRes.data) setTasks(tasksRes.data);
    if (exRes.data) setExercises(exRes.data);
    if (waterRes.data) setWaterTotal(waterRes.data.reduce((s, r) => s + Number(r.amount_liters), 0));
    if (mealsRes.data) setTotalCalories(mealsRes.data.reduce((s, r) => s + Number(r.calories), 0));
    setLoading(false);
  }

  async function toggleTask(task: DiaryTask) {
    const { data } = await supabase
      .from("diary_tasks")
      .update({ done: !task.done })
      .eq("id", task.id)
      .select()
      .single();
    if (data) setTasks((prev) => prev.map((t) => (t.id === task.id ? data : t)));
  }

  async function deleteTask(id: string) {
    await supabase.from("diary_tasks").delete().eq("id", id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function addTask() {
    if (!taskText.trim()) return;
    setSaving(true);
    const { data } = await supabase
      .from("diary_tasks")
      .insert({ text: taskText, category: taskCategory, task_date: today, sort_order: tasks.length })
      .select()
      .single();
    if (data) setTasks((prev) => [...prev, data]);
    setTaskText("");
    setTaskCategory("Geral");
    setShowTaskModal(false);
    setSaving(false);
  }

  async function toggleExercise(ex: Exercise) {
    const { data } = await supabase
      .from("exercises")
      .update({ done: !ex.done })
      .eq("id", ex.id)
      .select()
      .single();
    if (data) setExercises((prev) => prev.map((e) => (e.id === ex.id ? data : e)));
  }

  async function addExercise() {
    if (!exForm.name.trim()) return;
    setSaving(true);
    const { data } = await supabase
      .from("exercises")
      .insert({
        name: exForm.name,
        sets: exForm.sets,
        weight_kg: exForm.weight_kg ? parseFloat(exForm.weight_kg) : null,
        workout_type: exForm.workout_type,
        exercise_date: today,
      })
      .select()
      .single();
    if (data) setExercises((prev) => [...prev, data]);
    setExForm({ name: "", sets: "3x12", weight_kg: "", workout_type: "Superior A" });
    setShowExModal(false);
    setSaving(false);
  }

  const done = tasks.filter((t) => t.done).length;
  const waterGoal = profile?.daily_water_goal_liters ?? 2.5;
  const calGoal = profile?.daily_calorie_goal ?? 2400;
  const waterPct = waterGoal > 0 ? Math.min(100, (waterTotal / waterGoal) * 100) : 0;
  const calPct = calGoal > 0 ? Math.min(100, (totalCalories / calGoal) * 100) : 0;

  const dailyStats = [
    { icon: Droplets, label: t("diary.water"), value: `${waterTotal.toFixed(2).replace(/\.?0+$/, "")}L`, progress: waterPct, color: "bg-primary-500", iconColor: "text-primary-500", bg: "bg-primary-50" },
    { icon: Apple, label: "Calorias", value: `${totalCalories} kcal`, progress: calPct, color: "bg-orange-400", iconColor: "text-orange-500", bg: "bg-orange-50" },
    { icon: Dumbbell, label: t("diary.workout"), value: `${exercises.filter((e) => e.done).length} / ${exercises.length}`, progress: exercises.length > 0 ? (exercises.filter((e) => e.done).length / exercises.length) * 100 : 0, color: "bg-violet-500", iconColor: "text-violet-500", bg: "bg-violet-50" },
    { icon: Moon, label: t("diary.tasks"), value: `${done} / ${tasks.length}`, progress: tasks.length > 0 ? (done / tasks.length) * 100 : 0, color: "bg-indigo-500", iconColor: "text-indigo-500", bg: "bg-indigo-50" },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-strong">{t("diary.title")}</h1>
          <p className="mt-0.5 text-sm text-content-muted">
            {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowTaskModal(true)}>
          <Plus className="h-4 w-4" />
          {t("diary.newTask")}
        </Button>
      </header>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="flex flex-col gap-4 xl:col-span-2">
            {/* Tasks */}
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-content-strong">{t("diary.tasks")}</h2>
                    <p className="text-xs text-content-muted">{t("diary.tasksDone", { done, total: tasks.length })}</p>
                  </div>
                  <button
                    onClick={() => setShowTaskModal(true)}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    + {t("add")}
                  </button>
                </div>
                {tasks.length > 0 && (
                  <Progress
                    value={tasks.length > 0 ? (done / tasks.length) * 100 : 0}
                    className="mb-4"
                  />
                )}
                {tasks.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <Check className="mb-2 h-8 w-8 text-slate-200" />
                    <p className="text-sm text-content-muted">{t("diary.noTasks")}</p>
                    <button
                      onClick={() => setShowTaskModal(true)}
                      className="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      {t("diary.addFirstTask")}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-base"
                      >
                        <button
                          onClick={() => toggleTask(task)}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            task.done ? "border-primary-600 bg-primary-600" : "border-edge-base bg-surface-card"
                          }`}
                        >
                          {task.done && <Check className="h-3 w-3 text-white" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium ${task.done ? "text-content-muted line-through" : "text-content-strong"}`}>
                            {task.text}
                          </span>
                        </div>
                        <span className="text-xs text-content-muted">{task.category}</span>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="hidden text-slate-300 hover:text-red-500 group-hover:block"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Exercises */}
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-content-strong">{t("diary.todayWorkout")}</h2>
                  <button
                    onClick={() => setShowExModal(true)}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    + {t("add")}
                  </button>
                </div>
                {exercises.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <Dumbbell className="mb-2 h-8 w-8 text-slate-200" />
                    <p className="text-sm text-content-muted">{t("diary.noExercises")}</p>
                    <button
                      onClick={() => setShowExModal(true)}
                      className="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      {t("diary.addExercise")}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {exercises.map((ex) => (
                      <div
                        key={ex.id}
                        className="flex items-center justify-between rounded-xl border border-edge-base px-4 py-3 transition-colors hover:bg-surface-base"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleExercise(ex)}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                              ex.done ? "bg-primary-600" : "bg-surface-subtle"
                            }`}
                          >
                            <Dumbbell className={`h-4 w-4 ${ex.done ? "text-white" : "text-content-muted"}`} />
                          </button>
                          <div>
                            <p className="text-sm font-medium text-content-strong">{ex.name}</p>
                            <p className="text-xs text-content-muted">{ex.sets}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ex.weight_kg && (
                            <span className="text-sm font-semibold text-content-body">{ex.weight_kg} kg</span>
                          )}
                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            <Card>
              <CardContent className="flex flex-col items-center p-6 text-center">
                <Avatar className="h-20 w-20">
                  {profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={displayName} />
                  ) : (
                    <AvatarFallback className="bg-primary-50 text-2xl font-bold text-primary-700">
                      {initials(displayName)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <h3 className="mt-3 text-lg font-bold text-content-strong">{displayName}</h3>
                <p className="text-sm text-content-muted">{profile?.plan === "pro" ? t("nav.planPro") : t("nav.planFree")}</p>
                <div className="mt-5 grid w-full grid-cols-3 gap-2 border-t border-edge-base pt-4">
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-content-strong">{weight ?? "–"}</span>
                    <span className="text-xs text-content-muted">kg</span>
                  </div>
                  <div className="flex flex-col items-center border-x border-edge-base">
                    <span className="text-lg font-bold text-content-strong">{height ?? "–"}</span>
                    <span className="text-xs text-content-muted">cm</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-content-strong">{bmi ?? "–"}</span>
                    <span className="text-xs text-content-muted">IMC</span>
                  </div>
                </div>
                {profile?.health_goal && (
                  <div className="mt-4 w-full rounded-xl bg-primary-50 px-4 py-3 text-left">
                    <p className="text-xs font-medium text-primary-700">Objetivo Principal</p>
                    <p className="mt-0.5 text-sm font-semibold text-content-strong">{profile.health_goal}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h3 className="mb-4 text-base font-semibold text-content-strong">{t("diary.dayProgress")}</h3>
                <div className="flex flex-col gap-4">
                  {dailyStats.map((stat) => (
                    <div key={stat.label} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${stat.bg}`}>
                            <stat.icon className={`h-3.5 w-3.5 ${stat.iconColor}`} />
                          </div>
                          <span className="text-sm text-content-body">{stat.label}</span>
                        </div>
                        <span className="text-xs font-medium text-content-body">{stat.value}</span>
                      </div>
                      <Progress value={stat.progress} indicatorClassName={stat.color} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface-card p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-content-strong">{t("diary.newTask")}</h2>
              <button onClick={() => setShowTaskModal(false)} className="text-content-muted hover:text-content-body">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-content-body">{t("diary.taskDescription")} *</label>
                <Input
                  className="mt-1"
                  placeholder="Ex: Beber 2.5L de água"
                  value={taskText}
                  onChange={(e) => setTaskText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask()}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-content-body">{t("diary.category")}</label>
                <select
                  className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 py-2 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value)}
                >
                  {categoryOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowTaskModal(false)}>{t("cancel")}</Button>
              <Button className="flex-1" onClick={addTask} disabled={saving || !taskText.trim()}>
                {saving ? t("saving") : t("add")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Modal */}
      {showExModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface-card p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-content-strong">{t("diary.addExercise")}</h2>
              <button onClick={() => setShowExModal(false)} className="text-content-muted hover:text-content-body">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-content-body">{t("diary.exerciseName")} *</label>
                <Input
                  className="mt-1"
                  placeholder="Ex: Supino Reto"
                  value={exForm.name}
                  onChange={(e) => setExForm({ ...exForm, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-content-body">{t("diary.setsReps")}</label>
                  <Input className="mt-1" placeholder="3x12" value={exForm.sets} onChange={(e) => setExForm({ ...exForm, sets: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium text-content-body">{t("diary.weightKg")}</label>
                  <Input className="mt-1" type="number" placeholder="0" value={exForm.weight_kg} onChange={(e) => setExForm({ ...exForm, weight_kg: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-content-body">{t("diary.workoutType")}</label>
                <select
                  className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 py-2 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  value={exForm.workout_type}
                  onChange={(e) => setExForm({ ...exForm, workout_type: e.target.value })}
                >
                  {workoutTypes.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowExModal(false)}>{t("cancel")}</Button>
              <Button className="flex-1" onClick={addExercise} disabled={saving || !exForm.name.trim()}>
                {saving ? t("saving") : t("add")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
