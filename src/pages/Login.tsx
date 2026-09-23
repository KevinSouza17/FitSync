import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, Eye, EyeOff, Lock, Mail } from "lucide-react";
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
    const { error: signInError } = await signIn(email.trim(), password);
    if (signInError) setError(t("login.invalidCredentials"));
    else navigate("/dashboard");
    setLoading(false);
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (resetError) setError(resetError.message);
    else setForgotSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-base px-4 py-8 sm:px-6">
      <div className="w-full max-w-[420px]">
        <header className="mb-9 text-center">
          <div className="mb-8 flex justify-center"><FitSyncLogo size="md" /></div>
          <h1 className="text-2xl font-semibold tracking-tight text-content-strong">{t("login.title")}</h1>
          <p className="mt-2 text-sm text-content-muted">{t("login.subtitle")}</p>
        </header>

        <section className="rounded-2xl border border-edge-base bg-surface-card p-6 shadow-sm sm:p-8">
          {error && !forgotOpen && (
            <div role="alert" className="mb-5 rounded-lg bg-red-50 px-3.5 py-3 text-sm text-red-600 dark:bg-red-900/20">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-sm font-medium text-content-body">{t("login.email")}</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                <Input id="login-email" type="email" autoComplete="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-sm font-medium text-content-body">{t("login.password")}</label>
                <button type="button" onClick={() => { setForgotOpen(true); setForgotEmail(email); setError(""); }} className="text-xs font-medium text-primary-600 hover:text-primary-700">Esqueceu a senha?</button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                <Input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9 pr-10" required />
                <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-body">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Entrando..." : t("login.signIn")}
            </Button>
          </form>
        </section>

        <p className="mt-6 text-center text-sm text-content-muted">
          {t("login.noAccount")} <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700">{t("login.signUp")}</Link>
        </p>
      </div>

      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => { if (!forgotLoading) setForgotOpen(false); }}>
          <div className="w-full max-w-sm rounded-2xl border border-edge-base bg-surface-card p-6 shadow-xl sm:p-7" onClick={(e) => e.stopPropagation()}>
            {forgotSent ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 dark:bg-green-900/20"><CheckCircle className="h-6 w-6 text-green-600" /></div>
                <h2 className="text-lg font-semibold text-content-strong">E-mail enviado</h2>
                <p className="mt-2 text-sm leading-6 text-content-muted">Verifique <span className="font-medium text-content-body">{forgotEmail}</span> para redefinir sua senha.</p>
                <Button className="mt-6 w-full" onClick={() => { setForgotOpen(false); setForgotSent(false); setForgotEmail(""); setError(""); }}>Entendi</Button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center gap-3"><button type="button" onClick={() => { if (!forgotLoading) setForgotOpen(false); setError(""); }} className="text-content-muted hover:text-content-body"><ArrowLeft className="h-5 w-5" /></button><h2 className="text-lg font-semibold text-content-strong">Recuperar senha</h2></div>
                <p className="mb-4 text-sm leading-6 text-content-muted">Digite seu e-mail e enviaremos um link para redefinir sua senha.</p>
                {error && <div role="alert" className="mb-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-600 dark:bg-red-900/20">{error}</div>}
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" /><Input type="email" autoComplete="email" placeholder="seu@email.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="pl-9" required /></div>
                  <Button type="submit" className="w-full" size="lg" disabled={forgotLoading}>{forgotLoading ? "Enviando..." : "Enviar link de recuperação"}</Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
