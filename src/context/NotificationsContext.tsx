import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import type { Notification } from "../lib/types";
import { MessageCircle, Mail, X, ShieldCheck } from "lucide-react";
import { useI18n } from "./I18nContext";

interface ToastItem {
  id: string;
  notification: Notification;
}

interface NotificationsContextValue {
  unreadCount: number;
  notifications: Notification[];
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
  acceptInvite: (id: string, code: string) => Promise<{ conversationId?: string; error?: string }>;
  removeNotification: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const seenToastIds = new Set<string>();

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastsRef = useRef<ToastItem[]>([]);

  toastsRef.current = toasts;

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setNotifications(data as Notification[]);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: new notifications appear as pop-ups instantly.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notification;
          setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
          if (!seenToastIds.has(n.id)) {
            seenToastIds.add(n.id);
            setToasts((prev) => [...prev, { id: n.id, notification: n }]);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  async function markRead(id: string) {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", user.id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  async function markAllRead() {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function removeNotification(id: string) {
    if (!user) return;
    await supabase.from("notifications").delete().eq("id", id).eq("user_id", user.id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  async function acceptInvite(id: string, code: string) {
    if (!user) return { error: "Sessão expirada." };
    const notif = notifications.find((n) => n.id === id);
    if (!notif) return { error: "Convite não encontrado." };
    if ((notif.code ?? "").trim() !== code.trim()) {
      return { error: "Código incorreto. Confira o código na notificação de convite." };
    }
    const inviteeId = user.id;
    const inviterId = notif.inviter_id;
    if (!inviterId) return { error: "Convite inválido." };

    const [userA, userB] =
      inviterId < inviteeId ? [inviterId, inviteeId] : [inviteeId, inviterId];

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_a_id", userA)
      .eq("user_b_id", userB)
      .maybeSingle();

    let conversationId = existing?.id;
    if (!conversationId) {
      const { data: created } = await supabase
        .from("conversations")
        .insert({ user_a_id: userA, user_b_id: userB })
        .select("id")
        .single();
      conversationId = created?.id;
    }
    if (!conversationId) return { error: "Erro ao criar a conversa." };

    await markRead(id);
    await removeNotification(id);
    return { conversationId };
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{ unreadCount, notifications, markRead, markAllRead, refresh, acceptInvite, removeNotification }}
    >
      {children}
      <ToastHost toasts={toasts} dismiss={dismissToast} markRead={markRead} acceptInvite={acceptInvite} navigate={navigate} />
    </NotificationsContext.Provider>
  );
}

// ── Toast host ──────────────────────────────────────────────────────────────
function ToastHost({
  toasts,
  dismiss,
  markRead,
  acceptInvite,
  navigate,
}: {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
  markRead: (id: string) => Promise<void>;
  acceptInvite: (id: string, code: string) => Promise<{ conversationId?: string; error?: string }>;
  navigate: (path: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((t) => (
        <ToastCard
          key={t.id}
          item={t}
          dismiss={() => dismiss(t.id)}
          markRead={markRead}
          acceptInvite={acceptInvite}
          navigate={navigate}
        />
      ))}
    </div>
  );
}

function ToastCard({
  item,
  dismiss,
  markRead,
  acceptInvite,
  navigate,
}: {
  item: ToastItem;
  dismiss: () => void;
  markRead: (id: string) => Promise<void>;
  acceptInvite: (id: string, code: string) => Promise<{ conversationId?: string; error?: string }>;
  navigate: (path: string) => void;
}) {
  const n = item.notification;
  const [accepting, setAccepting] = useState(false);
  const [acceptErr, setAcceptErr] = useState("");
  const { t } = useI18n();

  const icon = n.type === "invite" ? Mail : n.type === "message" ? MessageCircle : ShieldCheck;
  const Icon = icon;
  const accent =
    n.type === "invite" ? "bg-primary-600" : n.type === "message" ? "bg-emerald-600" : "bg-slate-700";

  async function handleAccept() {
    if (!n.code) return;
    setAccepting(true);
    setAcceptErr("");
    const res = await acceptInvite(n.id, n.code);
    setAccepting(false);
    if (res.error) {
      setAcceptErr(res.error);
      return;
    }
    if (res.conversationId) {
      navigate(`/messages?c=${res.conversationId}`);
    }
    dismiss();
  }

  function handleViewMessage() {
    markRead(n.id);
    if (n.conversation_id) navigate(`/messages?c=${n.conversation_id}`);
    else navigate("/messages");
    dismiss();
  }

  return (
    <div className="pointer-events-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg ring-1 ring-black/5 animate-[slidein_0.25s_ease-out]">
      <div className="flex items-start gap-3 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 leading-snug">{n.title}</p>
            <button onClick={dismiss} className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          {n.body && <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{n.body}</p>}

          {n.type === "invite" && n.code && (
            <div className="mt-2.5 rounded-lg bg-primary-50 px-3 py-2 text-center">
              <p className="text-[10px] font-medium uppercase tracking-wide text-primary-600">{t("notifications.confirmCode")}</p>
              <p className="font-mono text-lg font-bold tracking-[0.3em] text-primary-700">{n.code}</p>
            </div>
          )}

          {acceptErr && <p className="mt-2 text-xs text-red-600">{acceptErr}</p>}

          <div className="mt-3 flex gap-2">
            {n.type === "invite" && (
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="flex-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
              >
                {accepting ? "Confirmando..." : t("notifications.confirmChat")}
              </button>
            )}
            {n.type === "message" && (
              <button
                onClick={handleViewMessage}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                {t("notifications.openChat")}
              </button>
            )}
            <button
              onClick={() => {
                markRead(n.id);
                dismiss();
              }}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
            >
              {t("close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationsProvider");
  return ctx;
}
