import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, User, Briefcase, GraduationCap, Award, MapPin, Building2, AtSign, Activity, Check } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { FitSyncLogo } from "../components/FitSyncLogo";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { useI18n } from "../context/I18nContext";

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

const specialties = [
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

export function Register() {
  const [accountType, setAccountType] = useState<"user" | "professional">("user");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleError, setHandleError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [proRole, setProRole] = useState("");
  const [proSpecialty, setProSpecialty] = useState("");
  const [proCredentials, setProCredentials] = useState("");
  const [proCity, setProCity] = useState("");
  const [regType, setRegType] = useState<"autonomo" | "empresa">("autonomo");
  const [docNumber, setDocNumber] = useState("");
  const [docError, setDocError] = useState("");

  const { signUp } = useAuth();
  const { t } = useI18n();
  const [registrationDone, setRegistrationDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("register.passwordMismatch"));
      return;
    }
    if (!acceptedTerms) {
      setError("Você precisa aceitar os Termos de Uso e a Política de Privacidade para criar uma conta.");
      return;
    }
    if (password.length < 6) {
      setError(t("register.passwordShort"));
      return;
    }
    if (accountType === "professional" && (!proRole || !proSpecialty)) {
      setError(t("register.fillFields"));
      return;
    }
    if (accountType === "professional" && !docNumber.trim()) {
      setError(t("proreg.documentRequired"));
      return;
    }
    if (accountType === "professional" && regType === "empresa") {
      const digits = docNumber.replace(/\D/g, "");
      if (digits.length !== 14) {
        setError(t("proreg.invalidCnpj"));
        return;
      }
    }
    const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (cleanHandle && cleanHandle.length < 3) {
      setError("O @ deve ter pelo menos 3 caracteres (apenas letras, números e _).");
      return;
    }
    if (cleanHandle) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .ilike("handle", cleanHandle)
        .maybeSingle();
      if (existing) {
        setError("Este @ já está em uso. Escolha outro.");
        return;
      }
    }
    setLoading(true);
    const proData = accountType === "professional"
      ? { role: proRole, specialty: proSpecialty, credentials: proCredentials, registrationType: regType, documentNumber: docNumber.trim(), city: proCity.trim() }
      : undefined;
    const { error } = await signUp(email, password, fullName, proData, cleanHandle || undefined);
    if (error) {
      if (error.includes("already registered") || error.includes("already been registered")) {
        setError(t("register.emailExists"));
      } else {
        setError("Erro ao criar conta. Tente novamente.");
      }
    } else {
      setRegistrationDone(true);
    }
    setLoading(false);
  }

  const isPro = accountType === "professional";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-primary-50/40 px-4 py-12 dark:from-slate-950 dark:via-slate-900 dark:to-primary-900/10 sm:px-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <FitSyncLogo size="md" />
        </div>

          <div className="mb-7">
            <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${
              isPro ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-primary-50 dark:bg-primary-900/20"
            }`}>
              <Activity className={`h-6 w-6 ${isPro ? "text-emerald-600" : "text-primary-600"}`} />
            </div>
            <h1 className="text-2xl font-bold text-content-strong">Criar uma conta</h1>
            <p className="mt-1.5 text-sm text-content-muted">Comece sua jornada de saúde hoje mesmo</p>
          </div>

          {/* Account type toggle */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAccountType("user")}
              className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all duration-200 ${
                accountType === "user"
                  ? "border-primary-600 bg-primary-50 shadow-md shadow-primary-600/10 dark:bg-primary-900/20"
                  : "border-edge-base bg-surface-card hover:border-slate-300"
              }`}
            >
              {accountType === "user" && (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
              )}
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                accountType === "user" ? "bg-primary-600 text-white" : "bg-slate-100 text-content-muted dark:bg-slate-800"
              }`}>
                <User className="h-5 w-5" />
              </div>
              <div className="text-center">
                <p className={`text-sm font-semibold ${accountType === "user" ? "text-primary-700" : "text-content-body"}`}>
                  Aluno
                </p>
                <p className="text-[11px] text-content-muted">Acompanhar saúde</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setAccountType("professional")}
              className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all duration-200 ${
                accountType === "professional"
                  ? "border-emerald-600 bg-emerald-50 shadow-md shadow-emerald-600/10 dark:bg-emerald-900/20"
                  : "border-edge-base bg-surface-card hover:border-slate-300"
              }`}
            >
              {accountType === "professional" && (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
              )}
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                PRO
              </span>
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                accountType === "professional" ? "bg-emerald-600 text-white" : "bg-slate-100 text-content-muted dark:bg-slate-800"
              }`}>
                <Briefcase className="h-5 w-5" />
              </div>
              <div className="text-center">
                <p className={`text-sm font-semibold ${accountType === "professional" ? "text-emerald-700" : "text-content-body"}`}>
                  Profissional
                </p>
                <p className="text-[11px] text-content-muted">R$ 25/mês</p>
              </div>
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Common fields */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-content-body">Nome completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                <Input
                  type="text"
                  placeholder="João Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-content-body">@ (usuário)</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                <Input
                  type="text"
                  placeholder="seunome"
                  value={handle}
                  onChange={async (e) => {
                    const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                    setHandle(v);
                    setHandleError("");
                    if (v.length >= 3) {
                      const { data: existing } = await supabase
                        .from("profiles").select("id").ilike("handle", v).maybeSingle();
                      if (existing) setHandleError("Este @ já está em uso.");
                    }
                  }}
                  className="pl-9"
                  maxLength={20}
                />
              </div>
              {handleError
                ? <p className="text-xs text-red-500">{handleError}</p>
                : <p className="text-xs text-content-muted">Apenas letras, números e _. Seu link: /@seunome</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-content-body">{t("register.email")}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-content-body">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Mín. 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-9"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted transition-colors hover:text-content-body"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-content-body">Confirmar</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                  <Input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repita a senha"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-9 pr-9"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted transition-colors hover:text-content-body"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Professional fields */}
            {accountType === "professional" && (
              <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-900/10">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-400">
                  <Briefcase className="h-4 w-4" />
                  Informações Profissionais
                </h3>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-content-body">Função *</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                    <select
                      value={proRole}
                      onChange={(e) => setProRole(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-edge-base bg-surface-card pl-9 pr-3 py-2 text-sm text-content-strong focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      required
                    >
                      <option value="">Selecione sua função</option>
                      {professionalRoles.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-content-body">Especialidade *</label>
                  <div className="relative">
                    <GraduationCap className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                    <select
                      value={proSpecialty}
                      onChange={(e) => setProSpecialty(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-edge-base bg-surface-card pl-9 pr-3 py-2 text-sm text-content-strong focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      required
                    >
                      <option value="">Selecione sua especialidade</option>
                      {specialties.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Registration type toggle */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-content-body">Tipo de Registro *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setRegType("autonomo"); setDocNumber(""); setDocError(""); }}
                      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                        regType === "autonomo"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20"
                          : "border-edge-base bg-surface-card text-content-body hover:border-slate-300"
                      }`}
                    >
                      <User className="h-4 w-4" />
                      Autônomo
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRegType("empresa"); setDocNumber(""); setDocError(""); }}
                      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                        regType === "empresa"
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20"
                          : "border-edge-base bg-surface-card text-content-body hover:border-slate-300"
                      }`}
                    >
                      <Building2 className="h-4 w-4" />
                      Empresa
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-content-body">
                    {regType === "empresa" ? "CNPJ *" : "Registro Profissional (CRN, CREF, CRM...) *"}
                  </label>
                  <div className="relative">
                    <Award className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                    <Input
                      placeholder={regType === "empresa" ? "Ex: 12.345.678/0001-90" : "Ex: CRN-3 12345"}
                      value={docNumber}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDocNumber(v);
                        if (regType === "empresa") {
                          const digits = v.replace(/\D/g, "");
                          setDocError(digits.length === 14 || digits.length === 0 ? "" : t("proreg.invalidCnpj"));
                        } else {
                          setDocError(v.trim().length < 3 ? t("proreg.invalidDoc") : "");
                        }
                      }}
                      className="pl-9"
                      required
                    />
                  </div>
                  {docError && <p className="text-xs text-red-500">{docError}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-content-body">Cidade</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                    <Input
                      placeholder="Ex: São Paulo, SP"
                      value={proCity}
                      onChange={(e) => setProCity(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Terms checkbox */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-edge-base p-4 transition-colors hover:bg-surface-subtle">
              <button
                type="button"
                role="checkbox"
                aria-checked={acceptedTerms}
                onClick={() => setAcceptedTerms(!acceptedTerms)}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                  acceptedTerms ? "border-primary-600 bg-primary-600" : "border-slate-300"
                }`}
              >
                {acceptedTerms && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </button>
              <span className="text-xs text-content-body">
                Li e aceito os <Link to="/terms" className="font-semibold text-primary-600 hover:text-primary-700">Termos de Uso</Link> e a <Link to="/terms" className="font-semibold text-primary-600 hover:text-primary-700">Política de Privacidade</Link>
              </span>
            </label>

            <Button
              type="submit"
              className={`w-full transition-all ${isPro ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Criando conta...
                </span>
              ) : isPro ? "Criar Conta Profissional" : "Criar Conta"}
            </Button>

            {isPro && (
              <p className="text-center text-xs text-content-muted">
                Ao criar conta profissional, você concorda com a cobrança mensal de R$ 25 após o período de teste de 7 dias.
              </p>
            )}
          </form>

          <p className="mt-8 text-center text-sm text-content-muted">
            Já tem uma conta?{" "}
            <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700">
              Entrar
            </Link>
          </p>
        </div>
    </div>
  );
}
