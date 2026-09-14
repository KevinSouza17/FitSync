import { useEffect, useState } from "react";
import { Bell, Shield, Moon, Globe, Key, Check, Loader2, Eye, EyeOff, Smartphone, QrCode, Lock, Trash2, AlertTriangle, CreditCard, Crown, Calendar, ExternalLink } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useTheme } from "../context/ThemeContext";
import { useI18n, type Lang } from "../context/I18nContext";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";

interface Subscription {
  id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  past_due_since: string | null;
  locked_at: string | null;
}

interface ToggleProps {
  enabled: boolean;
  onChange: () => void;
}

function Toggle({ enabled, onChange }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? "bg-primary-600" : "bg-slate-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

const notifItems = [
  { label: "Lembretes de refeição", key: "mealReminders" },
  { label: "Alertas de hidratação", key: "waterAlerts" },
  { label: "Resumo diário", key: "dailySummary" },
  { label: "Dicas de saúde semanais", key: "weeklyTips" },
];

export function Settings() {
  const { darkMode, reducedMotion, toggleDarkMode, toggleReducedMotion } = useTheme();
  const { t, lang, setLang } = useI18n();
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const [notifToggles, setNotifToggles] = useState<Record<string, boolean>>({
    mealReminders: true,
    waterAlerts: true,
    dailySummary: true,
    weeklyTips: false,
  });
  const [activeModal, setActiveModal] = useState<"password" | "twofactor" | "delete" | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutMsg, setCheckoutMsg] = useState<"success" | "cancelled" | null>(null);
  const [subLocked, setSubLocked] = useState(false);

  const isProfessional = profile?.is_professional ?? false;

  const checkoutParam = searchParams.get("checkout");
  const subscriptionParam = searchParams.get("subscription");

  useEffect(() => {
    if (checkoutParam === "success") {
      setCheckoutMsg("success");
    } else if (checkoutParam === "cancelled") {
      setCheckoutMsg("cancelled");
    }
  }, [checkoutParam]);

  useEffect(() => {
    if (subscriptionParam === "locked") setSubLocked(true);
  }, [subscriptionParam]);

  useEffect(() => {
    if (!isProfessional || !profile?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("id, status, current_period_end, cancel_at_period_end, past_due_since, locked_at")
        .eq("user_id", profile.id)
        .maybeSingle();
      if (!cancelled && data) {
        setSubscription(data as Subscription);
        if ((data as Subscription).locked_at) setSubLocked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isProfessional, profile]);

  async function handleCheckout() {
    setCheckoutLoading(true);
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
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // ignore
    } finally {
      setCheckoutLoading(false);
    }
  }

  const langOptions: { value: Lang; label: string }[] = [
    { value: "pt", label: "Português (Brasil)" },
    { value: "en", label: "English" },
    { value: "es", label: "Español" },
  ];

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.mfa.listFactors();
        if (mounted) {
          setMfaEnabled((data?.totp ?? []).length > 0);
        }
      } catch {
        if (mounted) setMfaEnabled(false);
      } finally {
        if (mounted) setMfaLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  function toggleNotif(key: string) {
    setNotifToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-bold text-content-strong">{t("settings.title")}</h1>
        <p className="mt-0.5 text-sm text-content-muted">{t("settings.subtitle")}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Notifications */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50">
                <Bell className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-content-strong">{t("settings.notifications")}</h2>
                <p className="text-xs text-content-muted">{t("settings.notificationsSub")}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {notifItems.map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <span className="text-sm text-content-body">{item.label}</span>
                  <Toggle enabled={notifToggles[item.key]} onChange={() => toggleNotif(item.key)} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50">
                <Moon className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-content-strong">{t("settings.appearance")}</h2>
                <p className="text-xs text-content-muted">{t("settings.appearanceSub")}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-content-body">{t("settings.darkMode")}</span>
                  <p className="text-xs text-content-muted">{t("settings.darkModeSub")}</p>
                </div>
                <Toggle enabled={darkMode} onChange={toggleDarkMode} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-content-body">{t("settings.reducedMotion")}</span>
                  <p className="text-xs text-content-muted">{t("settings.reducedMotionSub")}</p>
                </div>
                <Toggle enabled={reducedMotion} onChange={toggleReducedMotion} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50">
                <Shield className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-content-strong">{t("settings.security")}</h2>
                <p className="text-xs text-content-muted">{t("settings.securitySub")}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Button variant="outline" className="justify-start gap-2" onClick={() => setActiveModal("password")}>
                <Key className="h-4 w-4" />
                {t("settings.changePassword")}
              </Button>
              <Button variant="outline" className="justify-start gap-2" onClick={() => setActiveModal("twofactor")}>
                <Smartphone className="h-4 w-4" />
                {t("settings.twoFactor")}
                {!mfaLoading && (
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                    mfaEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    {mfaEnabled ? "Ativada" : "Desativada"}
                  </span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50">
                <Globe className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-content-strong">{t("settings.language")}</h2>
                <p className="text-xs text-content-muted">{t("settings.languageSub")}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-medium text-content-body">{t("settings.languageLabel")}</label>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as Lang)}
                  className="mt-1 w-full rounded-lg border border-edge-base bg-surface-card px-3 py-2 text-sm text-content-body focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                >
                  {langOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-content-body">{t("settings.weightUnit")}</label>
                <select className="mt-1 w-full rounded-lg border border-edge-base bg-surface-card px-3 py-2 text-sm text-content-body focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100">
                  <option>Quilogramas (kg)</option>
                  <option>Libras (lb)</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Professional billing */}
      {isProfessional && (
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                <Crown className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-content-strong">Assinatura Profissional</h2>
                <p className="text-xs text-content-muted">Plano PRO · R$ 25/mês</p>
              </div>
            </div>

            {checkoutMsg === "success" && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                Assinatura ativada! Seus 7 dias de teste começaram.
              </div>
            )}
            {checkoutMsg === "cancelled" && (
              <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                Checkout cancelado. Você pode tentar novamente a qualquer momento.
              </div>
            )}

            {subLocked && (
              <div className="mb-4 space-y-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                <p className="flex items-center gap-2 font-semibold">
                  <Lock className="h-4 w-4" />
                  Assinatura bloqueada
                </p>
                <p>O pagamento da sua assinatura está em atraso e o período de tolerância terminou. Suas funcionalidades profissionais estão bloqueadas até que o pagamento seja regularizado.</p>
                <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleCheckout} disabled={checkoutLoading}>
                  {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  {checkoutLoading ? "Redirecionando..." : "Regularizar pagamento"}
                </Button>
              </div>
            )}

            {subscription && (subscription.status === "active" || subscription.status === "trialing") ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-900/20">
                  <Check className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      {subscription.status === "trialing" ? "Período de teste ativo" : "Assinatura ativa"}
                    </p>
                    {subscription.current_period_end && (
                      <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500">
                        <Calendar className="h-3 w-3" />
                        {subscription.cancel_at_period_end ? "Cancela em" : "Renova em"}{" "}
                        {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                </div>
                <Button variant="outline" className="gap-2" disabled>
                  <CreditCard className="h-4 w-4" />
                  Gerenciar no Stripe
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl bg-surface-subtle p-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-content-strong">R$ 25</span>
                    <span className="text-sm text-content-muted">/mês</span>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm text-content-body">
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> Clientes ilimitados</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> Planos alimentares e de treino</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> Agendamento de consultas</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> 7 dias grátis · Cancele quando quiser</li>
                  </ul>
                </div>
                <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handleCheckout} disabled={checkoutLoading}>
                  {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  {checkoutLoading ? "Redirecionando..." : "Assinar agora"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      <Card className="border-red-200">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-content-strong">Zona de Perigo</h2>
              <p className="text-xs text-content-muted">Ações irreversíveis</p>
            </div>
          </div>
          <Button variant="outline" className="justify-start gap-2 text-red-600 hover:bg-red-50" onClick={() => setActiveModal("delete")}>
            <Trash2 className="h-4 w-4" />
            Excluir minha conta
          </Button>
        </CardContent>
      </Card>

      {activeModal === "password" && (
        <PasswordModal onClose={() => setActiveModal(null)} />
      )}
      {activeModal === "twofactor" && (
        <TwoFactorModal
          enabled={mfaEnabled}
          onStatusChange={setMfaEnabled}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === "delete" && (
        <DeleteAccountModal onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (confirmText !== "EXCLUIR") return;
    setDeleting(true);
    setError("");
    try {
      const { data: result, error: rpcError } = await supabase.rpc("delete_account");
      if (rpcError) throw rpcError;
      if (result && result !== "OK") {
        throw new Error(result);
      }
      await signOut();
      navigate("/login");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao excluir conta. Tente novamente.";
      setError(msg.startsWith("Erro") ? msg : "Erro ao excluir conta. Tente novamente.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface-card p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Excluir conta
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="text-xl">x</span>
          </button>
        </div>
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Esta ação é permanente e não pode ser desfeita.</p>
          <p className="mt-1">Todos os seus dados serão apagados: postagens, comentários, treinos, dieta, mensagens, e seu perfil.</p>
        </div>
        <div className="mt-4 space-y-2">
          <p className="text-sm text-content-body">Digite <strong>EXCLUIR</strong> para confirmar:</p>
          <Input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="EXCLUIR"
            autoFocus
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="mt-5 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={deleting}>Cancelar</Button>
          <Button className="flex-1 gap-2 bg-red-600 hover:bg-red-700" onClick={handleDelete} disabled={deleting || confirmText !== "EXCLUIR"}>
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {deleting ? "Excluindo..." : "Excluir conta"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleChangePassword() {
    setError("");

    if (newPassword.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);

    if (err) {
      setError("Erro ao alterar senha. Tente novamente.");
      return;
    }

    setSuccess(true);
    setTimeout(() => onClose(), 1800);
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-surface-card p-6 text-center shadow-xl">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-content-strong">Senha alterada!</h2>
          <p className="mt-1 text-sm text-content-muted">Sua senha foi atualizada com sucesso</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface-card p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-content-strong">Alterar Senha</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="text-xl">x</span>
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-content-body">Nova senha</label>
            <div className="relative">
              <Input
                type={showPasswords ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoFocus
              />
              <button
                onClick={() => setShowPasswords(!showPasswords)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-content-body">Confirmar nova senha</label>
            <Input
              type={showPasswords ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="mt-5 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleChangePassword}
            disabled={saving || !newPassword || !confirmPassword}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
            {saving ? "Alterando..." : "Alterar Senha"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TwoFactorModal({
  enabled,
  onStatusChange,
  onClose,
}: {
  enabled: boolean;
  onStatusChange: (v: boolean) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"intro" | "qr" | "code" | "done">("intro");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unenrollConfirm, setUnenrollConfirm] = useState(false);

  async function handleEnroll() {
    setError("");
    setLoading(true);
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "FitSync",
        friendlyName: "FitSync",
      });
      if (enrollError) throw enrollError;
      if (data?.totp) {
        setFactorId(data.totp.id);
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setStep("qr");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao ativar verificação");
    } finally {
      setLoading(false);
    }
  }

  async function handleChallenge() {
    setError("");
    setLoading(true);
    try {
      const { data, error: chError } = await supabase.auth.mfa.challenge({ factorId });
      if (chError) throw chError;
      setChallengeId(data!.id);
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar código");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setError("");
    setLoading(true);
    try {
      const { error: vError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });
      if (vError) throw vError;
      setStep("done");
      onStatusChange(true);
      setTimeout(() => onClose(), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Código inválido");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnenroll() {
    setError("");
    setLoading(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = (factors?.totp ?? [])[0];
      if (!totp) throw new Error("Nenhum fator encontrado");
      const { error: uError } = await supabase.auth.mfa.unenroll({ factorId: totp.id });
      if (uError) throw uError;
      onStatusChange(false);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao desativar");
    } finally {
      setLoading(false);
    }
  }

  if (enabled && step === "intro") {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-surface-card p-6 shadow-xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-content-strong">
              <Shield className="h-5 w-5 text-emerald-600" />
              Verificação em duas etapas
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <span className="text-xl">x</span>
            </button>
          </div>
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <Check className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="text-sm text-content-body">
              A verificação em duas etapas está <strong>ativada</strong>. Sua conta está protegida com um código adicional do app autenticador.
            </p>
          </div>
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
          {!unenrollConfirm ? (
            <div className="mt-5 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose}>Fechar</Button>
              <Button variant="outline" className="flex-1 gap-2 text-red-600 hover:bg-red-50" onClick={() => setUnenrollConfirm(true)}>
                <Trash2 className="h-4 w-4" />
                Desativar
              </Button>
            </div>
          ) : (
            <div className="mt-5">
              <p className="mb-3 text-sm text-content-muted">Tem certeza? Sua conta ficará menos protegida.</p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setUnenrollConfirm(false)}>Cancelar</Button>
                <Button className="flex-1 gap-2" onClick={handleUnenroll} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Confirmar
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-surface-card p-6 text-center shadow-xl">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-content-strong">Verificação ativada!</h2>
          <p className="mt-1 text-sm text-content-muted">Sua conta agora está mais protegida</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface-card p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-content-strong">
            <Lock className="h-5 w-5 text-primary-600" />
            Verificação em duas etapas
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span className="text-xl">x</span>
          </button>
        </div>

        {step === "intro" && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
              <Smartphone className="h-7 w-7 text-primary-600" />
            </div>
            <p className="text-sm text-content-body">
              Proteja sua conta com uma camada extra de segurança. Use um app autenticador (Google Authenticator, Authy, 1Password) para gerar códigos de verificação.
            </p>
            <Button className="mt-2 w-full gap-2" onClick={handleEnroll} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              Ativar verificação
            </Button>
          </div>
        )}

        {step === "qr" && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="text-sm text-content-body">Escaneie o QR code com seu app autenticador:</p>
            {qrCode && (
              <img src={qrCode} alt="QR Code" className="h-44 w-44 rounded-lg border border-edge-base bg-white p-2" />
            )}
            <div className="w-full">
              <p className="text-xs text-content-muted">Ou digite manualmente:</p>
              <code className="mt-1 block w-full break-all rounded-lg bg-surface-subtle px-3 py-2 text-xs text-content-body">{secret}</code>
            </div>
            <Button className="mt-2 w-full" onClick={handleChallenge} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Já escaneiei"}
            </Button>
          </div>
        )}

        {step === "code" && (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-sm text-content-body">Digite o código de 6 dígitos do seu app autenticador:</p>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="text-center text-lg tracking-[0.3em]"
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button className="w-full" onClick={handleVerify} disabled={loading || code.length !== 6}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar e ativar"}
            </Button>
          </div>
        )}

        {error && step === "intro" && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}
