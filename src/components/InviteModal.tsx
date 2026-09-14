import { useState } from "react";
import { X, Mail, ShieldCheck, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { useI18n } from "../context/I18nContext";

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  hintName?: string;
  expectedUserId?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function InviteModal({ open, onClose, hintName, expectedUserId }: InviteModalProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  if (!open) return null;

  function reset() {
    setEmail("");
    setBusy(false);
    setError("");
    setSent(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const cleanEmail = email.trim().toLowerCase();
    if (!emailRegex.test(cleanEmail)) {
      setError(t("invite.validEmail"));
      return;
    }
    if (user?.email && cleanEmail === user.email.toLowerCase()) {
      setError(t("invite.selfInvite"));
      return;
    }
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setError("Sua sessão expirou. Entre novamente.");
        setBusy(false);
        return;
      }
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invite`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email: cleanEmail, expectedUserId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Não foi possível enviar o convite.");
        setBusy(false);
        return;
      }
      setSent(true);
      setBusy(false);
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50">
              <Mail className="h-4 w-4 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {t("invite.title")}
              </h2>
              <p className="text-[11px] text-slate-500">{t("invite.subtitle")}</p>
            </div>
          </div>
          <button onClick={close} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {sent ? (
            <div className="flex flex-col items-center py-4 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">{t("invite.sent")}</h3>
              <p className="mt-1.5 max-w-xs text-sm text-slate-500">
                {t("invite.sentDesc", { email: email.trim() })}
              </p>
              <Button onClick={close} className="mt-5 w-full" size="lg">
                {t("invite.done")}
              </Button>
            </div>
          ) : (
            <form onSubmit={sendInvite} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">{t("invite.email")}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    autoFocus
                    placeholder="pessoa@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100"
                  />
                </div>
              </div>

              {hintName && (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  {t("invite.useEmail", { name: hintName })}
                </p>
              )}

              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-600">{error}</div>
              )}

              <Button type="submit" className="w-full gap-2" size="lg" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("invite.sending")}
                  </>
                ) : (
                  <>
                    {t("invite.send")}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="flex items-start gap-2 rounded-lg bg-primary-50/60 px-3 py-2.5 text-[11px] text-slate-600">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
                <span>
                  {t("invite.securityNote")}
                </span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
