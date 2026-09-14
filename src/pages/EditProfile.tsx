import { useEffect, useRef, useState } from "react";
import { Camera, Save, Check, Briefcase, GraduationCap, Award, MapPin, Loader2, Building2, ShieldCheck, ShieldAlert, User, Lock, Unlock, AtSign, CreditCard } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { AutoTextarea } from "../components/ui/textarea";

const healthGoals = [
  "Perda de Peso",
  "Hipertrofia Muscular",
  "Manutenção",
  "Ganho de Força",
  "Resistência Cardiovascular",
  "Melhora da Saúde Geral",
];

const activityLevels = [
  "Sedentário",
  "Levemente ativo",
  "Moderadamente ativo",
  "Muito ativo",
  "Extremamente ativo",
];

interface FormState {
  full_name: string;
  height_cm: string;
  weight_kg: string;
  goal_weight_kg: string;
  health_goal: string;
  daily_calorie_goal: string;
  daily_water_goal_liters: string;
  activity_level: string;
  is_professional: boolean;
  professional_role: string;
  specialty: string;
  bio: string;
  credentials: string;
  location_city: string;
  available_for_booking: boolean;
  registration_type: "autonomo" | "empresa";
  document_number: string;
  is_private: boolean;
  handle: string;
}

const professionalRoles = [
  "Nutricionista",
  "Personal Trainer",
  "Médico do Esporte",
  "Fisioterapeuta",
  "Psicóloga(o)",
  "Endocrinologista",
  "Coach de Saúde",
  "Outro",
];

const specialtiesList = [
  "Nutrição Esportiva",
  "Hipertrofia e Força",
  "Performance Atlética",
  "Bem-estar Mental",
  "Reabilitação",
  "Emagrecimento",
  "Nutrição Clínica",
  "Treinamento Funcional",
  "Outro",
];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function EditProfile() {
  const { profile, user, refreshProfile } = useAuth();
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>({
    full_name: "",
    height_cm: "",
    weight_kg: "",
    goal_weight_kg: "",
    health_goal: "Manutenção",
    daily_calorie_goal: "2400",
    daily_water_goal_liters: "2.5",
    activity_level: "Moderadamente ativo",
    is_professional: false,
    professional_role: "",
    specialty: "",
    bio: "",
    credentials: "",
    location_city: "",
    available_for_booking: false,
    registration_type: "autonomo",
    document_number: "",
    is_private: false,
    handle: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Realtime: refresh profile when it changes in the database
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("profile-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        () => { refreshProfile(); }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "weight_logs", filter: `user_id=eq.${user.id}` },
        () => { refreshProfile(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, refreshProfile]);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        height_cm: profile.height_cm ? String(profile.height_cm) : "",
        weight_kg: profile.weight_kg ? String(profile.weight_kg) : "",
        goal_weight_kg: profile.goal_weight_kg ? String(profile.goal_weight_kg) : "",
        health_goal: profile.health_goal ?? "Manutenção",
        daily_calorie_goal: String(profile.daily_calorie_goal ?? 2400),
        daily_water_goal_liters: String(profile.daily_water_goal_liters ?? 2.5),
        activity_level: profile.activity_level ?? "Moderadamente ativo",
        is_professional: profile.is_professional ?? false,
        professional_role: profile.professional_role ?? "",
        specialty: profile.specialty ?? "",
        bio: profile.bio ?? "",
        credentials: profile.credentials ?? "",
        location_city: profile.location_city ?? "",
        available_for_booking: profile.available_for_booking ?? false,
        registration_type: (profile.registration_type as "autonomo" | "empresa") ?? "autonomo",
        document_number: profile.document_number ?? "",
        is_private: profile.is_private ?? false,
        handle: profile.handle ?? "",
      });
      setAvatarUrl(profile.avatar_url ?? null);
    }
  }, [profile]);

  function setField(key: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingPhoto(true);
    setError("");

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      setError("Erro ao enviar foto. Tente novamente.");
      setUploadingPhoto(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (updateError) {
      setError("Erro ao salvar foto. Tente novamente.");
    } else {
      setAvatarUrl(publicUrl);
      await refreshProfile();
    }
    setUploadingPhoto(false);
  }

  async function handleSave() {
    if (!user) return;
    setError("");

    const cleanHandle = form.handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (cleanHandle && cleanHandle.length < 3) {
      setError("O @ deve ter pelo menos 3 caracteres (apenas letras, números e _).");
      return;
    }
    if (cleanHandle) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .ilike("handle", cleanHandle)
        .neq("id", user.id)
        .maybeSingle();
      if (existing) {
        setError("Este @ já está em uso. Escolha outro.");
        return;
      }
    }

    setSaving(true);
    const payload = {
      full_name: form.full_name,
      height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
      goal_weight_kg: form.goal_weight_kg ? parseFloat(form.goal_weight_kg) : null,
      health_goal: form.health_goal,
      daily_calorie_goal: parseInt(form.daily_calorie_goal) || 2400,
      daily_water_goal_liters: parseFloat(form.daily_water_goal_liters) || 2.5,
      activity_level: form.activity_level,
      is_professional: form.is_professional,
      professional_role: form.is_professional ? form.professional_role : null,
      specialty: form.is_professional ? form.specialty : null,
      bio: form.is_professional ? form.bio : null,
      credentials: form.is_professional ? form.credentials : null,
      location_city: form.is_professional ? form.location_city : null,
      available_for_booking: form.is_professional ? form.available_for_booking : false,
      registration_type: form.is_professional ? form.registration_type : "autonomo",
      document_number: form.is_professional ? form.document_number : null,
      is_private: form.is_private,
      handle: cleanHandle || null,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id);
    if (err) {
      setError("Erro ao salvar. Tente novamente.");
    } else {
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  }

  const displayName = form.full_name || user?.email?.split("@")[0] || "Usuário";

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-strong">{t("profile.title")}</h1>
          <p className="mt-0.5 text-sm text-content-muted">Atualize suas informações pessoais e de saúde</p>
        </div>
        <div className="flex items-center gap-3">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saving ? t("saving") : saved ? "Salvo!" : t("profile.save")}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Avatar + habits */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col items-center p-6 text-center">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={displayName} />
                  ) : (
                    <AvatarFallback className="bg-primary-50 text-3xl font-bold text-primary-700">
                      {initials(displayName)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-card bg-primary-600 text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
                >
                  {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
              <h3 className="mt-4 text-lg font-bold text-content-strong">{displayName}</h3>
              <p className="text-sm text-content-muted">{user?.email}</p>
              {form.is_professional && (
                <div className="mt-2 flex flex-col items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <Briefcase className="h-3 w-3" />
                    {form.professional_role || "Profissional"}
                  </span>
                  {profile?.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      <ShieldCheck className="h-3 w-3" />
                      {t("proreg.verifiedBadge")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      <ShieldAlert className="h-3 w-3" />
                      {t("proreg.pendingBadge")}
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="mb-4 text-sm font-semibold text-content-strong">Hábitos e Rotina</h3>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-medium text-content-muted">Nível de Atividade</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-edge-base bg-surface-card px-3 py-2 text-sm text-content-body focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    value={form.activity_level}
                    onChange={(e) => setField("activity_level", e.target.value)}
                  >
                    {activityLevels.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-content-muted">Meta de Água (L/dia)</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="10"
                    className="mt-1"
                    value={form.daily_water_goal_liters}
                    onChange={(e) => setField("daily_water_goal_liters", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-content-muted">Meta Calórica (kcal/dia)</label>
                  <Input
                    type="number"
                    step="50"
                    className="mt-1"
                    value={form.daily_calorie_goal}
                    onChange={(e) => setField("daily_calorie_goal", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main form */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardContent className="p-5">
              <h2 className="mb-4 text-base font-semibold text-content-strong">Informações Pessoais</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium text-content-body">{t("profile.fullName")}</label>
                  <Input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setField("full_name", e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium text-content-body">@ (usuário)</label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      value={form.handle}
                      onChange={(e) => setField("handle", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      placeholder="seunome"
                      className="pl-9"
                      maxLength={20}
                    />
                  </div>
                  <p className="text-xs text-content-muted">Apenas letras, números e _. Seu link: /@seunome</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-content-body">E-mail</label>
                  <Input type="email" value={user?.email ?? ""} disabled className="bg-surface-subtle text-content-muted" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-content-body">Conta criada em</label>
                  <Input
                    type="text"
                    value={user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined) : ""}
                    disabled
                    className="bg-surface-subtle text-content-muted"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold text-content-strong">
                    {form.is_private ? <Lock className="h-5 w-5 text-amber-500" /> : <Unlock className="h-5 w-5 text-emerald-500" />}
                    Perfil Privado
                  </h2>
                  <p className="mt-1 text-sm text-content-muted">
                    {form.is_private
                      ? "Apenas seus seguidores podem ver suas postagens."
                      : "Qualquer pessoa pode ver suas postagens e informações."}
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={form.is_private}
                  onClick={() => setField("is_private", !form.is_private)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    form.is_private ? "bg-amber-500" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      form.is_private ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h2 className="mb-4 text-base font-semibold text-content-strong">Medidas e Saúde</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-content-body">{t("profile.height")}</label>
                  <Input type="number" step="0.1" placeholder="178" value={form.height_cm} onChange={(e) => setField("height_cm", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-content-body">{t("profile.weight")}</label>
                  <Input type="number" step="0.1" placeholder="75.0" value={form.weight_kg} onChange={(e) => setField("weight_kg", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-content-body">Peso meta (kg)</label>
                  <Input type="number" step="0.1" placeholder="70.0" value={form.goal_weight_kg} onChange={(e) => setField("goal_weight_kg", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h2 className="mb-4 text-base font-semibold text-content-strong">{t("profile.healthGoal")}</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {healthGoals.map((goal) => (
                  <button
                    key={goal}
                    onClick={() => setField("health_goal", goal)}
                    className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                      form.health_goal === goal
                        ? "border-primary-600 bg-primary-50 text-primary-700"
                        : "border-edge-base bg-surface-card text-content-body hover:border-slate-300 hover:bg-surface-subtle"
                    }`}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Professional account section */}
          <Card>
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold text-content-strong">
                  <Briefcase className="h-5 w-5 text-emerald-600" />
                  Conta Profissional
                </h2>
              </div>
              {!form.is_professional ? (
                <div className="rounded-xl border border-dashed border-edge-base p-6 text-center">
                  <Briefcase className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-sm text-content-muted">Ative sua conta profissional para oferecer serviços e aparecer na busca de profissionais</p>
                  <div className="mt-4 rounded-lg bg-emerald-50 p-4 text-left dark:bg-emerald-900/20">
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Plano Profissional — R$ 25/mês</p>
                    <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-500">7 dias de teste grátis · Cancele quando quiser</p>
                    <p className="mt-2 text-xs text-content-muted">Para ativar sua conta profissional, é necessário assinar o plano mensal. Após o pagamento, as funcionalidades profissionais serão liberadas.</p>
                    <Button
                      className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={async () => {
                        try {
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!session) return;
                          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
                            method: "POST",
                            headers: {
                              "Authorization": `Bearer ${session.access_token}`,
                              "Content-Type": "application/json",
                            },
                          });
                          const data = await res.json();
                          if (data.url) window.location.href = data.url;
                        } catch {
                          setError("Erro ao iniciar pagamento. Tente novamente.");
                        }
                      }}
                    >
                      <CreditCard className="h-4 w-4" />
                      Assinar R$ 25/mês
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-content-body">Função</label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select
                        value={form.professional_role}
                        onChange={(e) => setField("professional_role", e.target.value)}
                        className="flex h-10 w-full rounded-lg border border-edge-base bg-surface-card pl-9 pr-3 py-2 text-sm text-content-body focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                      >
                        <option value="">Selecione sua função</option>
                        {professionalRoles.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-content-body">Especialidade</label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <select
                        value={form.specialty}
                        onChange={(e) => setField("specialty", e.target.value)}
                        className="flex h-10 w-full rounded-lg border border-edge-base bg-surface-card pl-9 pr-3 py-2 text-sm text-content-body focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                      >
                        <option value="">Selecione sua especialidade</option>
                        {specialtiesList.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-content-body">Registro Profissional</label>
                    <div className="relative">
                      <Award className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Ex: CRN-3 12345"
                        value={form.credentials}
                        onChange={(e) => setField("credentials", e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-content-body">Tipo de Registro</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setField("registration_type", "autonomo")}
                        className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                          form.registration_type === "autonomo"
                            ? "border-primary-600 bg-primary-50 text-primary-700"
                            : "border-edge-base bg-surface-card text-content-body hover:border-slate-300"
                        }`}
                      >
                        <User className="h-4 w-4" />
                        {t("proreg.autonomo")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setField("registration_type", "empresa")}
                        className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                          form.registration_type === "empresa"
                            ? "border-primary-600 bg-primary-50 text-primary-700"
                            : "border-edge-base bg-surface-card text-content-body hover:border-slate-300"
                        }`}
                      >
                        <Building2 className="h-4 w-4" />
                        {t("proreg.empresa")}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-content-body">
                      {form.registration_type === "empresa" ? "CNPJ" : "Documento (CRN, CREF, CRM...)"}
                    </label>
                    <div className="relative">
                      <Award className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder={form.registration_type === "empresa" ? "Ex: 12.345.678/0001-90" : "Ex: CRN-3 12345"}
                        value={form.document_number}
                        onChange={(e) => setField("document_number", e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {profile?.verified ? (
                      <p className="flex items-center gap-1 text-xs text-blue-600">
                        <ShieldCheck className="h-3 w-3" />
                        {t("proreg.verified")}
                      </p>
                    ) : (
                      <p className="flex items-center gap-1 text-xs text-amber-600">
                        <ShieldAlert className="h-3 w-3" />
                        {t("proreg.notVerified")}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-content-body">Cidade</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Ex: São Paulo, SP"
                        value={form.location_city}
                        onChange={(e) => setField("location_city", e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-content-body">Bio Profissional</label>
                    <AutoTextarea
                      minRows={3}
                      placeholder="Descreva sua experiência e abordagem profissional..."
                      value={form.bio}
                      onChange={(e) => setField("bio", e.target.value)}
                      className="flex w-full rounded-lg border border-edge-base bg-surface-card px-3 py-2 text-sm text-content-body placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-primary-50 p-3">
                    <div>
                      <p className="text-sm font-medium text-content-strong">Disponível para agendamentos</p>
                      <p className="text-xs text-content-muted">Alunos poderão encontrar e agendar com você</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={form.available_for_booking}
                      onClick={() => setField("available_for_booking", !form.available_for_booking)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        form.available_for_booking ? "bg-primary-600" : "bg-slate-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          form.available_for_booking ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
