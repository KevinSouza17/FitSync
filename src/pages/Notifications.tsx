import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Mail,
  MessageCircle,
  ShieldCheck,
  CheckCheck,
  Trash2,
  ArrowRight,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";
import { useNotifications } from "../context/NotificationsContext";
import { Button } from "../components/ui/button";
import { useI18n } from "../context/I18nContext";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function Notifications() {
  const { notifications, unreadCount, markRead, markAllRead, acceptInvite, removeNotification } = useNotifications();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptErr, setAcceptErr] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "invite" | "message">("all");

  async function handleAccept(id: string, code: string) {
    setAcceptingId(id);
    setAcceptErr((prev) => ({ ...prev, [id]: "" }));
    const res = await acceptInvite(id, code);
    setAcceptingId(null);
    if (res.error) {
      setAcceptErr((prev) => ({ ...prev, [id]: res.error! }));
      return;
    }
    if (res.conversationId) navigate(`/messages?c=${res.conversationId}`);
  }

  function handleOpenMessage(id: string, conversationId: string | null) {
    markRead(id);
    if (conversationId) navigate(`/messages?c=${conversationId}`);
    else navigate("/messages");
  }

  const filtered = notifications.filter((n) => filter === "all" || n.type === filter);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("notifications.title")}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {unreadCount > 0 ? t("notifications.unread", { count: unreadCount, plural: unreadCount > 1 ? "s" : "" }) : t("notifications.allRead")}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" />
            {t("notifications.markAll")}
          </Button>
        )}
      </header>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {([
          { key: "all", label: t("notifications.all") },
          { key: "invite", label: t("notifications.invites") },
          { key: "message", label: t("notifications.messages") },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              filter === tab.key ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <Bell className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="text-base font-semibold text-slate-700">{t("notifications.none")}</h3>
          <p className="mt-1 max-w-xs text-sm text-slate-400">
            {t("notifications.noneSub")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((n) => {
            const Icon = n.type === "invite" ? Mail : n.type === "message" ? MessageCircle : ShieldCheck;
            const accent =
              n.type === "invite" ? "bg-primary-100 text-primary-700" : n.type === "message" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600";

            return (
              <div
                key={n.id}
                className={`rounded-2xl border bg-white p-4 transition-shadow hover:shadow-sm ${
                  n.read ? "border-slate-200" : "border-primary-200 ring-1 ring-primary-100"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 leading-snug">{n.title}</p>
                        {n.body && <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{n.body}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary-500" />}
                        <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(n.created_at)}</span>
                      </div>
                    </div>

                    {/* Invite code block */}
                    {n.type === "invite" && n.code && (
                      <div className="mt-3 rounded-lg bg-primary-50 px-3 py-2 text-center">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-primary-600">
                          {t("notifications.confirmCode")}
                        </p>
                        <p className="font-mono text-lg font-bold tracking-[0.3em] text-primary-700">{n.code}</p>
                      </div>
                    )}

                    {acceptErr[n.id] && (
                      <p className="mt-2 text-xs text-red-600">{acceptErr[n.id]}</p>
                    )}

                    {/* Actions */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {n.type === "invite" && !n.read && n.code && (
                        <button
                          onClick={() => handleAccept(n.id, n.code)}
                          disabled={acceptingId === n.id}
                          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                        >
                          {acceptingId === n.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          {t("notifications.confirmChat")}
                        </button>
                      )}
                      {n.type === "message" && (
                        <button
                          onClick={() => handleOpenMessage(n.id, n.conversation_id)}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                          {t("notifications.openChat")}
                        </button>
                      )}
                      {!n.read && n.type !== "invite" && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
                        >
                          {t("notifications.markRead")}
                        </button>
                      )}
                      <button
                        onClick={() => removeNotification(n.id)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("notifications.delete")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
