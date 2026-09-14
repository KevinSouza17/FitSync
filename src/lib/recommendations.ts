export type Goal = "lose_weight" | "build_muscle" | "maintain" | "endurance" | "general";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Diet = "omnivore" | "vegetarian" | "vegan" | "low_carb" | "flexible";

export interface RecommendationAnswers {
  goal: Goal;
  experience: Experience;
  workout_days: number;
  diet: Diet;
  allergies: string | string[] | null;
  equipment: string[];
}

export interface WorkoutRecommendationExercise {
  name: string;
  sets: number;
  reps: string;
  rest: number;
  notes?: string;
}

export interface WorkoutRecommendationDay {
  dayName: string;
  focus: string;
  exercises: WorkoutRecommendationExercise[];
}

export interface DietRecommendationMeal {
  meal: string;
  items: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

type MuscleGroup = "push" | "pull" | "legs";
type EquipKey = "gym" | "dumbbells" | "bodyweight";

interface ExerciseDef {
  name: string;
  primary: string;
  compound: boolean;
  difficulty: 1 | 2 | 3;
}

const EXERCISE_LIBRARY: Record<EquipKey, Record<MuscleGroup, ExerciseDef[]>> = {
  gym: {
    push: [
      { name: "Supino Reto com Barra", primary: "peito", compound: true, difficulty: 2 },
      { name: "Supino Inclinado com Halteres", primary: "peito", compound: true, difficulty: 2 },
      { name: "Crucifixo na Polia", primary: "peito", compound: false, difficulty: 1 },
      { name: "Crossover na Polia", primary: "peito", compound: false, difficulty: 1 },
      { name: "Desenvolvimento com Halteres", primary: "ombros", compound: true, difficulty: 2 },
      { name: "Elevação Lateral", primary: "ombros", compound: false, difficulty: 1 },
      { name: "Elevação Frontal com Anilha", primary: "ombros", compound: false, difficulty: 1 },
      { name: "Tríceps na Polia (Corda)", primary: "tríceps", compound: false, difficulty: 1 },
      { name: "Tríceps Francês", primary: "tríceps", compound: false, difficulty: 2 },
      { name: "Supino Fechado com Barra", primary: "tríceps", compound: true, difficulty: 2 },
    ],
    pull: [
      { name: "Puxada Frontal", primary: "costas", compound: true, difficulty: 2 },
      { name: "Remada Baixa Sentada", primary: "costas", compound: true, difficulty: 2 },
      { name: "Levantamento Terra Romeno", primary: "costas", compound: true, difficulty: 3 },
      { name: "Pullover na Polia", primary: "costas", compound: false, difficulty: 1 },
      { name: "Rosca Direta com Barra", primary: "bíceps", compound: false, difficulty: 1 },
      { name: "Rosca Alternada", primary: "bíceps", compound: false, difficulty: 1 },
      { name: "Rosca Martelo", primary: "bíceps", compound: false, difficulty: 1 },
      { name: "Face Pull", primary: "ombros", compound: false, difficulty: 1 },
    ],
    legs: [
      { name: "Agachamento Livre", primary: "quadríceps", compound: true, difficulty: 3 },
      { name: "Leg Press 45", primary: "quadríceps", compound: true, difficulty: 2 },
      { name: "Cadeira Extensora", primary: "quadríceps", compound: false, difficulty: 1 },
      { name: "Stiff com Barra", primary: "posterior", compound: true, difficulty: 3 },
      { name: "Cadeira Flexora", primary: "posterior", compound: false, difficulty: 1 },
      { name: "Elevação Pélvica (Hip Thrust)", primary: "glúteos", compound: true, difficulty: 2 },
      { name: "Panturrilha em Pé", primary: "panturrilha", compound: false, difficulty: 1 },
      { name: "Avanço com Barra", primary: "quadríceps", compound: true, difficulty: 2 },
    ],
  },
  dumbbells: {
    push: [
      { name: "Supino com Halteres", primary: "peito", compound: true, difficulty: 2 },
      { name: "Crucifixo com Halteres", primary: "peito", compound: false, difficulty: 1 },
      { name: "Supino Inclinado com Halteres", primary: "peito", compound: true, difficulty: 2 },
      { name: "Desenvolvimento Arnold", primary: "ombros", compound: true, difficulty: 2 },
      { name: "Elevação Lateral com Halteres", primary: "ombros", compound: false, difficulty: 1 },
      { name: "Tríceps Coice (Kickback)", primary: "tríceps", compound: false, difficulty: 1 },
      { name: "Tríceps Francês com Halter", primary: "tríceps", compound: false, difficulty: 1 },
    ],
    pull: [
      { name: "Remada Curvada com Halteres", primary: "costas", compound: true, difficulty: 2 },
      { name: "Remada Unilateral", primary: "costas", compound: true, difficulty: 2 },
      { name: "Levantamento Terra com Halteres", primary: "costas", compound: true, difficulty: 2 },
      { name: "Rosca Alternada", primary: "bíceps", compound: false, difficulty: 1 },
      { name: "Rosca Martelo com Halteres", primary: "bíceps", compound: false, difficulty: 1 },
    ],
    legs: [
      { name: "Agachamento Goblet", primary: "quadríceps", compound: true, difficulty: 2 },
      { name: "Afundo com Halteres", primary: "quadríceps", compound: true, difficulty: 2 },
      { name: "Stiff com Halteres", primary: "posterior", compound: true, difficulty: 2 },
      { name: "Panturrilha Sentado", primary: "panturrilha", compound: false, difficulty: 1 },
      { name: "Agachamento Búlgaro", primary: "quadríceps", compound: true, difficulty: 3 },
    ],
  },
  bodyweight: {
    push: [
      { name: "Flexão de Braço", primary: "peito", compound: true, difficulty: 1 },
      { name: "Flexão Inclinada (Pés Elevados)", primary: "peito", compound: true, difficulty: 2 },
      { name: "Dips em Banco", primary: "tríceps", compound: true, difficulty: 2 },
      { name: "Prancha Lateral", primary: "core", compound: false, difficulty: 1 },
      { name: "Flexão Diamante", primary: "tríceps", compound: true, difficulty: 2 },
    ],
    pull: [
      { name: "Barra Fixa", primary: "costas", compound: true, difficulty: 3 },
      { name: "Remada Invertida (Mesa)", primary: "costas", compound: true, difficulty: 2 },
      { name: "Superman", primary: "lombar", compound: false, difficulty: 1 },
      { name: "Prancha", primary: "core", compound: false, difficulty: 1 },
    ],
    legs: [
      { name: "Agachamento Livre", primary: "quadríceps", compound: true, difficulty: 1 },
      { name: "Afundo Alternado", primary: "quadríceps", compound: true, difficulty: 2 },
      { name: "Ponte de Glúteo", primary: "glúteos", compound: true, difficulty: 1 },
      { name: "Panturrilha em Pé", primary: "panturrilha", compound: false, difficulty: 1 },
      { name: "Agachamento Pistola (Assistido)", primary: "quadríceps", compound: true, difficulty: 3 },
    ],
  },
};

const CARDIO_LIBRARY: Record<EquipKey, string[]> = {
  gym: ["Esteira (corrida)", "Bicicleta Estacionária", "Elíptico", "Remo"],
  dumbbells: ["Corrida livre", "Pular corda", "Corrida com pesos"],
  bodyweight: ["Burpees", "Polichinelo", "Mountain Climber", "Corrida Estacionária", "Jumping Jacks"],
};

function pickEquipment(equipment: string[]): EquipKey {
  if (equipment.includes("gym")) return "gym";
  if (equipment.includes("dumbbells")) return "dumbbells";
  return "bodyweight";
}

function filterByDifficulty(exercises: ExerciseDef[], maxDifficulty: number): ExerciseDef[] {
  return exercises.filter((e) => e.difficulty <= maxDifficulty);
}

function rotate<T>(arr: T[], offset: number, count: number): T[] {
  const result: T[] = [];
  for (let i = 0; i < count; i++) result.push(arr[(offset + i) % arr.length]);
  return result;
}

function pickExercises(pool: ExerciseDef[], offset: number, count: number): ExerciseDef[] {
  const selected = rotate(pool, offset, count);
  return selected;
}

export function generateWorkoutPlan(answers: RecommendationAnswers): WorkoutRecommendationDay[] {
  const { goal, experience, workout_days, equipment } = answers;
  const eqKey = pickEquipment(equipment);
  const lib = EXERCISE_LIBRARY[eqKey];

  const maxDifficulty = experience === "beginner" ? 1 : experience === "intermediate" ? 2 : 3;

  const filteredLib: Record<MuscleGroup, ExerciseDef[]> = {
    push: filterByDifficulty(lib.push, maxDifficulty),
    pull: filterByDifficulty(lib.pull, maxDifficulty),
    legs: filterByDifficulty(lib.legs, maxDifficulty),
  };

  const setsBase = experience === "beginner" ? 3 : experience === "advanced" ? 5 : 4;
  const repsByGoal: Record<Goal, string> = {
    lose_weight: "12-15",
    build_muscle: "8-12",
    maintain: "10-12",
    endurance: "15-20",
    general: "10-15",
  };
  const reps = repsByGoal[goal];
  const rest = goal === "endurance" ? 30 : goal === "lose_weight" ? 45 : experience === "advanced" ? 120 : 90;

  const dayLabels = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  const days: WorkoutRecommendationDay[] = [];

  const buildExercise = (ex: ExerciseDef, isCardio = false): WorkoutRecommendationExercise => ({
    name: ex.name,
    sets: isCardio ? 1 : setsBase,
    reps: isCardio ? "20-30 min" : reps,
    rest: isCardio ? 0 : rest,
    notes: ex.compound ? "Exercício composto - priorize a execução" : undefined,
  });

  if (workout_days <= 3) {
    for (let i = 0; i < workout_days; i++) {
      const offset = i * 2;
      const ex = [
        ...pickExercises(filteredLib.push, offset, 2),
        ...pickExercises(filteredLib.pull, offset, 2),
        ...pickExercises(filteredLib.legs, offset, 3),
      ];
      days.push({
        dayName: dayLabels[i] || `Dia ${i + 1}`,
        focus: "Full Body",
        exercises: ex.map((e) => buildExercise(e)),
      });
    }
  } else if (workout_days <= 4) {
    const pattern = [
      { focus: "Superiores (Push)", ex: pickExercises(filteredLib.push, 0, 5) },
      { focus: "Inferiores", ex: pickExercises(filteredLib.legs, 0, 5) },
      { focus: "Superiores (Pull)", ex: pickExercises(filteredLib.pull, 0, 5) },
      { focus: "Inferiores + Core", ex: [...pickExercises(filteredLib.legs, 2, 3), ...pickExercises(filteredLib.pull, 3, 2)] },
    ];
    for (let i = 0; i < workout_days; i++) {
      const p = pattern[i];
      days.push({
        dayName: dayLabels[i] || `Dia ${i + 1}`,
        focus: p.focus,
        exercises: p.ex.map((e) => buildExercise(e)),
      });
    }
  } else {
    const cardioExercises = CARDIO_LIBRARY[eqKey];
    const pattern = [
      { focus: "Push (Peito/Ombros/Tríceps)", ex: pickExercises(filteredLib.push, 0, 5) },
      { focus: "Pull (Costas/Bíceps)", ex: pickExercises(filteredLib.pull, 0, 5) },
      { focus: "Pernas (Quadríceps/Posterior)", ex: pickExercises(filteredLib.legs, 0, 5) },
      { focus: "Push (Variação)", ex: pickExercises(filteredLib.push, 3, 4) },
      { focus: "Pull (Variação)", ex: pickExercises(filteredLib.pull, 3, 4) },
      { focus: "Cardio + Core", ex: [...cardioExercises.slice(0, 3).map((n) => ({ name: n, primary: "cardio", compound: false, difficulty: 1 as const })), ...pickExercises(filteredLib.legs, 4, 2)] },
    ];
    for (let i = 0; i < workout_days; i++) {
      const p = pattern[i] || pattern[0];
      const isCardio = i === 5;
      days.push({
        dayName: dayLabels[i] || `Dia ${i + 1}`,
        focus: p.focus,
        exercises: p.ex.map((e) => buildExercise(e, isCardio && e.primary === "cardio")),
      });
    }
  }

  return days;
}

export function generateDietPlan(answers: RecommendationAnswers, weightKg = 75): DietRecommendationMeal[] {
  const { goal, diet } = answers;
  const isVegan = diet === "vegan";
  const isVegetarian = diet === "vegetarian" || isVegan;
  const isLowCarb = diet === "low_carb";

  const activityAdjustment = Math.max(-200, Math.min(300, (answers.workout_days - 3) * 100));
  const baseCalories =
    goal === "lose_weight" ? 1800
    : goal === "build_muscle" ? 2600
    : goal === "endurance" ? 2500
    : goal === "maintain" ? 2200
    : 2100;
  const weightFactor = (Math.max(45, Math.min(110, weightKg)) - 75) * 12;
  const calTarget = Math.max(1500, Math.round(baseCalories + activityAdjustment + weightFactor));

  const proteinPerKg = goal === "build_muscle" ? 2.0 : goal === "lose_weight" ? 1.8 : goal === "endurance" ? 1.6 : 1.5;
  const totalProtein = Math.round(Math.max(45, Math.min(110, weightKg)) * proteinPerKg);
  const totalCarbs = isLowCarb ? Math.round(calTarget * 0.2 / 4) : Math.round(calTarget * 0.4 / 4);
  const totalFats = isLowCarb ? Math.round(calTarget * 0.4 / 9) : Math.round(calTarget * 0.25 / 9);

  const allergyText = Array.isArray(answers.allergies) ? answers.allergies.join(",") : answers.allergies || "";
  const allergens = allergyText.toLowerCase();
  const filterAllergens = (items: string[]) =>
    items.filter((item) =>
      !allergens.split(",").some((a) => a.trim() && item.toLowerCase().includes(a.trim().toLowerCase()))
    );

  const proteinSources = isVegan
    ? ["Tofu firme", "Grão-de-bico", "Lentilha", "Proteína vegetal texturizada", "Edamame", "Tempeh", "Feijão preto", "Quinoa"]
    : isVegetarian
    ? ["Ovos", "Queijo cottage", "Iogurte grego", "Whey protein", "Clara de ovo", "Tofu", "Queijo ricota"]
    : ["Frango grelhado", "Ovos", "Carne magra (patinho)", "Peixe (tilápia)", "Whey protein", "Salmão", "Atum", "Carne moída magra"];
  const carbSources = isLowCarb
    ? ["Batata-doce (pequena)", "Abóbora cabotiá", "Folhas verdes", "Quiabo", "Couve-flor"]
    : ["Arroz integral", "Aveia", "Batata-doce", "Banana", "Pão integral", "Mandioquinha", "Quinoa", "Mandioca"];
  const fatSources = ["Abacate", "Azeite extravirgem", "Castanhas do Pará", "Amêndoas", "Pasta de amendoim", "Nozes", "Azeitonas"];

  const safeProtein = filterAllergens(proteinSources);
  const safeCarbs = filterAllergens(carbSources);
  const safeFats = filterAllergens(fatSources);

  const p = safeProtein[0] || "Fonte de proteína";
  const p2 = safeProtein[1] || safeProtein[0] || "Fonte de proteína";
  const p3 = safeProtein[2] || p;
  const c = safeCarbs[0] || "Fonte de carboidrato";
  const c2 = safeCarbs[1] || safeCarbs[0] || "Fonte de carboidrato";
  const c3 = safeCarbs[2] || c;
  const f = safeFats[0] || "Fonte de gordura";
  const f2 = safeFats[1] || f;
  const f3 = safeFats[2] || f;

  const meals: DietRecommendationMeal[] = [
    {
      meal: "Café da Manhã",
      items: `${c} (100g), ${p} (2 unidades/100g), ${f} (1 colher de sopa)`,
      calories: Math.round(calTarget * 0.25),
      protein: Math.round(totalProtein * 0.25),
      carbs: Math.round(totalCarbs * 0.25),
      fats: Math.round(totalFats * 0.25),
    },
    {
      meal: "Lanche da Manhã",
      items: `${c2} (1 porção), ${f2} (1 punhado)`,
      calories: Math.round(calTarget * 0.1),
      protein: Math.round(totalProtein * 0.1),
      carbs: Math.round(totalCarbs * 0.1),
      fats: Math.round(totalFats * 0.1),
    },
    {
      meal: "Almoço",
      items: `${p} (150g), ${c} (150g), salada verde à vontade, ${f} (1 colher de sopa)`,
      calories: Math.round(calTarget * 0.3),
      protein: Math.round(totalProtein * 0.35),
      carbs: Math.round(totalCarbs * 0.3),
      fats: Math.round(totalFats * 0.3),
    },
    {
      meal: "Lanche da Tarde (Pré-treino)",
      items: `${p2} (100g), ${c2} (1 porção), ${f2} (1 colher)`,
      calories: Math.round(calTarget * 0.1),
      protein: Math.round(totalProtein * 0.1),
      carbs: Math.round(totalCarbs * 0.15),
      fats: Math.round(totalFats * 0.1),
    },
    {
      meal: "Jantar (Pós-treino)",
      items: `${p3} (150g), ${c3} (100g), legumes refogados, ${f3} (1 colher)`,
      calories: Math.round(calTarget * 0.25),
      protein: Math.round(totalProtein * 0.2),
      carbs: Math.round(totalCarbs * 0.2),
      fats: Math.round(totalFats * 0.25),
    },
  ];

  return meals;
}

export function goalLabel(goal: Goal): string {
  return {
    lose_weight: "Perda de Peso",
    build_muscle: "Hipertrofia Muscular",
    maintain: "Manutenção",
    endurance: "Resistência Cardiovascular",
    general: "Melhora da Saúde Geral",
  }[goal];
}
