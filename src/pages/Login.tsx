import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle, Activity } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { FitSyncLogo } from "../components/FitSyncLogo";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { supabase } from "../lib/supabase";

export function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const { signIn } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError(t("login.invalidCredentials"));
    } else {
      navigate("/dashboard");
    }
    setLoading(false);
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      forgotEmail.trim(),
      { redirectTo: `${window.location.origin}/reset-password` },
    );
    setForgotLoading(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setForgotSent(true);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col justify-center bg-gradient-to-br from-slate-50 via-white to-primary-50/40 px-4 py-12 dark:from-slate-950 dark:via-slate-900 dark:to-primary-900/10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <FitSyncLogo size="md" />
          </div>

          <div className="mb-8">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-900/20">
              <Activity className="h-6 w-6 text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold text-content-strong">{t("login.title")}</h1>
            <p className="mt-1.5 text-sm text-content-muted">{t("login.subtitle")}</p>
          </div>

          <div className="rounded-2xl border border-edge-base/60 bg-surface-card/95 p-6 shadow-xl shadow-primary-900/5 backdrop-blur-sm sm:p-8">
            {error && !forgotOpen && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-content-body">{t("login.email")}</label>
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

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-content-body">{t("login.password")}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
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

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Entrando...
                  </span>
                ) : t("login.signIn")}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => { setForgotOpen(true); setForgotEmail(email); setError(""); }}
              className="mt-5 w-full text-center text-sm text-primary-600 transition-colors hover:text-primary-700"
            >
              Esqueceu sua senha?
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-content-muted">
            {t("login.noAccount")}{" "}
            <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700">
              {t("login.signUp")}
            </Link>
          </p>
        </div>
      </div>

      {/* Forgot password modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => { if (!forgotLoading) setForgotOpen(false); }}>
          <div className="w-full max-w-sm rounded-2xl border border-edge-base/60 bg-surface-card p-6 shadow-2xl sm:p-8" onClick={(e) => e.stopPropagation()}>
            {forgotSent ? (
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 dark:bg-green-900/20">
                  <CheckCircle className="h-7 w-7 text-green-500" />
                </div>
                <h2 className="text-lg font-bold text-content-strong">E-mail enviado!</h2>
                <p className="mt-2 text-sm text-content-muted">
                  Verifique seu e-mail <span className="font-semibold text-content-body">{forgotEmail}</span> para redefinir sua senha.
                </p>
                <Button className="mt-6 w-full" onClick={() => { setForgotOpen(false); setForgotSent(false); setForgotEmail(""); setError(""); }}>
                  Entendi
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-5 flex items-center gap-3">
                  <button onClick={() => { if (!forgotLoading) setForgotOpen(false); setError(""); }} className="text-content-muted transition-colors hover:text-content-body">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h2 className="text-lg font-bold text-content-strong">Recuperar senha</h2>
                </div>
                <p className="mb-4 text-sm text-content-muted">
                  Digite seu e-mail e enviaremos um link para redefinir sua senha.
                </p>
                {error && (
                  <div className="mb-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:bg-red-900/20">{error}</div>
                )}
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-content-body">{t("login.email")}</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="pl-9"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={forgotLoading}>
                    {forgotLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Enviando...
                      </span>
                    ) : "Enviar link de recuperação"}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
