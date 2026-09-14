import { Activity } from "lucide-react";

interface FitSyncLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  className?: string;
  textClassName?: string;
}

const sizeMap = {
  sm: { box: "h-8 w-8", icon: "h-4 w-4", text: "text-lg" },
  md: { box: "h-11 w-11", icon: "h-5 w-5", text: "text-xl" },
  lg: { box: "h-14 w-14", icon: "h-7 w-7", text: "text-2xl" },
  xl: { box: "h-20 w-20", icon: "h-10 w-10", text: "text-3xl" },
};

export function FitSyncLogo({ size = "md", animated = false, className = "", textClassName = "" }: FitSyncLogoProps) {
  const s = sizeMap[size];
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`relative flex ${s.box} items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-600/25 ${animated ? "logo-heartbeat" : ""}`}>
        <Activity className={`${s.icon} text-white`} strokeWidth={2.5} />
        {animated && (
          <span className="absolute inset-0 rounded-2xl bg-primary-500/40 logo-heartbeat-ring" />
        )}
      </div>
      <span className={`font-bold tracking-tight ${s.text} ${textClassName || "text-content-strong"}`}>
        Fit<span className="text-primary-600">Sync</span>
      </span>
    </div>
  );
}

export function FitSyncLogoMark({ size = "md", animated = false, className = "" }: FitSyncLogoProps) {
  const s = sizeMap[size];
  return (
    <div className={`relative flex ${s.box} items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-600/25 ${animated ? "logo-heartbeat" : ""} ${className}`}>
      <Activity className={`${s.icon} text-white`} strokeWidth={2.5} />
      {animated && (
        <>
          <span className="absolute inset-0 rounded-2xl bg-primary-500/40 logo-heartbeat-ring" />
          <span className="absolute inset-0 rounded-2xl bg-primary-500/20 logo-heartbeat-ring-delayed" />
        </>
      )}
    </div>
  );
}
