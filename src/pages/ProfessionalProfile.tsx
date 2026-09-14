import { useEffect, useState } from "react";
import {
  Star, MapPin, Users, Pencil, Check, X, Plus, Trash2, Loader2,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import { useI18n } from "../context/I18nContext";
import { supabase } from "../lib/supabase";
import type { ProfessionalPlan } from "../lib/types";

interface ProProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  professional_role: string | null;
  specialty: string | null;
  credentials: string | null;
  location_city: string | null;
  bio: string | null;
  rating_avg: number | null;
  rating_count: number | null;
}

interface PlanFeature { label: string; included: boolean }
interface PlanForm {
  id?: string;
  name: string;
  price: string;
  tagline: string;
  features: PlanFeature[];
  popular: boolean;
}

const initialForm: PlanForm = {
  name: "", price: "", tagline: "",
  features: [{ label: "", included: true }],
  popular: false,
};

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}



function PlanCardDisplay({ plan, popular }: { plan: { name: string; price: number; tagline: string; features: PlanFeature[] }; popular: boolean }) {
  if (popular) {
    return (
      <div className="relative flex flex-col rounded-2xl bg-primary-600 p-6 text-white shadow-xl">
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900 px-4 py-1 text-xs font-bold text-white">
          Mais Popular
        </span>
        <h3 className="text-lg font-bold">{plan.name}</h3>
        <p className="mt-1 text-xs text-primary-100">{plan.tagline}</p>
        <div className="my-5 flex items-baseline gap-1">
          <span className="text-4xl font-black">R$ {plan.price}</span>
          <span className="text-sm text-primary-200">/mês</span>
        </div>
        <ul className="flex flex-1 flex-col gap-2.5">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${f.included ? "bg-white/20" : "bg-white/10"}`}>
                {f.included ? <Check className="h-2.5 w-2.5 text-white" /> : <X className="h-2.5 w-2.5 text-white/40" />}
              </span>
              <span className={f.included ? "text-white" : "text-primary-200/60 line-through decoration-white/30"}>{f.label}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
      <p className="mt-1 text-xs text-primary-600">{plan.tagline}</p>
      <div className="my-5 flex items-baseline gap-1">
        <span className="text-4xl font-black text-slate-900">R$ {plan.price}</span>
        <span className="text-sm text-slate-400">/mês</span>
      </div>
      <ul className="flex flex-1 flex-col gap-2.5">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${f.included ? "bg-primary-50" : "bg-slate-100"}`}>
              {f.included ? <Check className="h-2.5 w-2.5 text-primary-600" /> : <X className="h-2.5 w-2.5 text-slate-300" />}
            </span>
            <span className={f.included ? "text-slate-700" : "text-slate-300 line-through"}>{f.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProfessionalProfile() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { id: paramId } = useParams();
  const { t } = useI18n();
  const [proProfile, setProProfile] = useState<ProProfile | null>(null);
  const [plans, setPlans] = useState<ProfessionalPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [clientCount, setClientCount] = useState(0);

  const viewingOther = !!paramId && paramId !== user?.id;
  const profileId = paramId || user?.id || "";

  useEffect(() => {
    if (!profileId) return;
    (async () => {
      setLoading(true);
      const [{ data: pData }, { data: planData }, { count: planCount }, { count: aptCount }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, professional_role, specialty, credentials, location_city, bio, rating_avg, rating_count")
          .eq("id", profileId)
          .maybeSingle(),
        supabase
          .from("professional_plans")
          .select("*")
          .eq("professional_id", profileId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("client_plans")
          .select("client_id", { count: "exact", head: true })
          .eq("professional_id", profileId),
        supabase
          .from("appointments")
          .select("user_id", { count: "exact", head: true })
          .eq("professional_id", profileId),
      ]);
      setProProfile(pData as ProProfile | null);
      setPlans((planData as ProfessionalPlan[]) || []);
      setClientCount((planCount ?? 0) + (aptCount ?? 0));
      setLoading(false);
    })();
  }, [profileId]);

  const name = proProfile?.full_name || (viewingOther ? "Profissional" : (profile?.full_name || "Profissional"));
  const role = proProfile?.professional_role || (viewingOther ? "" : (profile?.professional_role || ""));
  const specialty = proProfile?.specialty || (viewingOther ? "" : (profile?.specialty || ""));
  const credentials = proProfile?.credentials || (viewingOther ? "" : (profile?.credentials || ""));
  const city = proProfile?.location_city || (viewingOther ? "" : (profile?.location_city || ""));
  const bio = proProfile?.bio || (viewingOther ? "" : (profile?.bio || ""));
  const rating = proProfile?.rating_avg;
  const ratingCount = proProfile?.rating_count ?? 0;

  function openNewPlan() {
    setEditingId(null);
    setForm(initialForm);
    setModalOpen(true);
  }

  function openEditPlan(plan: ProfessionalPlan) {
    setEditingId(plan.id);
    setForm({
      id: plan.id,
      name: plan.name,
      price: String(plan.price),
      tagline: plan.tagline,
      features: (plan.features as PlanFeature[])?.length ? (plan.features as PlanFeature[]) : [{ label: "", included: true }],
      popular: plan.popular,
    });
    setModalOpen(true);
  }

  async function savePlan() {
    if (!user || !form.name.trim()) return;
    setSaving(true);
    const payload = {
      professional_id: user.id,
      name: form.name.trim(),
      price: parseInt(form.price) || 0,
      tagline: form.tagline.trim(),
      features: form.features.filter((f) => f.label.trim()),
      popular: form.popular,
      sort_order: 0,
    };
    if (editingId) {
      const { data } = await supabase.from("professional_plans").update(payload).eq("id", editingId).select().single();
      if (data) setPlans((prev) => prev.map((p) => p.id === data.id ? data as ProfessionalPlan : p));
    } else {
      const { data } = await supabase.from("professional_plans").insert(payload).select().single();
      if (data) setPlans((prev) => [...prev, data as ProfessionalPlan]);
    }
    setSaving(false);
    setModalOpen(false);
    setForm(initialForm);
    setEditingId(null);
  }

  async function deletePlan(id: string) {
    await supabase.from("professional_plans").delete().eq("id", id);
    setPlans((prev) => prev.filter((p) => p.id !== id));
  }

  const taCls = "w-full rounded-lg border border-edge-base bg-surface-base px-3 py-2 text-sm text-content-strong placeholder:text-content-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Hero banner */}
      <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-primary-700 via-primary-500 to-primary-400">
        <svg className="absolute bottom-0 left-0 h-full w-full opacity-20" viewBox="0 0 900 200" preserveAspectRatio="none">
          <path d="M0,100 C150,180 350,20 600,120 C750,200 850,60 900,80 L900,200 L0,200 Z" fill="white" />
          <path d="M0,140 C200,60 400,180 650,100 C800,40 870,130 900,110 L900,200 L0,200 Z" fill="white" opacity="0.5" />
        </svg>
      </div>

      {/* Profile header card */}
      <div className="mx-8 -mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 shrink-0 ring-4 ring-white shadow">
              {proProfile?.avatar_url ? (
                <AvatarImage src={proProfile.avatar_url} alt={name} />
              ) : (
                <AvatarFallback className="bg-rose-50 text-2xl font-bold text-rose-600">{initials(name)}</AvatarFallback>
              )}
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
              <p className="text-sm font-medium text-primary-600">
                {role}{credentials ? ` · ${credentials}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                {rating != null && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-slate-700">{Number(rating).toFixed(1)}</span>
                    {ratingCount > 0 && <span>({ratingCount} avaliações)</span>}
                  </span>
                )}
                {clientCount > 0 && (
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{clientCount} pacientes</span>
                )}
                {city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{city}</span>}
              </div>
            </div>
          </div>
          {!viewingOther && (
            <Button variant="outline" className="gap-2 self-start sm:self-auto" onClick={() => navigate("/profile")}>
              <Pencil className="h-4 w-4" />{t("profile.title")}
            </Button>
          )}
        </div>
      </div>

      {/* Main content + sidebar */}
      <div className="mx-8 mt-6 flex flex-col gap-6 xl:flex-row xl:items-start">
        {/* Plans */}
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{t("proPlans.title")}</h2>
              <p className="mt-0.5 text-sm text-slate-500">{t("proPlans.subtitle")}</p>
            </div>
            {!viewingOther && (
              <Button onClick={openNewPlan} className="gap-2"><Plus className="h-4 w-4" />{t("proPlans.new")}</Button>
            )}
          </div>

          {plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-16 text-center">
              <p className="text-base font-semibold text-slate-700">{t("proPlans.noPlans")}</p>
              {!viewingOther && <p className="mt-1 text-sm text-slate-400">{t("proPlans.subtitle")}</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {plans.map((plan) => (
                <div key={plan.id} className="relative">
                  <PlanCardDisplay
                    plan={{ name: plan.name, price: plan.price, tagline: plan.tagline, features: plan.features as PlanFeature[] }}
                    popular={plan.popular}
                  />
                  {!viewingOther && (
                    <div className="absolute right-3 top-3 flex gap-1.5">
                      <button onClick={() => openEditPlan(plan)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-slate-600 shadow-sm transition-colors hover:text-primary-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => deletePlan(plan.id)} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-slate-600 shadow-sm transition-colors hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="flex w-full flex-col gap-4 xl:w-72 xl:shrink-0">
          {bio && (
            <Card>
              <CardContent className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Sobre Mim</h3>
                <p className="text-sm leading-relaxed text-slate-600">{bio}</p>
                {specialty && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {specialty.split(",").map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                      <span key={tag} className="rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">{tag}</span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      {/* Plan edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setModalOpen(false)}>
          <Card className="w-full max-w-lg overflow-hidden rounded-b-none border-edge-base bg-surface-card shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-edge-base p-4">
              <h3 className="text-base font-bold text-content-strong">{editingId ? t("proPlans.edit") : t("proPlans.new")}</h3>
              <button onClick={() => setModalOpen(false)} className="text-content-muted transition-colors hover:text-content-strong">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-content-muted">{t("proPlans.name")}</label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Plano Básico" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-content-muted">{t("proPlans.price")}</label>
                    <Input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="149" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-content-muted">{t("proPlans.tagline")}</label>
                    <Input value={form.tagline} onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))} placeholder="Ideal para iniciantes" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">{t("proPlans.features")}</p>
                  <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, features: [...f.features, { label: "", included: true }] }))} className="gap-1">
                    <Plus className="h-3.5 w-3.5" />{t("add")}
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  {form.features.map((feat, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={feat.label}
                        onChange={(e) => setForm((f) => ({ ...f, features: f.features.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x) }))}
                        placeholder={t("proPlans.featureLabel")}
                      />
                      <button
                        onClick={() => setForm((f) => ({ ...f, features: f.features.map((x, idx) => idx === i ? { ...x, included: !x.included } : x) }))}
                        className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${feat.included ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-400"}`}
                      >
                        {feat.included ? t("proPlans.included") : t("proPlans.notIncluded")}
                      </button>
                      {form.features.length > 1 && (
                        <button onClick={() => setForm((f) => ({ ...f, features: f.features.filter((_, idx) => idx !== i) }))} className="shrink-0 text-content-muted transition-colors hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={form.popular} onChange={(e) => setForm((f) => ({ ...f, popular: e.target.checked }))} className="h-4 w-4 rounded border-edge-base text-primary-600 focus:ring-primary-500" />
                  <span className="text-sm text-content-body">{t("proPlans.popular")}</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-edge-base p-4">
              <Button variant="outline" onClick={() => setModalOpen(false)}>{t("cancel")}</Button>
              <Button onClick={savePlan} disabled={saving || !form.name.trim()} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t("save")}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
