import { useEffect, useState, useRef, useCallback } from "react";
import { Search, UtensilsCrossed, Plus, X, Flame, Barcode, History, BookUser, Clock, Trash2, Check, Calendar, ChefHat, Star, Clock3, Users } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { AutoTextarea } from "../components/ui/textarea";

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

interface CustomFood {
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
  barcode: string | null;
  is_recipe: boolean;
  ingredients: string | null;
}

interface CommunityRecipe {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  ingredients: string;
  instructions: string;
  prep_time_min: number;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  image_url: string | null;
  created_at: string;
  is_official: boolean;
  profiles: { full_name: string } | null;
  ratings_count: number;
  ratings_sum: number;
}

interface MealLog {
  id: string;
  name: string;
  meal_type: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  logged_date: string;
  created_at: string;
}

const categoryColors: Record<string, { bg: string; text: string }> = {
  "Carnes": { bg: "bg-red-50", text: "text-red-600" },
  "Peixes": { bg: "bg-cyan-50", text: "text-cyan-600" },
  "Ovos e Laticínios": { bg: "bg-amber-50", text: "text-amber-600" },
  "Grãos e Cereais": { bg: "bg-yellow-50", text: "text-yellow-700" },
  "Frutas": { bg: "bg-green-50", text: "text-green-600" },
  "Verduras e Legumes": { bg: "bg-emerald-50", text: "text-emerald-600" },
  "Oleaginosas": { bg: "bg-orange-50", text: "text-orange-600" },
  "Açúcares": { bg: "bg-pink-50", text: "text-pink-600" },
  "Bebidas": { bg: "bg-primary-50", text: "text-primary-600" },
  "Preparações": { bg: "bg-violet-50", text: "text-violet-600" },
  "Condimentos": { bg: "bg-surface-base", text: "text-content-body" },
  "Suplementos": { bg: "bg-teal-50", text: "text-teal-600" },
  "Personalizado": { bg: "bg-slate-100", text: "text-slate-600" },
};

function getMealLabel(mealType: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    breakfast: t("meal.breakfast"),
    lunch: t("meal.lunch"),
    dinner: t("meal.dinner"),
    snack: t("meal.snack"),
    pre_workout: t("meal.preWorkout"),
    post_workout: t("meal.postWorkout"),
  };
  return map[mealType] || mealType;
}

const mealOrder = ["breakfast", "pre_workout", "lunch", "snack", "post_workout", "dinner"];

type Tab = "catalog" | "mine" | "community" | "history";

export function Recipes() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("catalog");
  const [foods, setFoods] = useState<Food[]>([]);
  const [filtered, setFiltered] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [selectedFood, setSelectedFood] = useState<Food | CustomFood | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [servings, setServings] = useState("1");
  const [mealType, setMealType] = useState("snack");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [customFoods, setCustomFoods] = useState<CustomFood[]>([]);
  const [customFiltered, setCustomFiltered] = useState<CustomFood[]>([]);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customForm, setCustomForm] = useState({
    name: "", category: "Personalizado", brand: "", serving_size: "100g",
    calories: "", protein_g: "", carbs_g: "", fat_g: "", fiber_g: "",
    barcode: "", is_recipe: false, ingredients: "",
  });

  const [meals, setMeals] = useState<MealLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [reAddedId, setReAddedId] = useState<string | null>(null);

  const [communityRecipes, setCommunityRecipes] = useState<CommunityRecipe[]>([]);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [recipeForm, setRecipeForm] = useState({ title: "", description: "", ingredients: "", instructions: "", prep_time_min: "", servings: "1", calories: "", protein_g: "", carbs_g: "", fat_g: "" });
  const [userRatings, setUserRatings] = useState<Record<string, number>>({});
  const [ratingSubmitting, setRatingSubmitting] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const loadFoods = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("foods").select("*").order("category").order("name");
    if (data) {
      setFoods(data);
      setFiltered(data);
      const cats = [...new Set(data.map((f) => f.category))];
      setCategories(cats);
      const brs = [...new Set(data.map((f) => f.brand).filter(Boolean) as string[])].sort();
      setBrands(brs);
    }
    setLoading(false);
  }, []);

  const loadCustomFoods = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("custom_foods").select("*").order("created_at", { ascending: false });
    if (data) {
      setCustomFoods(data);
      setCustomFiltered(data);
    }
  }, [user]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const { data } = await supabase
      .from("meals")
      .select("*")
      .order("logged_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setMeals(data);
    setHistoryLoading(false);
  }, []);

  const loadCommunityRecipes = useCallback(async () => {
    setCommunityLoading(true);
    const { data } = await supabase
      .from("community_recipes_with_ratings")
      .select("*, profiles:user_id(full_name)")
      .order("created_at", { ascending: false });
    if (data) setCommunityRecipes(data as unknown as CommunityRecipe[]);
    const { data: ratings } = await supabase.from("recipe_ratings").select("recipe_id, rating").eq("user_id", user?.id ?? "");
    if (ratings) {
      const m: Record<string, number> = {};
      ratings.forEach((r) => { m[r.recipe_id] = r.rating; });
      setUserRatings(m);
    }
    setCommunityLoading(false);
  }, [user]);

  useEffect(() => {
    loadFoods();
    loadCustomFoods();
    loadHistory();
    loadCommunityRecipes();
  }, [loadFoods, loadCustomFoods, loadHistory, loadCommunityRecipes]);

  function handleSearch(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyFilters(value, activeCategory, activeBrand), 200);
  }

  function handleCategoryFilter(cat: string | null) {
    const next = activeCategory === cat ? null : cat;
    setActiveCategory(next);
    applyFilters(search, next, activeBrand);
  }

  function handleBrandFilter(brand: string | null) {
    const next = activeBrand === brand ? null : brand;
    setActiveBrand(next);
    applyFilters(search, activeCategory, next);
  }

  function applyFilters(query: string, cat: string | null, brand: string | null) {
    let result = foods;
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q) || (f.brand && f.brand.toLowerCase().includes(q)));
    }
    if (cat) result = result.filter((f) => f.category === cat);
    if (brand) result = result.filter((f) => f.brand === brand);
    setFiltered(result);
  }

  function openFoodDetail(food: Food | CustomFood, custom: boolean) {
    setSelectedFood(food);
    setIsCustom(custom);
    setServings("1");
    setMealType("snack");
    setSaved(false);
  }

  function computedValues() {
    if (!selectedFood) return { cal: 0, prot: "0", carb: "0", fat: "0", fiber: "0" };
    const n = parseFloat(servings) || 1;
    return {
      cal: Math.round(selectedFood.calories * n),
      prot: (Number(selectedFood.protein_g) * n).toFixed(1),
      carb: (Number(selectedFood.carbs_g) * n).toFixed(1),
      fat: (Number(selectedFood.fat_g) * n).toFixed(1),
      fiber: (Number(selectedFood.fiber_g) * n).toFixed(1),
    };
  }

  async function addToDiary() {
    if (!selectedFood) return;
    setSaving(true);
    const n = parseFloat(servings) || 1;
    const { data } = await supabase
      .from("meals")
      .insert({
        name: selectedFood.name,
        meal_type: mealType,
        calories: Math.round(selectedFood.calories * n),
        protein_g: (Number(selectedFood.protein_g) * n).toFixed(1),
        carbs_g: (Number(selectedFood.carbs_g) * n).toFixed(1),
        fat_g: (Number(selectedFood.fat_g) * n).toFixed(1),
        logged_date: today,
      })
      .select()
      .single();
    setSaving(false);
    if (data) {
      setSaved(true);
      setMeals((prev) => [data, ...prev]);
      setTimeout(() => { setSelectedFood(null); setSaved(false); }, 1500);
    }
  }

  async function saveCustomFood() {
    if (!customForm.name.trim() || !customForm.calories) return;
    setSaving(true);
    const { data } = await supabase
      .from("custom_foods")
      .insert({
        name: customForm.name,
        category: customForm.category,
        brand: customForm.brand || null,
        serving_size: customForm.serving_size,
        calories: parseInt(customForm.calories) || 0,
        protein_g: parseFloat(customForm.protein_g) || 0,
        carbs_g: parseFloat(customForm.carbs_g) || 0,
        fat_g: parseFloat(customForm.fat_g) || 0,
        fiber_g: parseFloat(customForm.fiber_g) || 0,
        barcode: customForm.barcode || null,
        is_recipe: customForm.is_recipe,
        ingredients: customForm.is_recipe ? customForm.ingredients : null,
      })
      .select()
      .single();
    setSaving(false);
    if (data) {
      setCustomFoods((prev) => [data, ...prev]);
      setCustomFiltered((prev) => [data, ...prev]);
      setShowCustomModal(false);
      setCustomForm({ name: "", category: "Personalizado", brand: "", serving_size: "100g", calories: "", protein_g: "", carbs_g: "", fat_g: "", fiber_g: "", barcode: "", is_recipe: false, ingredients: "" });
    }
  }

  async function deleteCustomFood(id: string) {
    await supabase.from("custom_foods").delete().eq("id", id);
    setCustomFoods((prev) => prev.filter((f) => f.id !== id));
    setCustomFiltered((prev) => prev.filter((f) => f.id !== id));
  }

  async function saveCommunityRecipe() {
    if (!user || !recipeForm.title.trim() || !recipeForm.ingredients.trim() || !recipeForm.instructions.trim()) return;
    setSaving(true);
    const { data } = await supabase
      .from("community_recipes")
      .insert({
        user_id: user.id,
        title: recipeForm.title,
        description: recipeForm.description || null,
        ingredients: recipeForm.ingredients,
        instructions: recipeForm.instructions,
        prep_time_min: parseInt(recipeForm.prep_time_min) || 0,
        servings: parseInt(recipeForm.servings) || 1,
        calories: parseInt(recipeForm.calories) || 0,
        protein_g: parseFloat(recipeForm.protein_g) || 0,
        carbs_g: parseFloat(recipeForm.carbs_g) || 0,
        fat_g: parseFloat(recipeForm.fat_g) || 0,
      })
      .select("*")
      .single();
    setSaving(false);
    if (data) {
      const newRecipe = { ...data, is_official: false, profiles: { full_name: "" }, ratings_count: 0, ratings_sum: 0 } as CommunityRecipe;
      setCommunityRecipes((prev) => [newRecipe, ...prev]);
      setShowRecipeModal(false);
      setRecipeForm({ title: "", description: "", ingredients: "", instructions: "", prep_time_min: "", servings: "1", calories: "", protein_g: "", carbs_g: "", fat_g: "" });
    }
  }

  async function submitRating(recipeId: string, rating: number) {
    if (!user) return;
    setRatingSubmitting(recipeId);
    const { error } = await supabase
      .from("recipe_ratings")
      .upsert({ recipe_id: recipeId, user_id: user.id, rating }, { onConflict: "recipe_id,user_id" });
    if (!error) {
      setUserRatings((prev) => ({ ...prev, [recipeId]: rating }));
      loadCommunityRecipes();
    }
    setRatingSubmitting(null);
  }

  async function searchByBarcode() {
    if (!customForm.barcode.trim()) return;
    const { data } = await supabase.from("foods").select("*").eq("barcode", customForm.barcode.trim()).maybeSingle();
    if (data) {
      setCustomForm((prev) => ({
        ...prev, name: data.name, category: data.category, brand: data.brand || "", serving_size: data.serving_size,
        calories: String(data.calories), protein_g: String(data.protein_g), carbs_g: String(data.carbs_g), fat_g: String(data.fat_g), fiber_g: String(data.fiber_g),
      }));
    }
  }

  // Group meals by date, then by meal type within each date
  const mealsByDate: Record<string, MealLog[]> = {};
  meals.forEach((m) => {
    const d = m.logged_date;
    if (!mealsByDate[d]) mealsByDate[d] = [];
    mealsByDate[d].push(m);
  });

  const sortedDates = Object.keys(mealsByDate).sort((a, b) => b.localeCompare(a));

  function formatDateLabel(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    const today2 = new Date(today + "T00:00:00");
    const yest = new Date(today2); yest.setDate(yest.getDate() - 1);
    if (d.toDateString() === today2.toDateString()) return t("foods.today");
    if (d.toDateString() === yest.toDateString()) return t("foods.yesterday");
    return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  }

  function mealsByTypeForDate(dateMeals: MealLog[]) {
    const byType: Record<string, MealLog[]> = {};
    dateMeals.forEach((m) => {
      if (!byType[m.meal_type]) byType[m.meal_type] = [];
      byType[m.meal_type].push(m);
    });
    return Object.keys(byType)
      .sort((a, b) => {
        const ia = mealOrder.indexOf(a); const ib = mealOrder.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map((type) => ({ type, items: byType[type] }));
  }

  async function reAddToToday(meal: MealLog) {
    const { data } = await supabase
      .from("meals")
      .insert({
        name: meal.name,
        meal_type: meal.meal_type,
        calories: meal.calories,
        protein_g: meal.protein_g,
        carbs_g: meal.carbs_g,
        fat_g: meal.fat_g,
        logged_date: today,
      })
      .select()
      .single();
    if (data) {
      setMeals((prev) => [data, ...prev]);
      setReAddedId(meal.id);
      setTimeout(() => setReAddedId(null), 2000);
    }
  }

  const tabConfig: { key: Tab; label: string; icon: typeof UtensilsCrossed }[] = [
    { key: "catalog", label: t("foods.tabCatalog"), icon: UtensilsCrossed },
    { key: "mine", label: t("foods.tabMine"), icon: BookUser },
    { key: "community", label: "Receitas", icon: ChefHat },
    { key: "history", label: t("foods.tabHistory"), icon: History },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-strong">{t("foods.title")}</h1>
          <p className="mt-0.5 text-sm text-content-muted">{t("foods.subtitle")}</p>
        </div>
        <Button className="gap-2" onClick={() => setShowCustomModal(true)}>
          <Plus className="h-4 w-4" />
          {t("foods.addCustom")}
        </Button>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-edge-base pb-px">
        {tabConfig.map((tabItem) => (
          <button
            key={tabItem.key}
            onClick={() => setTab(tabItem.key)}
            className={`flex items-center gap-2 rounded-t-lg px-3 sm:px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === tabItem.key ? "border-b-2 border-primary-600 text-primary-600" : "text-content-muted hover:text-content-body"
            }`}
          >
            <tabItem.icon className="h-4 w-4" />
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* ── Catalog tab ── */}
      {tab === "catalog" && (
        <>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-content-muted" />
            <input
              className="flex h-12 w-full rounded-xl border border-edge-base bg-surface-card pl-12 pr-4 text-base text-content-strong placeholder:text-content-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              placeholder={t("foods.searchPlaceholder")}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleCategoryFilter(null)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${!activeCategory ? "bg-primary-600 text-white" : "bg-surface-subtle text-content-body hover:bg-slate-200"}`}
            >
              {t("all")} ({foods.length})
            </button>
            {categories.map((cat) => {
              const count = foods.filter((f) => f.category === cat).length;
              const color = categoryColors[cat] ?? { bg: "bg-surface-subtle", text: "text-content-body" };
              return (
                <button
                  key={cat}
                  onClick={() => handleCategoryFilter(cat)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${activeCategory === cat ? `${color.bg} ${color.text} ring-2 ring-offset-1 ring-current` : "bg-surface-subtle text-content-body hover:bg-slate-200"}`}
                >
                  {t(`cat.${cat}`)} ({count})
                </button>
              );
            })}
          </div>

          {/* Brand filters */}
          {brands.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => handleBrandFilter(null)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!activeBrand ? "bg-primary-600 text-white" : "bg-surface-subtle text-content-body hover:bg-slate-200"}`}
              >
                {t("foods.allBrands")}
              </button>
              {brands.map((br) => (
                <button
                  key={br}
                  onClick={() => handleBrandFilter(br)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${activeBrand === br ? "bg-primary-600 text-white" : "bg-surface-subtle text-content-body hover:bg-slate-200"}`}
                >
                  {br}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center py-16 text-center">
              <UtensilsCrossed className="mb-3 h-12 w-12 text-slate-200" />
              <h3 className="text-base font-semibold text-content-body">{t("foods.noResults")}</h3>
              <p className="mt-1 text-sm text-content-muted">{t("foods.tryAnother")}</p>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((food) => {
                const color = categoryColors[food.category] ?? { bg: "bg-surface-base", text: "text-content-body" };
                return (
                  <Card key={food.id} className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5" onClick={() => openFoodDetail(food, false)}>
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-content-strong leading-tight">{food.name}</h3>
                          {food.brand && <p className="text-[11px] font-medium text-primary-500 truncate">{food.brand}</p>}
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${color.bg} ${color.text}`}>{t(`cat.${food.category}`)}</span>
                      </div>
                      <p className="mb-3 text-xs text-content-muted">{t("foods.serving")}: {food.serving_size}</p>
                      <div className="grid grid-cols-5 gap-1 text-center">
                        <div className="rounded-lg bg-surface-base px-1 py-1.5"><p className="text-sm font-bold text-content-strong">{food.calories}</p><p className="text-[9px] text-content-muted">kcal</p></div>
                        <div className="rounded-lg bg-primary-50 px-1 py-1.5"><p className="text-sm font-bold text-primary-600">{food.protein_g}</p><p className="text-[9px] text-content-muted">Prot</p></div>
                        <div className="rounded-lg bg-orange-50 px-1 py-1.5"><p className="text-sm font-bold text-orange-600">{food.carbs_g}</p><p className="text-[9px] text-content-muted">Carb</p></div>
                        <div className="rounded-lg bg-amber-50 px-1 py-1.5"><p className="text-sm font-bold text-amber-600">{food.fat_g}</p><p className="text-[9px] text-content-muted">Gord</p></div>
                        <div className="rounded-lg bg-green-50 px-1 py-1.5"><p className="text-sm font-bold text-green-600">{food.fiber_g}</p><p className="text-[9px] text-content-muted">Fibra</p></div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── My Foods tab ── */}
      {tab === "mine" && (
        <div className="flex flex-col gap-4">
          {customFoods.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center py-16 text-center">
              <BookUser className="mb-3 h-12 w-12 text-slate-200" />
              <h3 className="text-base font-semibold text-content-body">{t("foods.myFoods")}</h3>
              <p className="mt-1 text-sm text-content-muted">{t("foods.noHistory")}</p>
              <Button className="mt-4 gap-2" onClick={() => setShowCustomModal(true)}>
                <Plus className="h-4 w-4" />
                {t("foods.addCustom")}
              </Button>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {customFiltered.map((food) => {
                const color = categoryColors[food.category] ?? { bg: "bg-slate-100", text: "text-slate-600" };
                return (
                  <Card key={food.id} className="group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5" onClick={() => openFoodDetail(food, true)}>
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-content-strong leading-tight">{food.name}</h3>
                          {food.brand && <p className="text-[11px] font-medium text-primary-500 truncate">{food.brand}</p>}
                          {food.is_recipe && <span className="text-[10px] font-medium text-primary-600">Receita</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {food.barcode && <Barcode className="h-3.5 w-3.5 text-content-muted" />}
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${color.bg} ${color.text}`}>{t(`cat.${food.category}`)}</span>
                        </div>
                      </div>
                      <p className="mb-3 text-xs text-content-muted">{t("foods.serving")}: {food.serving_size}</p>
                      <div className="grid grid-cols-5 gap-1 text-center">
                        <div className="rounded-lg bg-surface-base px-1 py-1.5"><p className="text-sm font-bold text-content-strong">{food.calories}</p><p className="text-[9px] text-content-muted">kcal</p></div>
                        <div className="rounded-lg bg-primary-50 px-1 py-1.5"><p className="text-sm font-bold text-primary-600">{food.protein_g}</p><p className="text-[9px] text-content-muted">Prot</p></div>
                        <div className="rounded-lg bg-orange-50 px-1 py-1.5"><p className="text-sm font-bold text-orange-600">{food.carbs_g}</p><p className="text-[9px] text-content-muted">Carb</p></div>
                        <div className="rounded-lg bg-amber-50 px-1 py-1.5"><p className="text-sm font-bold text-amber-600">{food.fat_g}</p><p className="text-[9px] text-content-muted">Gord</p></div>
                        <div className="rounded-lg bg-green-50 px-1 py-1.5"><p className="text-sm font-bold text-green-600">{food.fiber_g}</p><p className="text-[9px] text-content-muted">Fibra</p></div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteCustomFood(food.id); }}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-surface-subtle py-1.5 text-xs font-medium text-content-muted opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                        {t("delete")}
                      </button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Community Recipes tab ── */}
      {tab === "community" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-content-muted">Receitas compartilhadas pela comunidade</p>
            <Button className="gap-2" onClick={() => setShowRecipeModal(true)}>
              <Plus className="h-4 w-4" />
              Compartilhar Receita
            </Button>
          </div>
          {communityLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
            </div>
          ) : communityRecipes.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center py-16 text-center">
              <ChefHat className="mb-3 h-12 w-12 text-slate-200" />
              <h3 className="text-base font-semibold text-content-body">Nenhuma receita ainda</h3>
              <p className="mt-1 text-sm text-content-muted">Seja o primeiro a compartilhar uma receita!</p>
              <Button className="mt-4 gap-2" onClick={() => setShowRecipeModal(true)}>
                <Plus className="h-4 w-4" />
                Compartilhar Receita
              </Button>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {communityRecipes.map((r) => {
                const avgRating = r.ratings_count > 0 ? (r.ratings_sum / r.ratings_count).toFixed(1) : "-";
                const myRating = userRatings[r.id] || 0;
                return (
                  <Card key={r.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-content-strong leading-tight">{r.title}</h3>
                          <p className="text-[11px] text-content-muted">{r.is_official ? "Adicionada por FitSync" : `por ${r.profiles?.full_name || "Anônimo"}`}</p>
                        </div>
                        <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-bold text-amber-600">{avgRating}</span>
                          <span className="text-[10px] text-content-muted">({r.ratings_count})</span>
                        </div>
                      </div>
                      {r.description && <p className="mb-2 text-xs text-content-muted line-clamp-2">{r.description}</p>}
                      <div className="mb-2 flex items-center gap-3 text-[11px] text-content-muted">
                        {r.prep_time_min > 0 && <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{r.prep_time_min} min</span>}
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.servings} porções</span>
                        {r.calories > 0 && <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-orange-500" />{r.calories} kcal</span>}
                      </div>
                      {r.calories > 0 && (
                        <div className="mb-3 grid grid-cols-3 gap-1 text-center">
                          <div className="rounded-lg bg-primary-50 px-1 py-1"><p className="text-xs font-bold text-primary-600">{r.protein_g}g</p><p className="text-[9px] text-content-muted">Prot</p></div>
                          <div className="rounded-lg bg-orange-50 px-1 py-1"><p className="text-xs font-bold text-orange-600">{r.carbs_g}g</p><p className="text-[9px] text-content-muted">Carb</p></div>
                          <div className="rounded-lg bg-amber-50 px-1 py-1"><p className="text-xs font-bold text-amber-600">{r.fat_g}g</p><p className="text-[9px] text-content-muted">Gord</p></div>
                        </div>
                      )}
                      <div className="border-t border-edge-base pt-2">
                        <p className="mb-1 text-[10px] font-medium text-content-muted">Ingredientes</p>
                        <p className="text-xs text-content-body line-clamp-3 whitespace-pre-wrap">{r.ingredients}</p>
                      </div>
                      <div className="mt-2 border-t border-edge-base pt-2">
                        <p className="mb-1 text-[10px] font-medium text-content-muted">Modo de preparo</p>
                        <p className="text-xs text-content-body line-clamp-3 whitespace-pre-wrap">{r.instructions}</p>
                      </div>
                      <div className="mt-3 flex items-center gap-1 border-t border-edge-base pt-2">
                        <span className="mr-1 text-[10px] text-content-muted">Sua nota:</span>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => submitRating(r.id, star)}
                            disabled={ratingSubmitting === r.id}
                            className="transition-transform hover:scale-110 active:scale-95"
                          >
                            <Star className={`h-4 w-4 ${star <= myRating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── History tab ── */}
      {tab === "history" && (
        <div className="flex flex-col gap-4">
          {historyLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
            </div>
          ) : meals.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center py-16 text-center">
              <Clock className="mb-3 h-12 w-12 text-slate-200" />
              <h3 className="text-base font-semibold text-content-body">{t("foods.foodHistory")}</h3>
              <p className="mt-1 text-sm text-content-muted">{t("foods.noHistory")}</p>
            </CardContent></Card>
          ) : (
            <div className="flex flex-col gap-6">
              {sortedDates.map((date) => {
                const dateMeals = mealsByDate[date];
                const dayCal = dateMeals.reduce((s, m) => s + m.calories, 0);
                const dayProt = dateMeals.reduce((s, m) => s + Number(m.protein_g), 0);
                const dayCarbs = dateMeals.reduce((s, m) => s + Number(m.carbs_g), 0);
                const dayFat = dateMeals.reduce((s, m) => s + Number(m.fat_g), 0);
                const grouped = mealsByTypeForDate(dateMeals);
                return (
                  <div key={date}>
                    <div className="mb-3 flex items-center justify-between rounded-xl bg-surface-subtle px-4 py-3">
                      <h3 className="flex items-center gap-2 text-sm font-semibold capitalize text-content-strong">
                        <Calendar className="h-4 w-4 text-primary-500" />
                        {formatDateLabel(date)}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-content-muted">
                        <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-orange-500" />{dayCal} kcal</span>
                        <span>P:{Math.round(dayProt)}g</span>
                        <span>C:{Math.round(dayCarbs)}g</span>
                        <span>G:{Math.round(dayFat)}g</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      {grouped.map((g) => (
                        <div key={g.type}>
                          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-content-muted">{getMealLabel(g.type, t)}</p>
                          <div className="flex flex-col gap-1.5">
                            {g.items.map((meal) => (
                              <Card key={meal.id}>
                                <CardContent className="flex items-center justify-between p-3.5">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-content-strong">{meal.name}</p>
                                    <p className="text-xs text-content-muted">
                                      P:{Math.round(Number(meal.protein_g))}g C:{Math.round(Number(meal.carbs_g))}g G:{Math.round(Number(meal.fat_g))}g
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <span className="text-sm font-semibold text-content-body">{meal.calories} kcal</span>
                                    <button
                                      onClick={() => reAddToToday(meal)}
                                      disabled={reAddedId === meal.id}
                                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                                        reAddedId === meal.id
                                          ? "bg-green-50 text-green-600"
                                          : "bg-primary-50 text-primary-600 hover:bg-primary-100"
                                      }`}
                                    >
                                      {reAddedId === meal.id ? (
                                        <><Check className="h-3 w-3" />{t("foods.reAdded")}</>
                                      ) : (
                                        <><Plus className="h-3 w-3" />{t("foods.reAddToday")}</>
                                      )}
                                    </button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Food detail modal ── */}
      {selectedFood && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setSelectedFood(null)}>
          <div className="w-full max-w-lg rounded-t-2xl bg-surface-card p-6 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-content-strong">{selectedFood.name}</h2>
                <p className="text-sm text-content-muted">{t(`cat.${selectedFood.category}`)} · {t("foods.serving")}: {selectedFood.serving_size}</p>
                {selectedFood.brand && <p className="mt-0.5 text-sm font-medium text-primary-500">{selectedFood.brand}</p>}
                {isCustom && (selectedFood as CustomFood).barcode && <p className="mt-1 flex items-center gap-1 text-xs text-content-muted"><Barcode className="h-3 w-3" />{(selectedFood as CustomFood).barcode}</p>}
              </div>
              <button onClick={() => setSelectedFood(null)} className="text-content-muted hover:text-content-body"><X className="h-5 w-5" /></button>
            </div>

            {isCustom && (selectedFood as CustomFood).is_recipe && (selectedFood as CustomFood).ingredients && (
              <div className="mb-4 rounded-xl bg-surface-subtle p-3">
                <p className="text-xs font-medium text-content-muted">{t("foods.ingredients")}</p>
                <p className="mt-1 text-sm text-content-body">{(selectedFood as CustomFood).ingredients}</p>
              </div>
            )}

            <div className="mb-4 grid grid-cols-5 gap-2 text-center">
              <div className="rounded-xl bg-surface-base p-2"><p className="text-lg font-bold text-content-strong">{selectedFood.calories}</p><p className="text-[10px] text-content-muted">kcal</p></div>
              <div className="rounded-xl bg-primary-50 p-2"><p className="text-lg font-bold text-primary-600">{selectedFood.protein_g}</p><p className="text-[10px] text-content-muted">Prot (g)</p></div>
              <div className="rounded-xl bg-orange-50 p-2"><p className="text-lg font-bold text-orange-600">{selectedFood.carbs_g}</p><p className="text-[10px] text-content-muted">Carb (g)</p></div>
              <div className="rounded-xl bg-amber-50 p-2"><p className="text-lg font-bold text-amber-600">{selectedFood.fat_g}</p><p className="text-[10px] text-content-muted">Gord (g)</p></div>
              <div className="rounded-xl bg-green-50 p-2"><p className="text-lg font-bold text-green-600">{selectedFood.fiber_g}</p><p className="text-[10px] text-content-muted">Fibra (g)</p></div>
            </div>

            <div className="rounded-xl border border-primary-200 bg-primary-50 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-content-strong"><Plus className="h-4 w-4" />{t("foods.addToDiary")}</h3>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs font-medium text-content-body">{t("dashboard.portions")}</label>
                  <input type="number" step="0.5" min="0.25" value={servings} onChange={(e) => setServings(e.target.value)} className="mt-1 block w-20 rounded-lg border border-primary-300 bg-surface-card px-2 py-1.5 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-200" />
                </div>
                <div>
                  <label className="text-xs font-medium text-content-body">{t("dashboard.mealType")}</label>
                  <select value={mealType} onChange={(e) => setMealType(e.target.value)} className="mt-1 block rounded-lg border border-primary-300 bg-surface-card px-2 py-1.5 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-200">
                    <option value="breakfast">{t("meal.breakfast")}</option>
                    <option value="lunch">{t("meal.lunch")}</option>
                    <option value="dinner">{t("meal.dinner")}</option>
                    <option value="snack">{t("meal.snack")}</option>
                    <option value="pre_workout">{t("meal.preWorkout")}</option>
                    <option value="post_workout">{t("meal.postWorkout")}</option>
                  </select>
                </div>
                <Button onClick={addToDiary} disabled={saving || saved} className="gap-2">
                  {saved ? <><Check className="h-4 w-4" />{t("foods.added")}</> : saving ? t("saving") : <><Plus className="h-4 w-4" />{t("add")}</>}
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-1.5 text-center">
                {(() => { const v = computedValues(); return (<>
                  <div className="rounded-lg bg-surface-card px-1 py-1"><p className="text-sm font-bold text-content-strong">{v.cal}</p><p className="text-[9px] text-content-muted">kcal</p></div>
                  <div className="rounded-lg bg-surface-card px-1 py-1"><p className="text-sm font-bold text-primary-600">{v.prot}</p><p className="text-[9px] text-content-muted">Prot</p></div>
                  <div className="rounded-lg bg-surface-card px-1 py-1"><p className="text-sm font-bold text-orange-600">{v.carb}</p><p className="text-[9px] text-content-muted">Carb</p></div>
                  <div className="rounded-lg bg-surface-card px-1 py-1"><p className="text-sm font-bold text-amber-600">{v.fat}</p><p className="text-[9px] text-content-muted">Gord</p></div>
                  <div className="rounded-lg bg-surface-card px-1 py-1"><p className="text-sm font-bold text-green-600">{v.fiber}</p><p className="text-[9px] text-content-muted">Fibra</p></div>
                </>); })()}
              </div>
            </div>
            <div className="mt-4 flex justify-end"><Button variant="outline" onClick={() => setSelectedFood(null)}>{t("close")}</Button></div>
          </div>
        </div>
      )}

      {/* ── Recipe share modal ── */}
      {showRecipeModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setShowRecipeModal(false)}>
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl bg-surface-card p-6 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-content-strong">Compartilhar Receita</h2>
              <button onClick={() => setShowRecipeModal(false)} className="text-content-muted hover:text-content-body"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-content-body">Título *</label>
                <input type="text" placeholder="Nome da receita" value={recipeForm.title} onChange={(e) => setRecipeForm({ ...recipeForm, title: e.target.value })} className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>
              <div>
                <label className="text-sm font-medium text-content-body">Descrição</label>
                <input type="text" placeholder="Breve descrição" value={recipeForm.description} onChange={(e) => setRecipeForm({ ...recipeForm, description: e.target.value })} className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>
              <div>
                <label className="text-sm font-medium text-content-body">Ingredientes *</label>
                <AutoTextarea minRows={3} placeholder="Liste os ingredientes..." value={recipeForm.ingredients} onChange={(e) => setRecipeForm({ ...recipeForm, ingredients: e.target.value })} className="mt-1 flex w-full rounded-lg border border-edge-base bg-surface-card px-3 py-2 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>
              <div>
                <label className="text-sm font-medium text-content-body">Modo de preparo *</label>
                <AutoTextarea minRows={3} placeholder="Passo a passo..." value={recipeForm.instructions} onChange={(e) => setRecipeForm({ ...recipeForm, instructions: e.target.value })} className="mt-1 flex w-full rounded-lg border border-edge-base bg-surface-card px-3 py-2 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="text-sm font-medium text-content-body">Tempo (min)</label>
                  <input type="number" placeholder="0" value={recipeForm.prep_time_min} onChange={(e) => setRecipeForm({ ...recipeForm, prep_time_min: e.target.value })} className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
                <div>
                  <label className="text-sm font-medium text-content-body">Porções</label>
                  <input type="number" placeholder="1" value={recipeForm.servings} onChange={(e) => setRecipeForm({ ...recipeForm, servings: e.target.value })} className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
                <div>
                  <label className="text-sm font-medium text-content-body">Calorias</label>
                  <input type="number" placeholder="0" value={recipeForm.calories} onChange={(e) => setRecipeForm({ ...recipeForm, calories: e.target.value })} className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
                <div>
                  <label className="text-sm font-medium text-content-body">Proteína (g)</label>
                  <input type="number" placeholder="0" value={recipeForm.protein_g} onChange={(e) => setRecipeForm({ ...recipeForm, protein_g: e.target.value })} className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
                <div>
                  <label className="text-sm font-medium text-content-body">Carboidrato (g)</label>
                  <input type="number" placeholder="0" value={recipeForm.carbs_g} onChange={(e) => setRecipeForm({ ...recipeForm, carbs_g: e.target.value })} className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
                <div>
                  <label className="text-sm font-medium text-content-body">Gordura (g)</label>
                  <input type="number" placeholder="0" value={recipeForm.fat_g} onChange={(e) => setRecipeForm({ ...recipeForm, fat_g: e.target.value })} className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowRecipeModal(false)}>{t("cancel")}</Button>
              <Button className="flex-1" onClick={saveCommunityRecipe} disabled={saving || !recipeForm.title.trim() || !recipeForm.ingredients.trim() || !recipeForm.instructions.trim()}>
                {saving ? t("saving") : "Publicar"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Custom food modal ── */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setShowCustomModal(false)}>
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl bg-surface-card p-6 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-content-strong">{t("foods.addCustom")}</h2>
              <button onClick={() => setShowCustomModal(false)} className="text-content-muted hover:text-content-body"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4">
              {/* Barcode */}
              <div>
                <label className="text-sm font-medium text-content-body">{t("foods.barcode")}</label>
                <div className="mt-1 flex gap-2">
                  <div className="relative flex-1">
                    <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                    <input
                      type="text"
                      placeholder={t("foods.barcodePlaceholder")}
                      value={customForm.barcode}
                      onChange={(e) => setCustomForm({ ...customForm, barcode: e.target.value })}
                      className="flex h-10 w-full rounded-lg border border-edge-base bg-surface-card pl-9 pr-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={searchByBarcode}>{t("foods.scanBarcode")}</Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-content-body">{t("foods.customFoodName")} *</label>
                <input
                  type="text"
                  placeholder={t("foods.customFoodName")}
                  value={customForm.name}
                  onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })}
                  className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-content-body">{t("foods.category")}</label>
                  <select
                    value={customForm.category}
                    onChange={(e) => setCustomForm({ ...customForm, category: e.target.value })}
                    className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  >
                    {categories.map((c) => <option key={c} value={c}>{t(`cat.${c}`)}</option>)}
                    <option value="Personalizado">{t("cat.Personalizado")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-content-body">{t("foods.servingSize")}</label>
                  <input
                    type="text"
                    value={customForm.serving_size}
                    onChange={(e) => setCustomForm({ ...customForm, serving_size: e.target.value })}
                    className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-content-body">{t("foods.brand")}</label>
                <input
                  type="text"
                  placeholder={t("foods.brandPlaceholder")}
                  value={customForm.brand}
                  onChange={(e) => setCustomForm({ ...customForm, brand: e.target.value })}
                  className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-medium text-content-body">{t("dashboard.calories")} *</label>
                  <input type="number" placeholder="0" value={customForm.calories} onChange={(e) => setCustomForm({ ...customForm, calories: e.target.value })} className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
                <div>
                  <label className="text-sm font-medium text-content-body">{t("dashboard.protein")}</label>
                  <input type="number" placeholder="0" value={customForm.protein_g} onChange={(e) => setCustomForm({ ...customForm, protein_g: e.target.value })} className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
                <div>
                  <label className="text-sm font-medium text-content-body">{t("dashboard.carbs")}</label>
                  <input type="number" placeholder="0" value={customForm.carbs_g} onChange={(e) => setCustomForm({ ...customForm, carbs_g: e.target.value })} className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
                <div>
                  <label className="text-sm font-medium text-content-body">{t("dashboard.fat")}</label>
                  <input type="number" placeholder="0" value={customForm.fat_g} onChange={(e) => setCustomForm({ ...customForm, fat_g: e.target.value })} className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
                <div>
                  <label className="text-sm font-medium text-content-body">{t("foods.fiber")}</label>
                  <input type="number" placeholder="0" value={customForm.fiber_g} onChange={(e) => setCustomForm({ ...customForm, fiber_g: e.target.value })} className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={customForm.is_recipe}
                  onChange={(e) => setCustomForm({ ...customForm, is_recipe: e.target.checked })}
                  className="h-4 w-4 rounded border-edge-base text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-content-body">{t("foods.isRecipe")}</span>
              </label>

              {customForm.is_recipe && (
                <div>
                  <label className="text-sm font-medium text-content-body">{t("foods.ingredients")}</label>
                  <AutoTextarea
                    minRows={3}
                    placeholder={t("foods.ingredientsPlaceholder")}
                    value={customForm.ingredients}
                    onChange={(e) => setCustomForm({ ...customForm, ingredients: e.target.value })}
                    className="mt-1 flex w-full rounded-lg border border-edge-base bg-surface-card px-3 py-2 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowCustomModal(false)}>{t("cancel")}</Button>
              <Button className="flex-1" onClick={saveCustomFood} disabled={saving || !customForm.name.trim() || !customForm.calories}>
                {saving ? t("saving") : t("save")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
