import { FitSyncLogoMark } from "./FitSyncLogo";

interface PageLoaderProps {
  label?: string;
  fullScreen?: boolean;
}

export function PageLoader({ label = "Carregando...", fullScreen = true }: PageLoaderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-5 ${fullScreen ? "h-screen-ios bg-surface-base" : "h-full"}`}
      role="status"
      aria-live="polite"
    >
      <FitSyncLogoMark size="xl" animated />
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-bounce-dot [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-bounce-dot [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-primary-500 animate-bounce-dot" />
      </div>
      <p className="text-sm font-medium text-content-muted">{label}</p>
    </div>
  );
}

export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-slate-50 via-white to-primary-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-primary-900/10">
      <div className="splash-rise">
        <FitSyncLogoMark size="xl" animated />
      </div>
      <div className="splash-rise [animation-delay:200ms]">
        <span className="text-2xl font-bold tracking-tight text-content-strong">
          Fit<span className="text-primary-600">Sync</span>
        </span>
      </div>
      <div className="splash-rise [animation-delay:400ms] flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-primary-500 animate-bounce-dot [animation-delay:-0.3s]" />
        <span className="h-2 w-2 rounded-full bg-primary-500 animate-bounce-dot [animation-delay:-0.15s]" />
        <span className="h-2 w-2 rounded-full bg-primary-500 animate-bounce-dot" />
      </div>
    </div>
  );
}
