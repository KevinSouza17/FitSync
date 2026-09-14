import { useEffect, useState } from "react";
import { Plus, Target, TrendingUp, X, Pencil, Check } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Progress } from "../components/ui/progress";
import { supabase } from "../lib/supabase";
import type { Goal } from "../lib/types";
import { useI18n } from "../context/I18nContext";

const categories = ["Força", "Cardio", "Peso", "Nutrição", "Composição", "Saúde", "Geral"];
const colorOptions = [
  { label: "Azul", value: "bg-primary-500" },
  { label: "Verde", value: "bg-green-500" },
  { label: "Laranja", value: "bg-orange-400" },
  { label: "Roxo", value: "bg-violet-500" },
  { label: "Vermelho", value: "bg-red-400" },
  { label: "Amarelo", value: "bg-amber-400" },
];

const colorDotMap: Record<string, string> = {
  "bg-primary-500": "bg-primary-500",
  "bg-green-500": "bg-green-500",
  "bg-orange-400": "bg-orange-400",
  "bg-violet-500": "bg-violet-500",
  "bg-red-400": "bg-red-400",
  "bg-amber-400": "bg-amber-400",
};

interface GoalForm {
  title: string;
  category: string;
  current_value: string;
  target_value: string;
  unit: string;
  deadline: string;
  color: string;
}

const emptyForm: GoalForm = {
  title: "",
  category: "Geral",
  current_value: "0",
  target_value: "100",
  unit: "",
  deadline: "",
  color: "bg-primary-500",
};

export function Goals() {
  const { t } = useI18n();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState<GoalForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingProgress, setEditingProgress] = useState<{ id: string; value: string } | null>(null);

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    setLoading(true);
    const { data } = await supabase.from("goals").select("*").order("created_at");
    if (data) setGoals(data);
    setLoading(false);
  }

  function openNew() {
    setEditingGoal(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(goal: Goal) {
    setEditingGoal(goal);
    setForm({
      title: goal.title,
      category: goal.category,
      current_value: String(goal.current_value),
      target_value: String(goal.target_value),
      unit: goal.unit,
      deadline: goal.deadline ?? "",
      color: goal.color,
    });
    setShowModal(true);
  }

  function setF(key: keyof GoalForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveGoal() {
    if (!form.title || !form.target_value) return;
    setSaving(true);
    const payload = {
      title: form.title,
      category: form.category,
      current_value: parseFloat(form.current_value) || 0,
      target_value: parseFloat(form.target_value) || 100,
      unit: form.unit,
      deadline: form.deadline || null,
      color: form.color,
    };
    if (editingGoal) {
      const { data } = await supabase.from("goals").update(payload).eq("id", editingGoal.id).select().single();
      if (data) setGoals((prev) => prev.map((g) => (g.id === editingGoal.id ? data : g)));
    } else {
      const { data } = await supabase.from("goals").insert(payload).select().single();
      if (data) setGoals((prev) => [...prev, data]);
    }
    setShowModal(false);
    setSaving(false);
  }

  async function deleteGoal(id: string) {
    await supabase.from("goals").delete().eq("id", id);
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  async function updateProgress(id: string, value: string) {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const { data } = await supabase.from("goals").update({ current_value: num }).eq("id", id).select().single();
    if (data) setGoals((prev) => prev.map((g) => (g.id === id ? data : g)));
    setEditingProgress(null);
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-strong">Minhas Metas</h1>
          <p className="mt-0.5 text-sm text-content-muted">Acompanhe seu progresso e objetivos</p>
        </div>
        <Button className="gap-2" onClick={openNew}>
          <Plus className="h-4 w-4" />
          Nova Meta
        </Button>
      </header>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Target className="mb-3 h-12 w-12 text-slate-200" />
            <h3 className="text-base font-semibold text-content-body">Nenhuma meta criada</h3>
            <p className="mt-1 text-sm text-content-muted">Crie sua primeira meta para começar a acompanhar seu progresso</p>
            <Button className="mt-4" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Meta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats summary */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Total de Metas", value: goals.length, icon: Target },
              { label: "Concluídas", value: goals.filter((g) => g.current_value >= g.target_value).length, icon: Check },
              { label: "Em Progresso", value: goals.filter((g) => g.current_value < g.target_value).length, icon: TrendingUp },
              { label: "Progresso Médio", value: `${Math.round(goals.reduce((s, g) => s + Math.min(100, (g.current_value / g.target_value) * 100), 0) / goals.length)}%`, icon: TrendingUp },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50">
                    <s.icon className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-content-strong">{s.value}</p>
                    <p className="text-xs text-content-muted">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Goals grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {goals.map((goal) => {
              const pct = Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
              const done = goal.current_value >= goal.target_value;
              return (
                <Card key={goal.id} className={done ? "ring-2 ring-green-200" : ""}>
                  <CardContent className="flex flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 shrink-0 rounded-full ${colorDotMap[goal.color] ?? "bg-primary-500"}`} />
                        <h3 className="text-sm font-semibold text-content-strong leading-tight">{goal.title}</h3>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => openEdit(goal)}
                          className="text-slate-300 hover:text-primary-500"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteGoal(goal.id)}
                          className="text-slate-300 hover:text-red-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-content-muted">Progresso</span>
                        <div className="flex items-center gap-2">
                          {editingProgress?.id === goal.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="any"
                                className="w-16 rounded border border-primary-400 px-1 py-0.5 text-xs text-content-strong focus:outline-none"
                                value={editingProgress.value}
                                onChange={(e) => setEditingProgress({ id: goal.id, value: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") updateProgress(goal.id, editingProgress.value);
                                  if (e.key === "Escape") setEditingProgress(null);
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() => updateProgress(goal.id, editingProgress.value)}
                                className="text-green-500 hover:text-green-700"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingProgress({ id: goal.id, value: String(goal.current_value) })}
                              className="font-semibold text-content-strong hover:text-primary-600"
                            >
                              {goal.current_value}{goal.unit}
                            </button>
                          )}
                          <span className="text-content-muted">/ {goal.target_value}{goal.unit}</span>
                          <span className={`font-bold ${done ? "text-green-600" : "text-content-body"}`}>{pct}%</span>
                        </div>
                      </div>
                      <Progress value={pct} indicatorClassName={done ? "bg-green-500" : colorDotMap[goal.color] ?? "bg-primary-500"} />
                    </div>

                    <div className="flex items-center justify-between text-xs text-content-muted">
                      <span className="rounded-full bg-surface-subtle px-2 py-0.5">{goal.category}</span>
                      {goal.deadline && (
                        <div className="flex items-center gap-1">
                          <Target className="h-3 w-3" />
                          {new Date(goal.deadline).toLocaleDateString("pt-BR")}
                        </div>
                      )}
                      {done && (
                        <span className="font-semibold text-green-600">Concluída!</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Goal Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-card p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-content-strong">
                {editingGoal ? "Editar Meta" : "Nova Meta"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-content-muted hover:text-content-body">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-content-body">Título *</label>
                <Input className="mt-1" placeholder="Ex: Correr 5km sem parar" value={form.title} onChange={(e) => setF("title", e.target.value)} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-content-body">Categoria</label>
                  <select
                    className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 py-2 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    value={form.category}
                    onChange={(e) => setF("category", e.target.value)}
                  >
                    {categories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-content-body">Unidade</label>
                  <Input className="mt-1" placeholder="kg, km, min…" value={form.unit} onChange={(e) => setF("unit", e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-content-body">Valor atual</label>
                  <Input className="mt-1" type="number" step="any" value={form.current_value} onChange={(e) => setF("current_value", e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-content-body">Meta *</label>
                  <Input className="mt-1" type="number" step="any" value={form.target_value} onChange={(e) => setF("target_value", e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-content-body">Prazo (opcional)</label>
                <Input className="mt-1" type="date" value={form.deadline} onChange={(e) => setF("deadline", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-content-body">Cor</label>
                <div className="mt-2 flex gap-2">
                  {colorOptions.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setF("color", c.value)}
                      className={`h-7 w-7 rounded-full ${c.value} transition-transform ${form.color === c.value ? "scale-125 ring-2 ring-offset-1 ring-slate-400" : ""}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={saveGoal} disabled={saving || !form.title || !form.target_value}>
                {saving ? t("saving") : editingGoal ? "Atualizar" : "Criar Meta"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
