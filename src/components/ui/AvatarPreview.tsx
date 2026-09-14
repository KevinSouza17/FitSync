import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, UserCircle } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";

interface AvatarPreviewProps {
  src?: string | null;
  name: string;
  userId?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  fallbackClassName?: string;
  ring?: boolean;
}

const sizeMap = {
  xs: "h-7 w-7",
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-20 w-20",
};

const fallbackTextMap = {
  xs: "text-[10px]",
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
};

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function AvatarPreview({ src, name, userId, size = "sm", className = "", fallbackClassName = "", ring = false }: AvatarPreviewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const navigate = useNavigate();

  const avatar = (
    <Avatar className={`${sizeMap[size]} ${ring ? "ring-4 ring-white shadow-lg" : ""} ${className}`}>
      {src ? (
        <AvatarImage src={src} alt={name} />
      ) : (
        <AvatarFallback className={`bg-primary-50 ${fallbackTextMap[size]} font-bold text-primary-600 ${fallbackClassName}`}>
          {initials(name)}
        </AvatarFallback>
      )}
    </Avatar>
  );

  return (
    <>
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="block rounded-full transition-transform hover:scale-105 active:scale-95"
          title="Ver foto"
        >
          {avatar}
        </button>
        {userId && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`/profile/${userId}`); }}
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface-card bg-primary-600 text-white shadow-sm transition-colors hover:bg-primary-700"
            title="Ver perfil"
          >
            <UserCircle className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="absolute right-4 top-4 flex items-center gap-2">
            {userId && (
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); navigate(`/profile/${userId}`); }}
                className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                Ver perfil
              </button>
            )}
            <button className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20">
              <X className="h-6 w-6" />
            </button>
          </div>
          {src ? (
            <img
              src={src}
              alt={name}
              className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
              <Avatar className="h-32 w-32">
                <AvatarFallback className="bg-primary-50 text-5xl font-bold text-primary-600">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <p className="text-lg font-semibold text-white">{name}</p>
            </div>
          )}
          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm font-medium text-white/80">
            {name}
          </p>
        </div>
      )}
    </>
  );
}
