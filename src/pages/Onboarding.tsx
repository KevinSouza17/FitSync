import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Target, Dumbbell, Salad, Calendar, Loader2, Check, ChevronRight,
  ChevronLeft, AlertTriangle, Sparkles, Heart, Shield,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { FitSyncLogo } from "../components/FitSyncLogo";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { supabase } from "../lib/supabase";
import { generateDietPlan, generateWorkoutPlan, goalLabel } from "../lib/recommendations";
import type { Diet, Experience, Goal, RecommendationAnswers } from "../lib/recommendations";

type Answers = Omit<RecommendationAnswers, "allergies"> & { allergies: string };

const goalOptions: { value: Goal; labelKey: string; icon: typeof Target }[] = [
  { value: "lose_weight", labelKey: "onboarding.goalLoseWeight", icon: Target },
  { value: "build_muscle", labelKey: "onboarding.goalBuildMuscle", icon: Dumbbell },
  { value: "maintain", labelKey: "onboarding.goalMaintain", icon: Shield },
  { value: "endurance", labelKey: "onboarding.goalEndurance", icon: Heart },
  { value: "general", labelKey: "onboarding.goalGeneral", icon: Sparkles },
];

const experienceOptions: { value: Experience; labelKey: string; subKey: string }[] = [
  { value: "beginner", labelKey: "onboarding.expBeginner", subKey: "onboarding.expBeginnerSub" },
  { value: "intermediate", labelKey: "onboarding.expIntermediate", subKey: "onboarding.expIntermediateSub" },
  { value: "advanced", labelKey: "onboarding.expAdvanced", subKey: "onboarding.expAdvancedSub" },
];

const dietOptions: { value: Diet; labelKey: string; icon: typeof Salad }[] = [
  { value: "omnivore", labelKey: "onboarding.dietOmnivore", icon: Salad },
  { value: "vegetarian", labelKey: "onboarding.dietVegetarian", icon: Salad },
  { value: "vegan", labelKey: "onboarding.dietVegan", icon: Salad },
  { value: "low_carb", labelKey: "onboarding.dietLowCarb", icon: Salad },
  { value: "flexible", labelKey: "onboarding.dietFlexible", icon: Salad },
];

const equipmentOptions: { value: string; labelKey: string }[] = [
  { value: "gym", labelKey: "onboarding.equipGym" },
  { value: "home", labelKey: "onboarding.equipHome" },
  { value: "bodyweight", labelKey: "onboarding.equipBodyweight" },
  { value: "dumbbells", labelKey: "onboarding.equipDumbbells" },
  { value: "bands", labelKey: "onboarding.equipBands" },
];

const dayOptions = [2, 3, 4, 5, 6];


export function Onboarding() {
  const { user, refreshProfile } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [plan, setPlan] = useState<{ workout: ReturnType<typeof generateWorkoutPlan>; diet: ReturnType<typeof generateDietPlan> } | null>(null);
  const [answers, setAnswers] = useState<Answers>({
    goal: "general",
    experience: "beginner",
    workout_days: 3,
    diet: "flexible",
    allergies: "",
    equipment: ["gym"],
  });

  const totalSteps = 5;

  function next() {
    if (step < totalSteps - 1) setStep(step + 1);
    else finish();
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  function toggleEquipment(value: string) {
    setAnswers((prev) => ({
      ...prev,
      equipment: prev.equipment.includes(value)
        ? prev.equipment.filter((e) => e !== value)
        : [...prev.equipment, value],
    }));
  }

  async function finish() {
    setSubmitting(true);
    const recommendationAnswers: RecommendationAnswers = { ...answers, allergies: answers.allergies };
    const workout = generateWorkoutPlan(recommendationAnswers);
    const diet = generateDietPlan(recommendationAnswers);

    const allergiesArray = answers.allergies
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    // Save onboarding answers
    await supabase.from("onboarding_answers").upsert({
      user_id: user?.id,
      goal: answers.goal,
      experience_level: answers.experience,
      workout_days: answers.workout_days,
      diet_preference: answers.diet,
      allergies: allergiesArray.length > 0 ? allergiesArray : null,
      equipment: answers.equipment,
    });

    // Create workout program
    const { data: program } = await supabase
      .from("workout_programs")
      .insert({
        user_id: user?.id,
        name: `Plano ${goalLabel(answers.goal)}`,
        description: `Gerado automaticamente - ${answers.workout_days} dias/semana`,
        is_active: true,
      })
      .select()
      .single();

    if (program) {
      // Deactivate other programs
      await supabase
        .from("workout_programs")
        .update({ is_active: false })
        .neq("id", program.id)
        .eq("user_id", user?.id);

      // Insert workout days and exercises
      for (let i = 0; i < workout.length; i++) {
        const day = workout[i];
        const { data: dayRow } = await supabase
          .from("workout_days")
          .insert({
            program_id: program.id,
            day_of_week: i,
            label: day.dayName,
          })
          .select()
          .single();

        if (dayRow) {
          for (let j = 0; j < day.exercises.length; j++) {
            const ex = day.exercises[j];
            await supabase.from("workout_exercises").insert({
              program_day_id: dayRow.id,
              exercise_name: ex.name,
              target_sets: ex.sets,
              target_reps_min: parseInt(ex.reps.split("-")[0]) || 10,
              target_reps_max: parseInt(ex.reps.split("-")[1] || ex.reps.split("-")[0]) || 10,
              rest_seconds: ex.rest,
              sort_order: j,
            });
          }
        }
      }
    }

    // Update profile with calorie goal + onboarding flag
    const calTarget = diet.reduce((s, m) => s + m.calories, 0);
    await supabase
      .from("profiles")
      .update({
        health_goal: goalLabel(answers.goal),
        daily_calorie_goal: calTarget,
        onboarding_completed: true,
        onboarding_due_at: null,
      })
      .eq("id", user?.id);

    await refreshProfile();
    setPlan({ workout, diet });
    setSubmitting(false);
    setDone(true);
  }


  if (done && plan) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50 to-primary-50">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-content-strong">{t("onboarding.planReady")}</h1>
            <p className="mt-2 text-sm text-content-muted">{t("onboarding.planReadySub")}</p>
          </CardContent>
        </Card>

        {/* Professional notice */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm leading-relaxed text-amber-800">{t("onboarding.professionalNotice")}</p>
          </CardContent>
        </Card>

        {/* Workout plan */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-content-strong">
              <Dumbbell className="h-5 w-5 text-primary-600" />
              {t("onboarding.workoutPlan")}
            </h2>
            <div className="flex flex-col gap-3">
              {plan.workout.map((day, i) => (
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
          </CardContent>
        </Card>

        {/* Diet plan */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-content-strong">
              <Salad className="h-5 w-5 text-primary-600" />
              {t("onboarding.dietPlan")}
            </h2>
            <div className="flex flex-col gap-3">
              {plan.diet.map((meal, i) => (
                <div key={i} className="rounded-xl border border-edge-base p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-content-strong">{meal.meal}</p>
                    <span className="text-xs font-medium text-primary-600">{meal.calories} kcal</span>
                  </div>
                  <p className="mt-1 text-xs text-content-body">{meal.items}</p>
                  <p className="mt-1 text-[11px] text-content-muted">~{meal.protein}g proteína</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button size="lg" onClick={() => navigate("/dashboard")} className="gap-2">
          {t("onboarding.viewDashboard")}
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-surface-base">
      {/* Header */}
      <div className="border-b border-edge-base bg-surface-card px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <FitSyncLogo size="sm" />
          <button onClick={() => navigate("/dashboard")} className="text-sm font-medium text-content-muted hover:text-content-body">
            {t("onboarding.skip")}
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {/* Progress bar */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-content-muted">
              {t("onboarding.step").replace("{current}", String(step + 1)).replace("{total}", String(totalSteps))}
            </span>
            <span className="text-xs font-medium text-primary-600">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-subtle">
            <div className="h-full rounded-full bg-primary-600 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Step content */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-bold text-content-strong">{t("onboarding.goal")}</h1>
              <p className="mt-1 text-sm text-content-muted">{t("onboarding.goalSub")}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {goalOptions.map((opt) => {
                const Icon = opt.icon;
                const selected = answers.goal === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { setAnswers({ ...answers, goal: opt.value }); setTimeout(next, 200); }}
                    className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                      selected ? "border-primary-600 bg-primary-50" : "border-edge-base bg-surface-card hover:border-slate-300"
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${selected ? "bg-primary-600 text-white" : "bg-slate-100 text-content-muted"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`text-sm font-semibold ${selected ? "text-primary-700" : "text-content-body"}`}>{t(opt.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-bold text-content-strong">{t("onboarding.experience")}</h1>
              <p className="mt-1 text-sm text-content-muted">{t("onboarding.experienceSub")}</p>
            </div>
            <div className="flex flex-col gap-3">
              {experienceOptions.map((opt) => {
                const selected = answers.experience === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { setAnswers({ ...answers, experience: opt.value }); setTimeout(next, 200); }}
                    className={`flex items-center justify-between rounded-xl border-2 p-4 text-left transition-all ${
                      selected ? "border-primary-600 bg-primary-50" : "border-edge-base bg-surface-card hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-semibold ${selected ? "text-primary-700" : "text-content-body"}`}>{t(opt.labelKey)}</p>
                      <p className="mt-0.5 text-xs text-content-muted">{t(opt.subKey)}</p>
                    </div>
                    {selected && <Check className="h-5 w-5 text-primary-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-bold text-content-strong">{t("onboarding.days")}</h1>
              <p className="mt-1 text-sm text-content-muted">{t("onboarding.daysSub")}</p>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {dayOptions.map((d) => {
                const selected = answers.workout_days === d;
                return (
                  <button
                    key={d}
                    onClick={() => { setAnswers({ ...answers, workout_days: d }); setTimeout(next, 200); }}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 py-4 transition-all ${
                      selected ? "border-primary-600 bg-primary-50" : "border-edge-base bg-surface-card hover:border-slate-300"
                    }`}
                  >
                    <Calendar className={`h-5 w-5 ${selected ? "text-primary-600" : "text-content-muted"}`} />
                    <span className={`text-lg font-bold ${selected ? "text-primary-700" : "text-content-strong"}`}>{d}</span>
                    <span className="text-[10px] text-content-muted">dias</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-bold text-content-strong">{t("onboarding.diet")}</h1>
              <p className="mt-1 text-sm text-content-muted">{t("onboarding.dietSub")}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {dietOptions.map((opt) => {
                const selected = answers.diet === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { setAnswers({ ...answers, diet: opt.value }); setTimeout(next, 200); }}
                    className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                      selected ? "border-primary-600 bg-primary-50" : "border-edge-base bg-surface-card hover:border-slate-300"
                    }`}
                  >
                    <Salad className={`h-5 w-5 ${selected ? "text-primary-600" : "text-content-muted"}`} />
                    <span className={`text-sm font-semibold ${selected ? "text-primary-700" : "text-content-body"}`}>{t(opt.labelKey)}</span>
                    {selected && <Check className="ml-auto h-5 w-5 text-primary-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl font-bold text-content-strong">{t("onboarding.equipment")}</h1>
              <p className="mt-1 text-sm text-content-muted">{t("onboarding.equipmentSub")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {equipmentOptions.map((opt) => {
                const selected = answers.equipment.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleEquipment(opt.value)}
                    className={`rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all ${
                      selected ? "border-primary-600 bg-primary-50 text-primary-700" : "border-edge-base bg-surface-card text-content-body hover:border-slate-300"
                    }`}
                  >
                    {t(opt.labelKey)}
                  </button>
                );
              })}
            </div>

            <div className="mt-2">
              <label className="text-sm font-medium text-content-body">{t("onboarding.allergies")}</label>
              <p className="mb-2 text-xs text-content-muted">{t("onboarding.allergiesSub")}</p>
              <Input
                type="text"
                value={answers.allergies}
                onChange={(e) => setAnswers({ ...answers, allergies: e.target.value })}
                placeholder="Ex: glúten, lactose, amendoim..."
              />
            </div>

            {/* Professional notice */}
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="flex items-start gap-3 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <p className="text-sm leading-relaxed text-amber-800">{t("onboarding.professionalNotice")}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-auto flex items-center justify-between pt-4">
          <Button
            variant="outline"
            onClick={back}
            disabled={step === 0 || submitting}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("onboarding.back")}
          </Button>
          {step === totalSteps - 1 ? (
            <Button onClick={finish} disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {submitting ? t("onboarding.generating") : t("onboarding.finish")}
            </Button>
          ) : (
            <Button onClick={next} className="gap-2">
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
