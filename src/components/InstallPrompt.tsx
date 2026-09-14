import { useEffect, useState } from "react";
import { Download, X, Smartphone, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const SHOW_DELAY_MS = 4000;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.navigator as unknown as { standalone?: boolean }).standalone;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const daysSince = (Date.now() - dismissed) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) return;

    if (isIOS()) {
      setIos(true);
      window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      return;
    }

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    setInstalling(true);
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
    setInstalling(false);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] flex items-end justify-center bg-black/30 p-4 backdrop-blur-sm sm:items-center">
      <div className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="relative bg-gradient-to-br from-primary-600 to-primary-800 px-6 py-7 text-center text-white">
          <button onClick={handleDismiss} className="absolute right-3 top-3 rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Smartphone className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold">Adicionar à tela inicial</h2>
          <p className="mt-1 text-sm text-primary-100">
            Instale o FitSync para acesso rápido e notificações em tempo real.
          </p>
        </div>
        <div className="space-y-3 px-6 py-5">
          {ios ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                  <Share className="h-4 w-4 text-primary-600" />
                </div>
                <p className="text-sm text-slate-600">
                  Toque no botão <strong>Compartilhar</strong> na barra inferior do Safari.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                  <Download className="h-4 w-4 text-primary-600" />
                </div>
                <p className="text-sm text-slate-600">
                  Role e toque em <strong>Adicionar à Tela de Início</strong>.
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
              >
                Entendi
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                  <Download className="h-4 w-4 text-primary-600" />
                </div>
                <p className="text-sm text-slate-600">
                  Funciona como um app, sem precisar abrir o navegador toda vez.
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="flex-1 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                >
                  {installing ? "Instalando..." : "Adicionar agora"}
                </button>
                <button
                  onClick={handleDismiss}
                  className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
                >
                  Agora não
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
