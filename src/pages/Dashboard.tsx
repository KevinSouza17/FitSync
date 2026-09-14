import { useEffect, useState, useRef } from "react";
import { Droplets, Flame, Scale, Plus, X, Search, UtensilsCrossed, Coffee, Sun, Moon, Cookie, Trash2, SlidersHorizontal } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import type { Meal, ClientPlan } from "../lib/types";

const today = new Date().toISOString().slice(0, 10);

interface DietPlanContent {
  meals?: { name: string; items: string }[];
}

interface Food {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  serving_size: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

interface MealForm {
  name: string;
  meal_type: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
}

const emptyForm: MealForm = {
  name: "",
  meal_type: "snack",
  calories: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
  fiber_g: "",
};

export function Dashboard() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [waterTotal, setWaterTotal] = useState(0);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMealModal, setShowMealModal] = useState(false);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [form, setForm] = useState<MealForm>(emptyForm);
  const [waterAmount, setWaterAmount] = useState("0.25");
  const [newWeight, setNewWeight] = useState("");
  const [saving, setSaving] = useState(false);

  const [foodSearch, setFoodSearch] = useState("");
  const [foodResults, setFoodResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [servings, setServings] = useState("1");
  const [unitMode, setUnitMode] = useState<"portions" | "grams">("portions");
  const [grams, setGrams] = useState("100");
  const [customEntry, setCustomEntry] = useState(false);
  const [showMacroModal, setShowMacroModal] = useState(false);
  const [macroProtein, setMacroProtein] = useState(30);
  const [macroCarbs, setMacroCarbs] = useState(45);
  const [macroFat, setMacroFat] = useState(25);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const mealTypeLabels: Record<string, string> = {
    breakfast: t("meal.breakfast"),
    lunch: t("meal.lunch"),
    dinner: t("meal.dinner"),
    snack: t("meal.snack"),
  };

  const mealTypeOptions = [
    { value: "breakfast", label: t("meal.breakfast") },
    { value: "lunch", label: t("meal.lunch") },
    { value: "dinner", label: t("meal.dinner") },
    { value: "snack", label: t("meal.snack") },
  ];

  const [dietPlan, setDietPlan] = useState<ClientPlan | null>(null);
  const [streak, setStreak] = useState<{ current_streak: number; longest_streak: number } | null>(null);
  const [recommendedMeals, setRecommendedMeals] = useState<{ meal: string; items: string; calories: number; protein: number }[] | null>(null);

  const calGoal = dietPlan?.target_calories ?? profile?.daily_calorie_goal ?? 2400;
  const waterGoal = profile?.daily_water_goal_liters ?? 2.5;
  const pPct = profile?.macro_protein_pct ?? 30;
  const cPct = profile?.macro_carbs_pct ?? 45;
  const fPct = profile?.macro_fat_pct ?? 25;

  useEffect(() => {
    loadData();
  }, []);

  // Realtime subscriptions for live updates
  useEffect(() => {
    const mealsChannel = supabase
      .channel("meals-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "meals", filter: `logged_date=eq.${today}` },
        () => loadData()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "water_logs", filter: `logged_date=eq.${today}` },
        () => loadData()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "weight_logs" },
        () => loadData()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "client_plans" },
        () => loadData()
      )
      .subscribe();
    return () => { supabase.removeChannel(mealsChannel); };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setFoodResults([]);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function loadData() {
    setLoading(true);
    const [mealsRes, waterRes, weightRes, planRes, streakRes, onboardingRes] = await Promise.all([
      supabase.from("meals").select("*").eq("logged_date", today).order("created_at"),
      supabase.from("water_logs").select("amount_liters").eq("logged_date", today),
      supabase.from("weight_logs").select("weight_kg, logged_date").order("logged_date", { ascending: false }).limit(1),
      supabase.from("client_plans").select("*").eq("client_id", user?.id ?? "").eq("plan_type", "diet").eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("diet_streaks").select("current_streak, longest_streak").eq("user_id", user?.id ?? "").maybeSingle(),
      supabase.from("onboarding_answers").select("*").eq("user_id", user?.id ?? "").maybeSingle(),
    ]);
    if (mealsRes.data) setMeals(mealsRes.data);
    if (waterRes.data) {
      setWaterTotal(waterRes.data.reduce((s, r) => s + Number(r.amount_liters), 0));
    }
    if (weightRes.data?.[0]) setLatestWeight(Number(weightRes.data[0].weight_kg));
    if (planRes.data) setDietPlan(planRes.data as ClientPlan);
    if (streakRes.data) setStreak(streakRes.data as { current_streak: number; longest_streak: number });
    // Generate personalized diet recommendation from onboarding answers if no pro plan and not dismissed
    if (!planRes.data && onboardingRes.data && !(onboardingRes.data as { recommendation_dismissed?: boolean }).recommendation_dismissed) {
      const oa = onboardingRes.data as {
        goal: string; experience_level: string; workout_days: number;
        diet_preference: string; allergies: string[] | null; equipment: string[] | null;
      };
      const { generateDietPlan } = await import("../lib/recommendations");
      const meals = generateDietPlan({
        goal: oa.goal as never,
        experience: oa.experience_level as never,
        workout_days: oa.workout_days,
        diet: oa.diet_preference as never,
        allergies: oa.allergies,
        equipment: oa.equipment ?? [],
      }, latestWeight ?? profile?.weight_kg ?? 75);
      setRecommendedMeals(meals);
    } else {
      setRecommendedMeals(null);
    }
    setLoading(false);
  }

  async function searchFoods(query: string) {
    if (!query.trim()) {
      setFoodResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from("foods")
      .select("*")
      .ilike("name", `%${query}%`)
      .limit(15);
    setFoodResults(data ?? []);
    setSearching(false);
  }

  function handleFoodSearch(value: string) {
    setFoodSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setFoodResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => searchFoods(value), 250);
  }

  function computeFromFood(food: Food, mode: "portions" | "grams", amount: string) {
    const n = mode === "grams"
      ? (parseFloat(amount) || 100) / 100
      : parseFloat(amount) || 1;
    setForm({
      ...form,
      name: food.name,
      calories: String(Math.round(food.calories * n)),
      protein_g: String((Number(food.protein_g) * n).toFixed(1)),
      carbs_g: String((Number(food.carbs_g) * n).toFixed(1)),
      fat_g: String((Number(food.fat_g) * n).toFixed(1)),
      fiber_g: String((Number(food.fiber_g) * n).toFixed(1)),
    });
  }

  function selectFood(food: Food) {
    setSelectedFood(food);
    setFoodSearch(food.name);
    setFoodResults([]);
    setServings("1");
    setGrams("100");
    setCustomEntry(false);
    computeFromFood(food, unitMode, unitMode === "grams" ? "100" : "1");
  }

  function updateAmount(value: string) {
    if (unitMode === "grams") setGrams(value);
    else setServings(value);
    if (!selectedFood) return;
    computeFromFood(selectedFood, unitMode, value);
  }

  function switchUnitMode(mode: "portions" | "grams") {
    setUnitMode(mode);
    if (!selectedFood) return;
    computeFromFood(selectedFood, mode, mode === "grams" ? grams : servings);
  }

  function openMealModal() {
    setForm(emptyForm);
    setFoodSearch("");
    setFoodResults([]);
    setSelectedFood(null);
    setServings("1");
    setGrams("100");
    setUnitMode("portions");
    setCustomEntry(false);
    setShowMealModal(true);
  }

  const mealTypeIcons: Record<string, React.ReactNode> = {
    breakfast: <Coffee className="h-3.5 w-3.5 text-amber-500" />,
    lunch: <Sun className="h-3.5 w-3.5 text-orange-500" />,
    dinner: <Moon className="h-3.5 w-3.5 text-indigo-400" />,
    snack: <Cookie className="h-3.5 w-3.5 text-primary-500" />,
  };

  const mealOrder = ["breakfast", "lunch", "dinner", "snack"];
  const groupedMeals = mealOrder.map((type) => ({
    type,
    label: mealTypeLabels[type] ?? type,
    items: meals.filter((m) => m.meal_type === type),
  })).filter((g) => g.items.length > 0);

  const totalCalories = meals.reduce((s, m) => s + m.calories, 0);
  const totalProtein = meals.reduce((s, m) => s + Number(m.protein_g), 0);
  const totalCarbs = meals.reduce((s, m) => s + Number(m.carbs_g), 0);
  const totalFat = meals.reduce((s, m) => s + Number(m.fat_g), 0);
  const totalFiber = meals.reduce((s, m) => s + Number(m.fiber_g ?? 0), 0);

  const proteinGoal = dietPlan?.target_protein_g != null ? Math.round(Number(dietPlan.target_protein_g)) : Math.round(calGoal * pPct / 100 / 4);
  const carbsGoal = dietPlan?.target_carbs_g != null ? Math.round(Number(dietPlan.target_carbs_g)) : Math.round(calGoal * cPct / 100 / 4);
  const fatGoal = dietPlan?.target_fat_g != null ? Math.round(Number(dietPlan.target_fat_g)) : Math.round(calGoal * fPct / 100 / 9);

  const calPct = Math.min(100, Math.round((totalCalories / calGoal) * 100));
  const radius = 80;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (calPct / 100) * circ;

  async function saveMeal() {
    if (!form.name || !form.calories) return;
    setSaving(true);
    const { data } = await supabase
      .from("meals")
      .insert({
        name: form.name,
        meal_type: form.meal_type,
        calories: parseInt(form.calories) || 0,
        protein_g: parseFloat(form.protein_g) || 0,
        carbs_g: parseFloat(form.carbs_g) || 0,
        fat_g: parseFloat(form.fat_g) || 0,
        fiber_g: parseFloat(form.fiber_g) || 0,
        logged_date: today,
      })
      .select()
      .single();
    if (data) setMeals((prev) => [...prev, data]);
    // Update streak
    if (user) {
      const { data: streakData } = await supabase.rpc("upsert_diet_streak", { p_user: user.id, p_log_date: today });
      if (streakData !== null) {
        setStreak((prev) => ({
          current_streak: streakData as number,
          longest_streak: Math.max(prev?.longest_streak ?? 0, streakData as number),
        }));
      }
    }
    setForm(emptyForm);
    setShowMealModal(false);
    setSaving(false);
  }

  async function deleteMeal(id: string) {
    await supabase.from("meals").delete().eq("id", id);
    setMeals((prev) => prev.filter((m) => m.id !== id));
  }

  async function deleteDietPlan() {
    if (!dietPlan) return;
    if (!confirm("Excluir o plano alimentar recebido?")) return;
    const { error } = await supabase.from("client_plans").delete().eq("id", dietPlan.id);
    if (error) {
      alert("Erro ao excluir plano: " + error.message);
    } else {
      setDietPlan(null);
    }
  }

  async function saveMacros() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        macro_protein_pct: macroProtein,
        macro_carbs_pct: macroCarbs,
        macro_fat_pct: macroFat,
      })
      .eq("id", user?.id ?? "");
    if (error) {
      alert("Erro ao salvar macros: " + error.message);
    } else {
      setShowMacroModal(false);
      window.location.reload();
    }
    setSaving(false);
  }

  async function logWater() {
    const amount = parseFloat(waterAmount);
    if (!amount || amount <= 0) return;
    setSaving(true);
    await supabase.from("water_logs").insert({ amount_liters: amount, logged_date: today });
    setWaterTotal((prev) => prev + amount);
    setShowWaterModal(false);
    setWaterAmount("0.25");
    setSaving(false);
  }

  async function logWeight() {
    const w = parseFloat(newWeight);
    if (!w || w <= 0) return;
    setSaving(true);
    await supabase.from("weight_logs").insert({ weight_kg: w, logged_date: today });
    setLatestWeight(w);
    setShowWeightModal(false);
    setNewWeight("");
    setSaving(false);
  }

  const summaryCards = [
    {
      title: t("dashboard.waterIntake"),
      value: `${waterTotal.toFixed(2).replace(/\.?0+$/, "")}L`,
      subtitle: `${t("dashboard.goal")}: ${waterGoal}L`,
      icon: Droplets,
      iconBg: "bg-primary-50",
      iconColor: "text-primary-500",
      onClick: () => setShowWaterModal(true),
    },
    {
      title: t("dashboard.caloriesConsumed"),
      value: String(totalCalories),
      subtitle: `${t("dashboard.goal")}: ${calGoal} kcal`,
      icon: Flame,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-500",
      onClick: openMealModal,
    },
    {
      title: t("dashboard.currentWeight"),
      value: latestWeight ? `${latestWeight} kg` : "–",
      subtitle: profile?.goal_weight_kg ? `${t("dashboard.goal")}: ${profile.goal_weight_kg} kg` : t("dashboard.logWeight"),
      icon: Scale,
      iconBg: "bg-green-50",
      iconColor: "text-green-500",
      onClick: () => setShowWeightModal(true),
    },
  ];

  const fiberGoal = 25;
  const macros = [
    { name: t("dashboard.protein"), current: totalProtein, goal: proteinGoal, unit: "g", color: "bg-primary-500" },
    { name: t("dashboard.carbs"), current: totalCarbs, goal: carbsGoal, unit: "g", color: "bg-orange-400" },
    { name: t("dashboard.fat"), current: totalFat, goal: fatGoal, unit: "g", color: "bg-violet-500" },
    { name: t("foods.fiber"), current: totalFiber, goal: fiberGoal, unit: "g", color: "bg-green-500" },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-strong">{t("dashboard.title")}</h1>
          <p className="mt-0.5 text-sm text-content-muted">
            {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Button className="gap-2" onClick={openMealModal}>
          <Plus className="h-4 w-4" />
          {t("dashboard.addMeal")}
        </Button>
      </header>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* Streak banner */}
          {streak && streak.current_streak > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-orange-700">Sequência de {streak.current_streak} {streak.current_streak === 1 ? "dia" : "dias"}!</p>
                <p className="text-xs text-orange-600">Continue registrando suas refeições para manter o pego. Recorde: {streak.longest_streak} dias</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {summaryCards.map((card) => (
              <Card
                key={card.title}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={card.onClick}
              >
                <CardContent className="flex flex-col gap-4 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-content-muted">{card.title}</span>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.iconBg}`}>
                      <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                    </div>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-content-strong">{card.value}</p>
                    <p className="mt-0.5 text-xs text-content-muted">{card.subtitle}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardContent className="flex flex-col gap-8 p-6 md:flex-row md:items-center">
                <div className="flex shrink-0 justify-center">
                  <div className="relative flex h-48 w-48 items-center justify-center">
                    <svg className="h-48 w-48 -rotate-90" viewBox="0 0 200 200">
                      <circle cx="100" cy="100" r={radius} fill="none" stroke="#EFF6FF" strokeWidth="16" />
                      <circle
                        cx="100" cy="100" r={radius} fill="none" stroke="#3B82F6" strokeWidth="16"
                        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
                        className="transition-all duration-700"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-content-strong">{totalCalories}</span>
                      <span className="mt-0.5 text-xs text-content-muted">de {calGoal} kcal</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-content-strong">{t("dashboard.macros")}</h3>
                    {!dietPlan && (
                      <button
                        onClick={() => {
                          setMacroProtein(pPct);
                          setMacroCarbs(cPct);
                          setMacroFat(fPct);
                          setShowMacroModal(true);
                        }}
                        className="rounded-lg p-1.5 text-content-muted transition-colors hover:bg-surface-base hover:text-primary-600"
                        title="Ajustar divisão de macros"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {macros.map((m) => (
                    <div key={m.name} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-content-body">{m.name}</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-semibold text-content-strong">{Math.round(m.current)}{m.unit}</span>
                          <span className="text-xs text-content-muted">/ {m.goal}{m.unit}</span>
                        </div>
                      </div>
                      <Progress
                        value={m.goal > 0 ? Math.min(100, (m.current / m.goal) * 100) : 0}
                        indicatorClassName={m.color}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col p-5">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-content-strong">{t("dashboard.meals")}</h3>
                  <button
                    onClick={openMealModal}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    + {t("add")}
                  </button>
                </div>
                {meals.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                    <Flame className="mb-2 h-8 w-8 text-slate-200" />
                    <p className="text-sm text-content-muted">{t("dashboard.noMeals")}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {groupedMeals.map((group) => (
                      <div key={group.type}>
                        <div className="mb-2 flex items-center gap-1.5">
                          {mealTypeIcons[group.type]}
                          <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">{group.label}</span>
                          <span className="text-xs text-content-muted">({group.items.reduce((s, m) => s + m.calories, 0)} kcal)</span>
                        </div>
                        <div className="flex flex-col">
                          {group.items.map((meal, i) => (
                            <div
                              key={meal.id}
                              className={`group flex items-start justify-between py-2.5 ${
                                i < group.items.length - 1 ? "border-b border-edge-base" : ""
                              }`}
                            >
                              <div>
                                <p className="text-sm font-medium text-content-strong">{meal.name}</p>
                                <p className="mt-0.5 text-xs text-content-muted">
                                  P:{Math.round(Number(meal.protein_g))}g C:{Math.round(Number(meal.carbs_g))}g G:{Math.round(Number(meal.fat_g))}g F:{Math.round(Number(meal.fiber_g ?? 0))}g
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-content-body">{meal.calories} kcal</span>
                                <button
                                  onClick={() => deleteMeal(meal.id)}
                                  className="hidden text-slate-300 hover:text-red-500 group-hover:block"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {dietPlan && (dietPlan.content as DietPlanContent)?.meals?.length ? (
              <Card>
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <UtensilsCrossed className="h-4 w-4 text-primary-600" />
                      <h3 className="text-base font-semibold text-content-strong">{dietPlan.title}</h3>
                    </div>
                    <button onClick={deleteDietPlan} className="rounded-lg p-1.5 text-content-muted transition-colors hover:bg-red-50 hover:text-red-600" title="Excluir plano alimentar">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {dietPlan.description && <p className="mb-3 text-xs text-content-muted">{dietPlan.description}</p>}
                  <div className="flex flex-col gap-2">
                    {(dietPlan.content as DietPlanContent).meals!.map((m, i) => (
                      <div key={i} className="rounded-xl border border-edge-base bg-surface-subtle p-3">
                        <p className="text-sm font-semibold text-content-strong">{m.name}</p>
                        {m.items && <p className="mt-1 text-xs text-content-body whitespace-pre-line">{m.items}</p>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : recommendedMeals && recommendedMeals.length > 0 ? (
              <Card>
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <UtensilsCrossed className="h-4 w-4 text-primary-600" />
                      <h3 className="text-base font-semibold text-content-strong">Plano alimentar recomendado</h3>
                    </div>
                    <button onClick={async () => { setRecommendedMeals(null); await supabase.from("onboarding_answers").update({ recommendation_dismissed: true }).eq("user_id", user?.id ?? ""); }} className="rounded-lg p-1.5 text-content-muted transition-colors hover:bg-red-50 hover:text-red-600" title="Remover recomendação">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mb-3 text-xs text-content-muted">Personalizado para voce com base no seu questionario inicial</p>
                  <div className="flex flex-col gap-2">
                    {recommendedMeals.map((m, i) => (
                      <div key={i} className="rounded-xl border border-edge-base bg-surface-subtle p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-content-strong">{m.meal}</p>
                          <span className="text-xs font-medium text-primary-600">{m.calories} kcal</span>
                        </div>
                        <p className="mt-1 text-xs text-content-body">{m.items}</p>
                        <p className="mt-1 text-[11px] text-content-muted">~{m.protein}g proteina</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </>
      )}

      {/* Meal Modal */}
      {showMealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-card p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-content-strong">{t("dashboard.registerMeal")}</h2>
              <button onClick={() => setShowMealModal(false)} className="text-content-muted hover:text-content-body">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mode toggle */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => { setCustomEntry(false); setSelectedFood(null); setForm(emptyForm); setFoodSearch(""); }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  !customEntry ? "bg-primary-50 text-primary-700" : "text-content-muted hover:bg-surface-base"
                }`}
              >
                <Search className="h-4 w-4" />
                {t("dashboard.searchFood")}
              </button>
              <button
                onClick={() => { setCustomEntry(true); setSelectedFood(null); setFoodResults([]); setForm(emptyForm); }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  customEntry ? "bg-primary-50 text-primary-700" : "text-content-muted hover:bg-surface-base"
                }`}
              >
                <UtensilsCrossed className="h-4 w-4" />
                {t("dashboard.manualEntry")}
              </button>
            </div>

            <div className="space-y-3">
              {/* Food search */}
              {!customEntry && (
                <div ref={searchRef} className="relative">
                  <label className="text-sm font-medium text-content-body">{t("dashboard.searchFood")} *</label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                    <Input
                      className="pl-9"
                      placeholder={t("dashboard.foodPlaceholder")}
                      value={foodSearch}
                      onChange={(e) => handleFoodSearch(e.target.value)}
                      autoFocus
                    />
                    {searching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
                      </div>
                    )}
                  </div>
                  {foodResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-edge-base bg-surface-card shadow-lg">
                      {foodResults.map((food) => (
                        <button
                          key={food.id}
                          onClick={() => selectFood(food)}
                          className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-primary-50 first:rounded-t-xl last:rounded-b-xl"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-content-strong truncate">{food.name}</p>
                            <p className="text-xs text-content-muted">
                              {food.brand && <span className="font-medium text-primary-500">{food.brand} · </span>}
                              {food.category} · {food.serving_size}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-content-body">{food.calories} kcal</p>
                            <p className="text-[10px] text-content-muted">
                              P:{food.protein_g}g C:{food.carbs_g}g G:{food.fat_g}g F:{food.fiber_g}g
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {foodSearch.trim().length > 2 && foodResults.length === 0 && !searching && (
                    <p className="mt-1.5 text-xs text-content-muted">{t("dashboard.noFoodFound")}</p>
                  )}
                </div>
              )}

              {/* Selected food info */}
              {selectedFood && !customEntry && (
                <div className="rounded-xl border border-primary-200 bg-primary-50 p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-content-strong">{selectedFood.name}</p>
                      <p className="text-xs text-content-muted">{selectedFood.category} · Porção: {selectedFood.serving_size}</p>
                    </div>
                    <button
                      onClick={() => { setSelectedFood(null); setFoodSearch(""); setForm(emptyForm); }}
                      className="text-content-muted hover:text-content-body"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex rounded-lg border border-primary-200 bg-surface-card p-0.5">
                      <button
                        onClick={() => switchUnitMode("portions")}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${unitMode === "portions" ? "bg-primary-500 text-white" : "text-content-muted hover:text-content-body"}`}
                      >
                        Porções
                      </button>
                      <button
                        onClick={() => switchUnitMode("grams")}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${unitMode === "grams" ? "bg-primary-500 text-white" : "text-content-muted hover:text-content-body"}`}
                      >
                        Gramas
                      </button>
                    </div>
                    <input
                      type="number"
                      step={unitMode === "grams" ? "5" : "0.5"}
                      min={unitMode === "grams" ? "1" : "0.25"}
                      value={unitMode === "grams" ? grams : servings}
                      onChange={(e) => updateAmount(e.target.value)}
                      className="w-24 rounded-lg border border-primary-300 bg-surface-card px-2 py-1 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-200"
                    />
                    <span className="text-xs text-content-muted">{unitMode === "grams" ? "g" : "porção(ões)"}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-5 gap-2 text-center">
                    <div className="rounded-lg bg-surface-card px-2 py-1">
                      <p className="text-sm font-bold text-content-strong">{form.calories}</p>
                      <p className="text-[10px] text-content-muted">kcal</p>
                    </div>
                    <div className="rounded-lg bg-surface-card px-2 py-1">
                      <p className="text-sm font-bold text-primary-600">{form.protein_g}</p>
                      <p className="text-[10px] text-content-muted">Prot (g)</p>
                    </div>
                    <div className="rounded-lg bg-surface-card px-2 py-1">
                      <p className="text-sm font-bold text-orange-600">{form.carbs_g}</p>
                      <p className="text-[10px] text-content-muted">Carb (g)</p>
                    </div>
                    <div className="rounded-lg bg-surface-card px-2 py-1">
                      <p className="text-sm font-bold text-amber-600">{form.fat_g}</p>
                      <p className="text-[10px] text-content-muted">Gord (g)</p>
                    </div>
                    <div className="rounded-lg bg-surface-card px-2 py-1">
                      <p className="text-sm font-bold text-green-600">{form.fiber_g || "0"}</p>
                      <p className="text-[10px] text-content-muted">Fibra (g)</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Meal type */}
              <div>
                <label className="text-sm font-medium text-content-body">{t("dashboard.mealType")}</label>
                <select
                  className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 py-2 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  value={form.meal_type}
                  onChange={(e) => setForm({ ...form, meal_type: e.target.value })}
                >
                  {mealTypeOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Manual entry fields */}
              {customEntry && (
                <>
                  <div>
                    <label className="text-sm font-medium text-content-body">{t("dashboard.mealName")} *</label>
                    <Input
                      className="mt-1"
                      placeholder="Ex: Frango com arroz"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-content-body">{t("dashboard.calories")} *</label>
                      <Input className="mt-1" type="number" placeholder="0" value={form.calories} onChange={(e) => setForm({ ...form, calories: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-content-body">{t("dashboard.protein")}</label>
                      <Input className="mt-1" type="number" placeholder="0" value={form.protein_g} onChange={(e) => setForm({ ...form, protein_g: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-content-body">{t("dashboard.carbs")}</label>
                      <Input className="mt-1" type="number" placeholder="0" value={form.carbs_g} onChange={(e) => setForm({ ...form, carbs_g: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-content-body">{t("dashboard.fat")}</label>
                      <Input className="mt-1" type="number" placeholder="0" value={form.fat_g} onChange={(e) => setForm({ ...form, fat_g: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-content-body">{t("foods.fiber")}</label>
                      <Input className="mt-1" type="number" placeholder="0" value={form.fiber_g} onChange={(e) => setForm({ ...form, fiber_g: e.target.value })} />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowMealModal(false)}>{t("cancel")}</Button>
              <Button
                className="flex-1"
                onClick={saveMeal}
                disabled={saving || !form.name || !form.calories}
              >
                {saving ? t("saving") : t("save")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Water Modal */}
      {showWaterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface-card p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-content-strong">{t("dashboard.logWater")}</h2>
              <button onClick={() => setShowWaterModal(false)} className="text-content-muted hover:text-content-body">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 flex gap-2">
              {["0.25", "0.5", "1.0"].map((v) => (
                <button
                  key={v}
                  onClick={() => setWaterAmount(v)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                    waterAmount === v ? "border-primary-600 bg-primary-50 text-primary-700" : "border-edge-base text-content-body hover:bg-surface-base"
                  }`}
                >
                  {v}L
                </button>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium text-content-body">{t("dashboard.customAmount")}</label>
              <Input
                className="mt-1"
                type="number"
                step="0.05"
                min="0.05"
                value={waterAmount}
                onChange={(e) => setWaterAmount(e.target.value)}
              />
            </div>
            <p className="mt-2 text-xs text-content-muted">
              {t("dashboard.totalToday")}: {waterTotal.toFixed(2)}L / {waterGoal}L
            </p>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowWaterModal(false)}>{t("cancel")}</Button>
              <Button className="flex-1" onClick={logWater} disabled={saving}>
                {saving ? t("saving") : t("dashboard.register")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Weight Modal */}
      {showWeightModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface-card p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-content-strong">{t("dashboard.logWeightTitle")}</h2>
              <button onClick={() => setShowWeightModal(false)} className="text-content-muted hover:text-content-body">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div>
              <label className="text-sm font-medium text-content-body">{t("dashboard.weightKg")}</label>
              <Input
                className="mt-1"
                type="number"
                step="0.1"
                placeholder={latestWeight ? String(latestWeight) : "75.0"}
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                autoFocus
              />
            </div>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowWeightModal(false)}>{t("cancel")}</Button>
              <Button className="flex-1" onClick={logWeight} disabled={saving || !newWeight}>
                {saving ? t("saving") : t("dashboard.register")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Macro Editor Modal */}
      {showMacroModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface-card p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-content-strong">Ajustar Macros</h2>
              <button onClick={() => setShowMacroModal(false)} className="text-content-muted hover:text-content-body">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-xs text-content-muted">
              Defina a porcentagem de cada macronutriente. A soma deve ser 100%. As metas em gramas sao calculadas a partir de {calGoal} kcal.
            </p>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-content-body">Proteina</label>
                  <span className="text-sm font-semibold text-primary-600">{macroProtein}% = {Math.round(calGoal * macroProtein / 100 / 4)}g</span>
                </div>
                <input type="range" min="5" max="60" value={macroProtein}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setMacroProtein(v);
                    setMacroFat(100 - v - macroCarbs);
                  }}
                  className="mt-2 w-full accent-primary-600"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-content-body">Carboidratos</label>
                  <span className="text-sm font-semibold text-orange-600">{macroCarbs}% = {Math.round(calGoal * macroCarbs / 100 / 4)}g</span>
                </div>
                <input type="range" min="5" max="70" value={macroCarbs}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setMacroCarbs(v);
                    setMacroFat(100 - v - macroProtein);
                  }}
                  className="mt-2 w-full accent-orange-500"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-content-body">Gorduras</label>
                  <span className="text-sm font-semibold text-amber-600">{macroFat}% = {Math.round(calGoal * macroFat / 100 / 9)}g</span>
                </div>
                <input type="range" min="5" max="60" value={macroFat}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setMacroFat(v);
                    setMacroCarbs(100 - v - macroProtein);
                  }}
                  className="mt-2 w-full accent-amber-500"
                />
              </div>
              <div className={`rounded-lg p-3 text-center text-sm font-semibold ${macroProtein + macroCarbs + macroFat === 100 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                Total: {macroProtein + macroCarbs + macroFat}%
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowMacroModal(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={saveMacros} disabled={saving || macroProtein + macroCarbs + macroFat !== 100}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
