import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, BookOpen, Users, Dumbbell, Apple, TrendingUp, MessageSquare,
  Calendar, Award, Sparkles, ChevronRight, Play, ArrowRight,
  Flame, Heart, Zap, Target, Bell,
} from "lucide-react";
import { FitSyncLogo } from "../components/FitSyncLogo";
import { Button } from "../components/ui/button";
import { useAuth } from "../context/AuthContext";

// =============================================================================
// Página inicial pública (Welcome)
// -----------------------------------------------------------------------------
// Objetivo: explicar as funções do FitSync para visitantes sem login e
// permitir que testem algumas funcionalidades (demos interativas).
// Rota pública: /welcome  (não exige autenticação)
// =============================================================================

// Lista das principais funcionalidades do app, usada na seção "Recursos".
const FEATURES = [
  {
    icon: Apple,
    title: "Diário Alimentar",
    description: "Registre refeições, calcule calorias e macros e acompanhe sua nutrição dia a dia.",
    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    icon: Dumbbell,
    title: "Treinos",
    description: "Monte planos de treino, registre séries e acompanhe a progressão de carga.",
    color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
  },
  {
    icon: TrendingUp,
    title: "Progresso",
    description: "Veja gráficos de peso, medidas e evolução ao longo do tempo.",
    color: "text-violet-600 bg-violet-50 dark:bg-violet-900/20",
  },
  {
    icon: Target,
    title: "Metas",
    description: "Defina objetivos de peso, calorias e atividade e acompanhe sua conquista.",
    color: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
  },
  {
    icon: Users,
    title: "Profissionais",
    description: "Encontre nutricionistas e personal trainers e agende consultas.",
    color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20",
  },
  {
    icon: MessageSquare,
    title: "Mensagens",
    description: "Converse com seu profissional ou amigos pelo chat integrado.",
    color: "text-pink-600 bg-pink-50 dark:bg-pink-900/20",
  },
  {
    icon: BookOpen,
    title: "Receitas",
    description: "Explore receitas saudáveis da comunidade com macros calculados.",
    color: "text-orange-600 bg-orange-50 dark:bg-orange-900/20",
  },
  {
    icon: Calendar,
    title: "Consultas",
    description: "Agende e gerencie consultas com profissionais de saúde.",
    color: "text-teal-600 bg-teal-50 dark:bg-teal-900/20",
  },
  {
    icon: Award,
    title: "Conquistas",
    description: "Ganhe medalhas e mantenha sequências de uso para se manter motivado.",
    color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20",
  },
];

export function Welcome() {
  const { user } = useAuth();
  const [demoTab, setDemoTab] = useState<"imc" | "calorias" | "agua">("imc");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-primary-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-primary-900/10">
      {/* ── Header / nav ── */}
      <header className="sticky top-0 z-40 border-b border-edge-base/60 bg-surface-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <FitSyncLogo size="md" />
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Criar conta</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="text-center lg:text-left">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-1.5 text-sm font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                <Sparkles className="h-4 w-4" />
                Sua saúde em um só lugar
              </div>
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-content-strong sm:text-5xl lg:text-6xl">
                Transforme seu corpo e sua vida com o{" "}
                <span className="text-primary-600">FitSync</span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-lg text-content-muted lg:mx-0">
                Diário alimentar, treinos, progresso, profissionais e muito mais.
                Tudo o que você precisa para alcançar seus objetivos de saúde e bem-estar.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                <Link to="/register">
                  <Button size="lg" className="w-full sm:w-auto">
                    Começar grátis <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <a href="#demos">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    <Play className="h-4 w-4" /> Experimentar
                  </Button>
                </a>
              </div>
              {user && (
                <p className="mt-4 text-sm text-content-muted">
                  Você já está logado.{" "}
                  <Link to="/dashboard" className="font-semibold text-primary-600 hover:text-primary-700">
                    Ir para o painel →
                  </Link>
                </p>
              )}
            </div>

            {/* Card visual do hero */}
            <div className="relative hidden lg:block">
              <div className="absolute -right-8 -top-8 h-72 w-72 rounded-full bg-primary-200/40 blur-3xl" />
              <div className="absolute -bottom-8 -left-8 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
              <div className="relative rounded-3xl border border-edge-base/60 bg-surface-card p-6 shadow-2xl shadow-primary-900/10">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700">
                      <Activity className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-content-strong">Resumo do dia</p>
                      <p className="text-xs text-content-muted">Segunda, 26 out</p>
                    </div>
                  </div>
                  <Bell className="h-5 w-5 text-content-muted" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard icon={Flame} label="Calorias" value="1.840" sub="kcal" tone="text-orange-500" />
                  <StatCard icon={Heart} label="Proteína" value="142g" sub="meta 160g" tone="text-rose-500" />
                  <StatCard icon={Zap} label="Energia" value="Alta" sub="hoje" tone="text-amber-500" />
                </div>
                <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-content-body">Meta de calorias</span>
                    <span className="text-content-muted">78%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-primary-500 to-primary-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Recursos ── */}
      <section className="border-y border-edge-base/60 bg-surface-card/50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-content-strong sm:text-4xl">
              Tudo o que o FitSync faz por você
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-content-muted">
              Uma plataforma completa para nutrição, treino e acompanhamento profissional.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-edge-base/60 bg-surface-card p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary-900/5"
              >
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${f.color}`}>
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-content-strong">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-content-muted">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demos interativas ── */}
      <section id="demos" className="py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <Play className="h-4 w-4" /> Teste sem cadastro
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-content-strong sm:text-4xl">
              Experimente agora
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-content-muted">
              Veja como o FitSync calcula informações importantes para sua saúde.
              Sem login, sem cadastro — só clique e teste.
            </p>
          </div>

          <div className="rounded-3xl border border-edge-base/60 bg-surface-card p-6 shadow-xl shadow-primary-900/5 sm:p-8">
            {/* Abas das demos */}
            <div className="mb-6 flex flex-wrap gap-2">
              <DemoTab active={demoTab === "imc"} onClick={() => setDemoTab("imc")} icon={Activity} label="Calculadora de IMC" />
              <DemoTab active={demoTab === "calorias"} onClick={() => setDemoTab("calorias")} icon={Flame} label="Calorias diárias" />
              <DemoTab active={demoTab === "agua"} onClick={() => setDemoTab("agua")} icon={Heart} label="Água ideal" />
            </div>

            {demoTab === "imc" && <ImcDemo />}
            {demoTab === "calorias" && <CaloriasDemo />}
            {demoTab === "agua" && <AguaDemo />}
          </div>

          <p className="mt-6 text-center text-sm text-content-muted">
            Gostou?{" "}
            <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700">
              Crie sua conta grátis →
            </Link>
          </p>
        </div>
      </section>

      {/* ── Como funciona ── */}
      <section className="border-t border-edge-base/60 bg-surface-card/50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-content-strong sm:text-4xl">
              Como funciona
            </h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              { n: 1, title: "Crie sua conta", desc: "Cadastre-se grátis em segundos e faça o onboarding inicial." },
              { n: 2, title: "Registre seu dia", desc: "Adicione refeições, treinos e medidas no diário diário." },
              { n: 3, title: "Evolua com suporte", desc: "Acompanhe gráficos, conecte-se com profissionais e alcance metas." },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white">
                  {s.n}
                </div>
                <h3 className="text-lg font-semibold text-content-strong">{s.title}</h3>
                <p className="mt-2 text-sm text-content-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="rounded-3xl bg-gradient-to-br from-primary-600 to-primary-800 p-8 text-center shadow-2xl shadow-primary-900/20 sm:p-12">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Pronto para começar?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-100">
              Junte-se a milhares de pessoas que já transformaram sua saúde com o FitSync.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/register">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Criar conta grátis <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto">
                  Já tenho conta
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-edge-base/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <FitSyncLogo size="sm" />
          <p className="text-sm text-content-muted">
            © {new Date().getFullYear()} FitSync. Sua saúde, sincronizada.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes de UI
// ---------------------------------------------------------------------------

function StatCard({ icon: Icon, label, value, sub, tone }: {
  icon: React.ElementType; label: string; value: string; sub: string; tone: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 text-center dark:bg-slate-800/50">
      <Icon className={`mx-auto mb-1 h-5 w-5 ${tone}`} />
      <p className="text-base font-bold text-content-strong">{value}</p>
      <p className="text-[11px] text-content-muted">{label}</p>
      <p className="text-[10px] text-content-muted/70">{sub}</p>
    </div>
  );
}

function DemoTab({ active, onClick, icon: Icon, label }: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-primary-600 text-white"
          : "bg-slate-100 text-content-body hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Demos interativas (lógica pura no cliente, sem precisar de login)
// ---------------------------------------------------------------------------

function ImcDemo() {
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");

  const pesoNum = parseFloat(peso.replace(",", "."));
  const alturaNum = parseFloat(altura.replace(",", "."));
  const imc = pesoNum && alturaNum ? pesoNum / (alturaNum * alturaNum) : null;

  let categoria = "";
  let corCategoria = "";
  if (imc) {
    if (imc < 18.5) { categoria = "Abaixo do peso"; corCategoria = "text-amber-600"; }
    else if (imc < 25) { categoria = "Peso ideal"; corCategoria = "text-emerald-600"; }
    else if (imc < 30) { categoria = "Sobrepeso"; corCategoria = "text-amber-600"; }
    else { categoria = "Obesidade"; corCategoria = "text-red-600"; }
  }

  return (
    <div>
      <h3 className="mb-1 text-lg font-semibold text-content-strong">Calculadora de IMC</h3>
      <p className="mb-5 text-sm text-content-muted">
        O Índice de Massa Corporal ajuda a avaliar se seu peso está adequado à sua altura.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-content-body">Peso (kg)</label>
          <input
            type="text" inputMode="decimal" placeholder="ex.: 70"
            value={peso} onChange={(e) => setPeso(e.target.value)}
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-content-strong outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-content-body">Altura (m)</label>
          <input
            type="text" inputMode="decimal" placeholder="ex.: 1.75"
            value={altura} onChange={(e) => setAltura(e.target.value)}
            className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-content-strong outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
      </div>
      {imc && (
        <div className="mt-5 flex items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-600 text-white">
            <span className="text-lg font-bold">{imc.toFixed(1)}</span>
          </div>
          <div>
            <p className="text-sm text-content-muted">Seu IMC</p>
            <p className={`text-lg font-semibold ${corCategoria}`}>{categoria}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CaloriasDemo() {
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [idade, setIdade] = useState("");
  const [sexo, setSexo] = useState<"m" | "f">("m");
  const [atividade, setAtividade] = useState("1.55");

  const p = parseFloat(peso.replace(",", "."));
  const a = parseFloat(altura.replace(",", "."));
  const i = parseFloat(idade);

  // Fórmula de Mifflin-St Jeor
  const tmb = p && a && i
    ? sexo === "m"
      ? 10 * p + 6.25 * a - 5 * i + 5
      : 10 * p + 6.25 * a - 5 * i - 161
    : null;
  const gasto = tmb ? Math.round(tmb * parseFloat(atividade)) : null;

  return (
    <div>
      <h3 className="mb-1 text-lg font-semibold text-content-strong">Calorias diárias (TDEE)</h3>
      <p className="mb-5 text-sm text-content-muted">
        Estimativa de calorias que você gasta por dia, com base na fórmula Mifflin-St Jeor.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Peso (kg)" value={peso} onChange={setPeso} placeholder="ex.: 70" />
        <Campo label="Altura (cm)" value={altura} onChange={setAltura} placeholder="ex.: 175" />
        <Campo label="Idade" value={idade} onChange={setIdade} placeholder="ex.: 30" />
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-content-body">Sexo</label>
          <div className="flex gap-2">
            <button onClick={() => setSexo("m")} className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${sexo === "m" ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30" : "border-slate-200 text-content-body dark:border-slate-700"}`}>Masculino</button>
            <button onClick={() => setSexo("f")} className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${sexo === "f" ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30" : "border-slate-200 text-content-body dark:border-slate-700"}`}>Feminino</button>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        <label className="text-sm font-medium text-content-body">Nível de atividade</label>
        <select
          value={atividade} onChange={(e) => setAtividade(e.target.value)}
          className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-content-strong outline-none focus:border-primary-500 dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="1.2">Sedentário (pouco exercício)</option>
          <option value="1.375">Levemente ativo (1-3x/semana)</option>
          <option value="1.55">Moderadamente ativo (3-5x/semana)</option>
          <option value="1.725">Muito ativo (6-7x/semana)</option>
          <option value="1.9">Extremamente ativo (atleta)</option>
        </select>
      </div>
      {gasto && (
        <div className="mt-5 flex items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 text-white">
            <Flame className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm text-content-muted">Gasto diário estimado</p>
            <p className="text-2xl font-bold text-content-strong">{gasto} kcal</p>
            <p className="text-xs text-content-muted">para manter o peso atual</p>
          </div>
        </div>
      )}
    </div>
  );
}

function AguaDemo() {
  const [peso, setPeso] = useState("");
  const p = parseFloat(peso.replace(",", "."));
  // Recomendação comum: 35 ml por kg de peso corporal.
  const ml = p ? Math.round(p * 35) : null;
  const litros = ml ? (ml / 1000).toFixed(2) : null;
  const copos = ml ? Math.round(ml / 250) : null;

  return (
    <div>
      <h3 className="mb-1 text-lg font-semibold text-content-strong">Ingestão ideal de água</h3>
      <p className="mb-5 text-sm text-content-muted">
        Estimativa de quanto água você deveria beber por dia, com base no seu peso.
      </p>
      <div className="max-w-xs space-y-1.5">
        <Campo label="Peso (kg)" value={peso} onChange={setPeso} placeholder="ex.: 70" />
      </div>
      {ml && (
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500 text-white">
            <Heart className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm text-content-muted">Ingestão recomendada</p>
            <p className="text-2xl font-bold text-content-strong">{litros} L</p>
            <p className="text-xs text-content-muted">≈ {copos} copos de 250 ml</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-content-body">{label}</label>
      <input
        type="text" inputMode="decimal" placeholder={placeholder}
        value={value} onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-content-strong outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-slate-700 dark:bg-slate-800"
      />
    </div>
  );
}
