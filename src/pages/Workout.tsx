import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dumbbell, Plus, X, Pencil, Trash2, Calendar, TrendingUp,
  Activity, ChevronRight, Check, Flame, ClipboardList, Sparkles,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import type { ClientPlan } from "../lib/types";
import { generateWorkoutPlan } from "../lib/recommendations";
import type { WorkoutRecommendationDay } from "../lib/recommendations";

interface WorkoutPlanContent {
  days?: { name: string; exercises: string }[];
}

interface Program {
  id: string; user_id: string; name: string; description: string | null;
  is_active: boolean; created_at: string;
}
interface Exercise {
  id: string; program_day_id: string; exercise_name: string;
  target_sets: number | null; target_reps_min: number | null; target_reps_max: number | null;
  rest_seconds: number | null; sort_order: number; notes: string | null;
}
interface WorkoutDay {
  id: string; program_id: string; day_of_week: number; label: string;
  created_at: string; exercises: Exercise[];
}

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_KEY: Record<number, string> = {
  0: "workout.sun", 1: "workout.mon", 2: "workout.tue", 3: "workout.wed",
  4: "workout.thu", 5: "workout.fri", 6: "workout.sat",
};
const selectClass =
  "mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 py-2 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

const emptyExerciseForm = {
  exercise_name: "", target_sets: "3", target_reps_min: "8", target_reps_max: "12",
  rest_seconds: "90", sort_order: "1", notes: "",
};
const emptyLogForm = {
  workout_day_id: "", program_exercise_id: "", exercise_name: "",
  weight_kg: "", sets_completed: "", reps_per_set: "", notes: "",
};

export function Workout() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeProgram, setActiveProgram] = useState<Program | null>(null);
  const [days, setDays] = useState<WorkoutDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [programForm, setProgramForm] = useState({ name: "", description: "" });
  const [dayModalDow, setDayModalDow] = useState<number | null>(null);
  const [dayLabelDraft, setDayLabelDraft] = useState("");
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [exerciseForm, setExerciseForm] = useState(emptyExerciseForm);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logForm, setLogForm] = useState(emptyLogForm);
  const [assignedPlan, setAssignedPlan] = useState<ClientPlan | null>(null);
  const [stats, setStats] = useState({ total: 0, maxWeight: 0, lastSession: "" });
  const [recommendedWorkout, setRecommendedWorkout] = useState<WorkoutRecommendationDay[] | null>(null);

  const daysByDow = useMemo(() => {
    const map = new Map<number, WorkoutDay>();
    for (const d of days) map.set(d.day_of_week, d);
    return map;
  }, [days]);

  const loadPrograms = useCallback(async () => {
    const { data } = await supabase.from("workout_programs").select("*").order("created_at");
    const list = (data as Program[]) ?? [];
    setPrograms(list);
    setActiveProgram(list.find((p) => p.is_active) ?? list[0] ?? null);
  }, []);

  const loadDays = useCallback(async (programId: string | null) => {
    if (!programId) return setDays([]);
    const { data: dayRows } = await supabase
      .from("workout_days").select("*").eq("program_id", programId).order("day_of_week");
    const dayList = (dayRows as Omit<WorkoutDay, "exercises">[]) ?? [];
    const dayIds = dayList.map((d) => d.id);
    let exercises: Exercise[] = [];
    if (dayIds.length) {
      const { data: exRows } = await supabase
        .from("workout_exercises").select("*").in("program_day_id", dayIds).order("sort_order");
      exercises = (exRows as Exercise[]) ?? [];
    }
    setDays(dayList.map((d) => ({ ...d, exercises: exercises.filter((e) => e.program_day_id === d.id) })));
  }, []);

  const loadStats = useCallback(async () => {
    const { data } = await supabase.from("workout_logs").select("weight_kg, logged_date");
    const rows = (data as { weight_kg: number | null; logged_date: string }[]) ?? [];
    setStats({
      total: rows.length,
      maxWeight: rows.reduce((m, r) => Math.max(m, r.weight_kg ?? 0), 0),
      lastSession: rows.map((r) => r.logged_date).sort().pop() ?? "",
    });
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true); await loadPrograms();
      if (user) {
        const { data } = await supabase
          .from("client_plans").select("*")
          .eq("client_id", user.id).eq("plan_type", "workout").eq("active", true)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (data) setAssignedPlan(data as ClientPlan);
        // If no programs and no assigned plan, generate a live recommendation from onboarding answers
        const progs = await supabase.from("workout_programs").select("id").eq("user_id", user.id);
        if (!data && (progs.data ?? []).length === 0) {
          const { data: oa } = await supabase
            .from("onboarding_answers").select("*")
            .eq("user_id", user.id).maybeSingle();
          if (oa) {
            const a = oa as {
              goal: string; experience_level: string; workout_days: number;
              diet_preference: string; allergies: string[] | null; equipment: string[] | null;
            };
            setRecommendedWorkout(generateWorkoutPlan({
              goal: a.goal as never, experience: a.experience_level as never,
              workout_days: a.workout_days, diet: a.diet_preference as never,
              allergies: a.allergies, equipment: a.equipment ?? [],
            }));
          }
        }
      }
      setLoading(false);
    })();
  }, [loadPrograms, user]);
  useEffect(() => { loadDays(activeProgram?.id ?? null); }, [activeProgram, loadDays]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const setEx = (k: keyof typeof emptyExerciseForm, v: string) => setExerciseForm((p) => ({ ...p, [k]: v }));

  async function saveProgram() {
    if (!programForm.name) return;
    setSaving(true);
    const { data } = await supabase
      .from("workout_programs")
      .insert({ name: programForm.name, description: programForm.description || null })
      .select().single();
    if (data) setPrograms((prev) => [...prev, data as Program]);
    setShowProgramModal(false);
    setProgramForm({ name: "", description: "" });
    setSaving(false);
  }

  async function activateProgram(program: Program) {
    setPrograms((prev) => prev.map((p) => ({ ...p, is_active: p.id === program.id })));
    setActiveProgram(program);
    await supabase.from("workout_programs").update({ is_active: false }).neq("id", program.id);
    await supabase.from("workout_programs").update({ is_active: true }).eq("id", program.id);
  }

  async function deleteProgram(program: Program) {
    if (!confirm(`Excluir o programa "${program.name}"? Todos os dias e exercicios serao removidos.`)) return;
    const dayIds = days.filter((d) => d.program_id === program.id).map((d) => d.id);
    if (dayIds.length) {
      await supabase.from("workout_exercises").delete().in("program_day_id", dayIds);
      await supabase.from("workout_days").delete().in("id", dayIds);
    }
    await supabase.from("workout_programs").delete().eq("id", program.id);
    const remaining = programs.filter((p) => p.id !== program.id);
    setPrograms(remaining);
    if (activeProgram?.id === program.id) {
      const next = remaining.find((p) => p.is_active) ?? remaining[0] ?? null;
      setActiveProgram(next);
      if (!next) setDays([]);
    }
  }

  async function deleteAssignedPlan() {
    if (!assignedPlan) return;
    if (!confirm("Excluir o plano de treino recebido?")) return;
    const { error } = await supabase.from("client_plans").delete().eq("id", assignedPlan.id);
    if (!error) setAssignedPlan(null);
  }

  function openDay(dow: number) {
    const existing = daysByDow.get(dow);
    setDayModalDow(dow);
    setDayLabelDraft(existing?.label ?? t(DAY_KEY[dow]));
  }

  async function createDay() {
    if (dayModalDow === null || !activeProgram) return;
    const { data } = await supabase
      .from("workout_days")
      .insert({ program_id: activeProgram.id, day_of_week: dayModalDow, label: dayLabelDraft || t(DAY_KEY[dayModalDow]) })
      .select().single();
    if (data) setDays((prev) => [...prev, { ...(data as WorkoutDay), exercises: [] }]);
  }

  function openAddExercise() {
    setEditingExercise(null);
    const count = daysByDow.get(dayModalDow!)?.exercises.length ?? 0;
    setExerciseForm({ ...emptyExerciseForm, sort_order: String(count + 1) });
    setShowExerciseModal(true);
  }

  function openEditExercise(ex: Exercise) {
    setEditingExercise(ex);
    setExerciseForm({
      exercise_name: ex.exercise_name,
      target_sets: String(ex.target_sets ?? ""),
      target_reps_min: String(ex.target_reps_min ?? ""),
      target_reps_max: String(ex.target_reps_max ?? ""),
      rest_seconds: String(ex.rest_seconds ?? ""),
      sort_order: String(ex.sort_order),
      notes: ex.notes ?? "",
    });
    setShowExerciseModal(true);
  }

  async function saveExercise() {
    if (!exerciseForm.exercise_name || dayModalDow === null) return;
    const day = daysByDow.get(dayModalDow);
    if (!day) return;
    setSaving(true);
    const payload = {
      program_day_id: day.id, exercise_name: exerciseForm.exercise_name,
      target_sets: parseInt(exerciseForm.target_sets) || null,
      target_reps_min: parseInt(exerciseForm.target_reps_min) || null,
      target_reps_max: parseInt(exerciseForm.target_reps_max) || null,
      rest_seconds: parseInt(exerciseForm.rest_seconds) || null,
      sort_order: parseInt(exerciseForm.sort_order) || 0,
      notes: exerciseForm.notes || null,
    };
    const sortFn = (a: Exercise, b: Exercise) => a.sort_order - b.sort_order;
    if (editingExercise) {
      const { data } = await supabase.from("workout_exercises").update(payload).eq("id", editingExercise.id).select().single();
      if (data) setDays((prev) => prev.map((d) => d.id === day.id
        ? { ...d, exercises: d.exercises.map((e) => (e.id === editingExercise.id ? (data as Exercise) : e)).sort(sortFn) } : d));
    } else {
      const { data } = await supabase.from("workout_exercises").insert(payload).select().single();
      if (data) setDays((prev) => prev.map((d) => d.id === day.id
        ? { ...d, exercises: [...d.exercises, data as Exercise].sort(sortFn) } : d));
    }
    setShowExerciseModal(false);
    setSaving(false);
  }

  async function deleteExercise(ex: Exercise) {
    await supabase.from("workout_exercises").delete().eq("id", ex.id);
    setDays((prev) => prev.map((d) => d.id === ex.program_day_id
      ? { ...d, exercises: d.exercises.filter((e) => e.id !== ex.id) } : d));
  }

  function openLogModal() {
    setLogForm({ ...emptyLogForm, workout_day_id: days[0]?.id ?? "" });
    setShowLogModal(true);
  }

  function onLogDayChange(dayId: string) {
    const day = days.find((d) => d.id === dayId);
    const firstEx = day?.exercises[0];
    setLogForm({ ...logForm, workout_day_id: dayId, program_exercise_id: firstEx?.id ?? "",
      exercise_name: firstEx?.exercise_name ?? "", weight_kg: "", sets_completed: "", reps_per_set: "", notes: "" });
  }

  function onLogExerciseChange(exId: string) {
    const day = days.find((d) => d.id === logForm.workout_day_id);
    const ex = day?.exercises.find((e) => e.id === exId);
    setLogForm({ ...logForm, program_exercise_id: exId, exercise_name: ex?.exercise_name ?? "",
      sets_completed: String(ex?.target_sets ?? "") });
  }

  async function saveLog() {
    if (!logForm.program_exercise_id || !user) return;
    setSaving(true);
    await supabase.from("workout_logs").insert({
      user_id: user.id, program_exercise_id: logForm.program_exercise_id, exercise_name: logForm.exercise_name,
      workout_day_id: logForm.workout_day_id || null, sets_completed: parseInt(logForm.sets_completed) || null,
      reps_per_set: logForm.reps_per_set || null, weight_kg: parseFloat(logForm.weight_kg) || null,
      logged_date: new Date().toISOString().slice(0, 10), notes: logForm.notes || null,
    });
    setShowLogModal(false);
    setSaving(false);
    await loadStats();
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  const currentModalDay = dayModalDow !== null ? daysByDow.get(dayModalDow) : undefined;
  const logDay = days.find((d) => d.id === logForm.workout_day_id);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-content-strong">
            <Dumbbell className="h-6 w-6 text-primary-600" />
            {t("workout.title")}
          </h1>
          <p className="mt-1 text-sm text-content-muted">{t("workout.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => navigate("/workout/progression")}>
            <TrendingUp className="h-4 w-4" />
            {t("workout.progressionChart")}
          </Button>
          <Button className="gap-2" onClick={() => setShowProgramModal(true)}>
            <Plus className="h-4 w-4" />
            {t("workout.newProgram")}
          </Button>
        </div>
      </header>

      {assignedPlan && (assignedPlan.content as WorkoutPlanContent)?.days?.length ? (
        <Card className="border-primary-300 bg-surface-card">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary-600" />
                <h2 className="text-base font-bold text-content-strong">{assignedPlan.title}</h2>
              </div>
              <button onClick={deleteAssignedPlan} className="rounded-lg p-1.5 text-content-muted transition-colors hover:bg-red-50 hover:text-red-600" title="Excluir plano de treino">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {assignedPlan.description && <p className="mb-4 text-xs text-content-muted">{assignedPlan.description}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(assignedPlan.content as WorkoutPlanContent).days!.map((d, i) => (
                <div key={i} className="rounded-xl border border-edge-base bg-surface-subtle p-4">
                  <p className="mb-2 text-sm font-bold text-primary-600">{d.name}</p>
                  {d.exercises ? (
                    <p className="text-xs text-content-body whitespace-pre-line">{d.exercises}</p>
                  ) : (
                    <p className="text-xs italic text-content-muted">{t("workout.restDay")}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {programs.length === 0 && !assignedPlan && recommendedWorkout ? (
        <Card className="border-primary-300 bg-gradient-to-br from-primary-50/50 to-surface-card">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary-600" />
              <h2 className="text-base font-bold text-content-strong">Treino recomendado para voce</h2>
            </div>
            <p className="mb-4 text-xs text-content-muted">Personalizado com base no seu questionario inicial. Crie um programa para comecar a registrar seu progresso.</p>
            <div className="flex flex-col gap-3">
              {recommendedWorkout.map((day, i) => (
                <div key={i} className="rounded-xl border border-edge-base p-3">
                  <p className="mb-2 text-sm font-semibold text-content-strong">{day.dayName}</p>
                  <div className="flex flex-col gap-1.5">
                    {day.exercises.map((ex, j) => (
                      <div key={j} className="flex items-center justify-between text-xs text-content-body">
                        <span>{ex.name}</span>
                        <span className="font-medium text-content-muted">{ex.sets}x {ex.reps}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Button className="mt-4 w-full gap-2" onClick={() => setShowProgramModal(true)}>
              <Plus className="h-4 w-4" />
              Criar programa a partir da recomendacao
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {programs.length === 0 && !assignedPlan && !recommendedWorkout ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Dumbbell className="mb-3 h-12 w-12 text-slate-300" />
            <h3 className="text-base font-semibold text-content-body">{t("workout.noPrograms")}</h3>
            <Button className="mt-4 gap-2" onClick={() => setShowProgramModal(true)}>
              <Plus className="h-4 w-4" />
              {t("workout.createFirst")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-content-muted">{t("workout.myPrograms")}</h2>
            <div className="flex flex-wrap gap-2">
              {programs.map((p) => (
                <div
                  key={p.id}
                  className={`group flex items-center gap-2 rounded-xl border px-4 py-2.5 text-left transition-all ${
                    activeProgram?.id === p.id
                      ? "border-primary-500 bg-primary-50 ring-1 ring-primary-200"
                      : "border-edge-base bg-surface-card hover:border-primary-300 hover:bg-surface-subtle"
                  }`}
                >
                  <button onClick={() => activateProgram(p)} className="flex flex-1 flex-col">
                    <span className="text-sm font-semibold text-content-strong">{p.name}</span>
                    {activeProgram?.id === p.id ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-primary-600">
                        <Check className="h-3 w-3" /> {t("workout.active")}
                      </span>
                    ) : (
                      <span className="text-[11px] text-content-muted">{t("workout.activate")}</span>
                    )}
                  </button>
                  <button
                    onClick={() => deleteProgram(p)}
                    className="shrink-0 text-slate-300 transition-colors hover:text-red-500"
                    title="Excluir programa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            {activeProgram?.description && <p className="mt-3 text-sm text-content-muted">{activeProgram.description}</p>}
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard icon={Activity} color="primary" value={String(stats.total)} label={t("workout.totalSessions")} />
            <StatCard icon={Flame} color="orange" value={`${stats.maxWeight} kg`} label={t("workout.maxWeight")} />
            <StatCard icon={Calendar} color="green" value={stats.lastSession ? new Date(stats.lastSession).toLocaleDateString() : "—"} label={t("workout.lastSession")} />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-content-muted">{t("workout.week")}</h2>
              <Button size="sm" className="gap-1.5" onClick={openLogModal} disabled={days.length === 0}>
                <Plus className="h-3.5 w-3.5" />
                {t("workout.logWorkout")}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
              {DAY_ORDER.map((dow) => {
                const day = daysByDow.get(dow);
                const isRest = !day;
                return (
                  <button
                    key={dow}
                    onClick={() => openDay(dow)}
                    className={`flex min-h-[140px] flex-col gap-2 rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                      isRest ? "border-dashed border-edge-base bg-surface-subtle" : "border-edge-base bg-surface-card hover:border-primary-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-content-strong">{t(DAY_KEY[dow])}</span>
                      {day && (
                        <span className="rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold text-primary-600">
                          {day.exercises.length}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5 overflow-hidden">
                      {isRest ? (
                        <span className="text-xs italic text-content-muted">{t("workout.restDay")}</span>
                      ) : day.exercises.length === 0 ? (
                        <span className="text-xs italic text-content-muted">{t("workout.emptyDay")}</span>
                      ) : (
                        day.exercises.slice(0, 4).map((ex) => (
                          <div key={ex.id} className="truncate rounded-lg bg-surface-subtle px-2 py-1 text-xs text-content-body">
                            <span className="font-medium">{ex.exercise_name}</span>
                            <span className="ml-1 text-content-muted">
                              {ex.target_sets}×{ex.target_reps_min}
                              {ex.target_reps_max && ex.target_reps_max !== ex.target_reps_min ? `-${ex.target_reps_max}` : ""}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-primary-600">
                      {t("edit")} <ChevronRight className="h-3 w-3" />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}

      {showProgramModal && (
        <Modal title={t("workout.newProgram")} onClose={() => setShowProgramModal(false)}>
          <div className="space-y-3">
            <Field label={t("workout.programName")}>
              <Input value={programForm.name} onChange={(e) => setProgramForm((p) => ({ ...p, name: e.target.value }))} autoFocus />
            </Field>
            <Field label={t("workout.programDesc")}>
              <Input value={programForm.description} onChange={(e) => setProgramForm((p) => ({ ...p, description: e.target.value }))} />
            </Field>
          </div>
          <ModalActions saving={saving} disabled={!programForm.name} onSave={saveProgram} onCancel={() => setShowProgramModal(false)} t={t} />
        </Modal>
      )}

      {dayModalDow !== null && (
        <Modal title={`${t(DAY_KEY[dayModalDow])} — ${t("workout.exercises")}`} onClose={() => setDayModalDow(null)}>
          {!currentModalDay ? (
            <div className="space-y-3">
              <Field label={t("workout.dayLabel")}>
                <Input value={dayLabelDraft} onChange={(e) => setDayLabelDraft(e.target.value)} autoFocus />
              </Field>
              <Button className="w-full gap-2" onClick={createDay}>
                <Plus className="h-4 w-4" />
                {t("workout.addDay")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Input
                value={currentModalDay.label}
                onChange={(e) => setDays((prev) => prev.map((d) => (d.id === currentModalDay.id ? { ...d, label: e.target.value } : d)))}
              />
              <div className="flex flex-col gap-2">
                {currentModalDay.exercises.length === 0 ? (
                  <p className="py-4 text-center text-sm text-content-muted">{t("workout.emptyDay")}</p>
                ) : (
                  currentModalDay.exercises.map((ex) => (
                    <div key={ex.id} className="flex items-start justify-between gap-2 rounded-xl border border-edge-base bg-surface-subtle p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-content-strong">{ex.exercise_name}</p>
                        <p className="mt-0.5 text-xs text-content-muted">
                          {ex.target_sets} {t("workout.targetSets").toLowerCase()} · {ex.target_reps_min}
                          {ex.target_reps_max && ex.target_reps_max !== ex.target_reps_min ? `-${ex.target_reps_max}` : ""} reps · {ex.rest_seconds}s
                        </p>
                        {ex.notes && <p className="mt-1 text-xs italic text-content-muted">{ex.notes}</p>}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button onClick={() => openEditExercise(ex)} className="text-slate-400 hover:text-primary-500"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => deleteExercise(ex)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <Button variant="outline" className="w-full gap-2" onClick={openAddExercise}>
                <Plus className="h-4 w-4" />
                {t("workout.addExercise")}
              </Button>
            </div>
          )}
        </Modal>
      )}

      {showExerciseModal && (
        <Modal title={editingExercise ? t("edit") : t("workout.addExercise")} onClose={() => setShowExerciseModal(false)}>
          <div className="space-y-3">
            <Field label={t("workout.exerciseName")}>
              <Input value={exerciseForm.exercise_name} onChange={(e) => setEx("exercise_name", e.target.value)} autoFocus />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("workout.targetSets")}><Input type="number" value={exerciseForm.target_sets} onChange={(e) => setEx("target_sets", e.target.value)} /></Field>
              <Field label={t("workout.restSeconds")}><Input type="number" value={exerciseForm.rest_seconds} onChange={(e) => setEx("rest_seconds", e.target.value)} /></Field>
              <Field label={t("workout.repsMin")}><Input type="number" value={exerciseForm.target_reps_min} onChange={(e) => setEx("target_reps_min", e.target.value)} /></Field>
              <Field label={t("workout.repsMax")}><Input type="number" value={exerciseForm.target_reps_max} onChange={(e) => setEx("target_reps_max", e.target.value)} /></Field>
            </div>
            <Field label="Sort"><Input type="number" value={exerciseForm.sort_order} onChange={(e) => setEx("sort_order", e.target.value)} /></Field>
            <Field label={t("workout.notes")}><Input value={exerciseForm.notes} onChange={(e) => setEx("notes", e.target.value)} /></Field>
          </div>
          <ModalActions saving={saving} disabled={!exerciseForm.exercise_name} onSave={saveExercise} onCancel={() => setShowExerciseModal(false)} t={t} />
        </Modal>
      )}

      {showLogModal && (
        <Modal title={t("workout.logWorkout")} onClose={() => setShowLogModal(false)}>
          <div className="space-y-3">
            <Field label={t("workout.dayOfWeek")}>
              <select className={selectClass} value={logForm.workout_day_id} onChange={(e) => onLogDayChange(e.target.value)}>
                {days.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </Field>
            <Field label={t("workout.selectExercise")}>
              <select className={selectClass} value={logForm.program_exercise_id} onChange={(e) => onLogExerciseChange(e.target.value)}>
                <option value="" disabled>{t("workout.selectExercise")}</option>
                {logDay?.exercises.map((ex) => <option key={ex.id} value={ex.id}>{ex.exercise_name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("workout.weightKg")}><Input type="number" step="any" value={logForm.weight_kg} onChange={(e) => setLogForm((p) => ({ ...p, weight_kg: e.target.value }))} /></Field>
              <Field label={t("workout.setsCompleted")}><Input type="number" value={logForm.sets_completed} onChange={(e) => setLogForm((p) => ({ ...p, sets_completed: e.target.value }))} /></Field>
            </div>
            <Field label={t("workout.repsPerSet")}><Input placeholder="10,10,8" value={logForm.reps_per_set} onChange={(e) => setLogForm((p) => ({ ...p, reps_per_set: e.target.value }))} /></Field>
            <Field label={t("workout.notes")}><Input value={logForm.notes} onChange={(e) => setLogForm((p) => ({ ...p, notes: e.target.value }))} /></Field>
          </div>
          <ModalActions saving={saving} disabled={!logForm.program_exercise_id} onSave={saveLog} onCancel={() => setShowLogModal(false)} t={t} />
        </Modal>
      )}
    </div>
  );
}

type TFn = (key: string) => string;

function StatCard({ icon: Icon, color, value, label }: { icon: typeof Activity; color: string; value: string; label: string }) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary-50 text-primary-600",
    orange: "bg-orange-50 text-orange-500",
    green: "bg-green-50 text-green-600",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xl font-bold text-content-strong">{value}</p>
          <p className="text-xs text-content-muted">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-content-body">{label}</label>
      {children}
    </div>
  );
}

function ModalActions({ saving, disabled, onSave, onCancel, t }: { saving: boolean; disabled: boolean; onSave: () => void; onCancel: () => void; t: TFn }) {
  return (
    <div className="mt-5 flex gap-3">
      <Button variant="outline" className="flex-1" onClick={onCancel}>{t("cancel")}</Button>
      <Button className="flex-1" onClick={onSave} disabled={saving || disabled}>
        {saving ? t("saving") : t("save")}
      </Button>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface-card p-6 shadow-xl transition-transform sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-content-strong">{title}</h2>
          <button onClick={onClose} className="text-content-muted transition-colors hover:text-content-body">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
