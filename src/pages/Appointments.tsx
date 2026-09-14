import { useEffect, useState, useCallback } from "react";
import {
  Calendar,
  Clock,
  Check,
  X,
  CalendarCheck,
  CalendarX,
  Plus,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { AutoTextarea } from "../components/ui/textarea";

type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled";

interface Appointment {
  id: string;
  user_id: string;
  professional_id: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  created_at: string;
}

interface EnrichedAppointment extends Appointment {
  otherName: string;
  otherAvatar: string | null;
  otherRole: string | null;
  otherIsPro: boolean;
}

interface Contact {
  id: string;
  full_name: string;
  avatar_url: string | null;
  is_professional: boolean;
  professional_role: string | null;
}

const statusConfig: Record<
  AppointmentStatus,
  { badge: string; dot: string; label: string }
> = {
  pending: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    dot: "bg-amber-500",
    label: "appointments.statusPending",
  },
  confirmed: {
    badge: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
    dot: "bg-green-500",
    label: "appointments.statusConfirmed",
  },
  completed: {
    badge: "bg-slate-200 text-slate-700 dark:bg-slate-500/25 dark:text-slate-300",
    dot: "bg-slate-500",
    label: "appointments.statusCompleted",
  },
  cancelled: {
    badge: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
    dot: "bg-red-500",
    label: "appointments.statusCancelled",
  },
};

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function fmtTime(t: string) {
  return t.slice(0, 5);
}

function isPast(apt: Appointment) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(apt.appointment_date + "T00:00:00") < today;
}

export function Appointments() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const [appointments, setAppointments] = useState<EnrichedAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [roleView, setRoleView] = useState<"pro" | "client">("pro");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showBookModal, setShowBookModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [bookForm, setBookForm] = useState({
    otherId: "",
    date: "",
    time: "09:00",
    duration: "60",
    notes: "",
  });
  const [bookingSaving, setBookingSaving] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const isProfessional = !!profile?.is_professional;

  const loadAppointments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .or(`user_id.eq.${user.id},professional_id.eq.${user.id}`)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    if (!data) {
      setLoading(false);
      return;
    }

    const enriched: EnrichedAppointment[] = await Promise.all(
      (data as Appointment[]).map(async (apt) => {
        const otherId =
          apt.user_id === user.id ? apt.professional_id : apt.user_id;
        const { data: p } = await supabase
          .from("profiles")
          .select(
            "full_name, avatar_url, professional_role, is_professional"
          )
          .eq("id", otherId)
          .maybeSingle();
        return {
          ...apt,
          otherName: p?.full_name || "—",
          otherAvatar: p?.avatar_url ?? null,
          otherRole: p?.professional_role ?? null,
          otherIsPro: !!p?.is_professional,
        };
      })
    );
    setAppointments(enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  async function loadContacts() {
    if (!user) return;
    setContactsLoading(true);
    const { data: convs } = await supabase
      .from("conversations")
      .select("user_a_id, user_b_id")
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);

    const otherIds = [
      ...new Set(
        (convs || []).flatMap((c: { user_a_id: string; user_b_id: string }) =>
          c.user_a_id === user.id ? [c.user_b_id] : [c.user_a_id]
        )
      ),
    ];

    if (otherIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, is_professional, professional_role")
        .in("id", otherIds);
      setContacts((profiles as Contact[]) || []);
    } else {
      setContacts([]);
    }
    setContactsLoading(false);
  }

  async function updateStatus(id: string, status: AppointmentStatus) {
    setBusyId(id);
    await supabase.from("appointments").update({ status }).eq("id", id);
    setBusyId(null);
    await loadAppointments();
  }

  function openBookModal() {
    setBookForm({ otherId: "", date: "", time: "09:00", duration: "60", notes: "" });
    setBookingError("");
    setBookingSuccess(false);
    loadContacts();
    setShowBookModal(true);
  }

  async function submitBooking() {
    if (!user || !bookForm.otherId || !bookForm.date) return;
    setBookingSaving(true);
    setBookingError("");

    const other = contacts.find((c) => c.id === bookForm.otherId);
    if (!other) {
      setBookingError(t("appointments.selectContact"));
      setBookingSaving(false);
      return;
    }

    const professionalId = isProfessional ? user.id : other.id;
    const clientId = isProfessional ? other.id : user.id;

    const { error } = await supabase.from("appointments").insert({
      user_id: clientId,
      professional_id: professionalId,
      appointment_date: bookForm.date,
      appointment_time: bookForm.time,
      duration_minutes: parseInt(bookForm.duration) || 60,
      notes: bookForm.notes || null,
    });

    setBookingSaving(false);
    if (error) {
      setBookingError(error.message);
      return;
    }

    const { data: meProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const myName = meProfile?.full_name || "—";
    await supabase.from("notifications").insert({
      user_id: other.id,
      type: "appointment",
      title: t("appointments.notifTitle"),
      body: t("appointments.notifBody", { name: myName, date: bookForm.date, time: bookForm.time }),
      read: false,
    });

    setBookingSuccess(true);
    setTimeout(() => {
      setShowBookModal(false);
      setBookingSuccess(false);
    }, 1600);
    await loadAppointments();
  }

  const isInRole = (apt: EnrichedAppointment) =>
    roleView === "pro"
      ? apt.professional_id === user?.id
      : apt.user_id === user?.id;

  const filtered = appointments.filter((apt) => {
    if (isProfessional && !isInRole(apt)) return false;
    const past =
      isPast(apt) ||
      apt.status === "completed" ||
      apt.status === "cancelled";
    return tab === "upcoming" ? !past : past;
  });

  const ordered = tab === "past" ? [...filtered].reverse() : filtered;

  const upcomingCount = appointments.filter(
    (a) =>
      !(isPast(a) || a.status === "completed" || a.status === "cancelled") &&
      (!isProfessional || isInRole(a))
  ).length;
  const pastCount = appointments.filter(
    (a) =>
      (isPast(a) || a.status === "completed" || a.status === "cancelled") &&
      (!isProfessional || isInRole(a))
  ).length;

  const taCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-content-strong placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
  const inputCls =
    "flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-content-strong placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
  const selectCls =
    "flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-strong">
            {t("appointments.title")}
          </h1>
          <p className="mt-0.5 text-sm text-content-muted">
            {t("appointments.subtitle")}
          </p>
        </div>
        <Button className="gap-2" onClick={openBookModal}>
          <Plus className="h-4 w-4" />
          {t("appointments.new")}
        </Button>
      </header>

      {/* Role segment for professionals */}
      {isProfessional && (
        <div className="inline-flex w-full max-w-xs rounded-xl border border-edge-base bg-surface-subtle p-1 sm:w-auto">
          {(
            [
              { key: "pro", label: t("appointments.asPro") },
              { key: "client", label: t("appointments.asClient") },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setRoleView(opt.key)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
                roleView === opt.key
                  ? "bg-surface-card text-content-strong shadow-sm"
                  : "text-content-muted hover:text-content-body"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-edge-base">
        {(
          [
            { key: "upcoming", label: t("appointments.upcoming"), count: upcomingCount },
            { key: "past", label: t("appointments.past"), count: pastCount },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            onClick={() => setTab(opt.key)}
            className={`relative flex items-center gap-2 px-1 pb-3 pt-1 text-sm font-medium transition-colors ${
              tab === opt.key
                ? "text-content-strong"
                : "text-content-muted hover:text-content-body"
            }`}
          >
            {opt.label}
            <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-xs text-content-muted">
              {opt.count}
            </span>
            {tab === opt.key && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary-600" />
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : ordered.length === 0 ? (
        <Card className="border-edge-base bg-surface-card">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-subtle">
              {tab === "upcoming" ? (
                <Calendar className="h-8 w-8 text-content-muted" />
              ) : (
                <CalendarX className="h-8 w-8 text-content-muted" />
              )}
            </div>
            <h3 className="text-base font-semibold text-content-strong">
              {t("appointments.noAppointments")}
            </h3>
            <p className="mt-1 max-w-xs text-sm text-content-muted">
              {t("appointments.noAppointmentsSub")}
            </p>
            <Button className="mt-4 gap-2" onClick={openBookModal}>
              <Plus className="h-4 w-4" />
              {t("appointments.new")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {ordered.map((apt) => {
            const cfg = statusConfig[apt.status];
            const iAmPro = apt.professional_id === user?.id;
            const canConfirm = iAmPro && apt.status === "pending";
            const canComplete = iAmPro && apt.status === "confirmed";
            const canCancel =
              (apt.status === "pending" || apt.status === "confirmed") &&
              (iAmPro || apt.user_id === user?.id);
            const busy = busyId === apt.id;
            return (
              <Card
                key={apt.id}
                className="border-edge-base bg-surface-card transition-all hover:shadow-md"
              >
                <CardContent className="p-5">
                  <div className="mb-4 flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      {apt.otherAvatar ? (
                        <AvatarImage src={apt.otherAvatar} alt={apt.otherName} />
                      ) : (
                        <AvatarFallback className="bg-primary-50 text-sm font-bold text-primary-700">
                          {initials(apt.otherName)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-content-muted">
                        {t("appointments.with")}
                      </p>
                      <p className="truncate text-sm font-semibold text-content-strong">
                        {apt.otherName}
                      </p>
                      <p className="truncate text-xs text-content-muted">
                        {apt.otherIsPro
                          ? apt.otherRole || t("appointments.professional")
                          : t("appointments.client")}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.badge}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                      {t(cfg.label)}
                    </span>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2">
                    <div className="flex items-center gap-1.5 text-sm text-content-body">
                      <Calendar className="h-4 w-4 text-content-muted" />
                      {fmtDate(apt.appointment_date)}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-content-body">
                      <Clock className="h-4 w-4 text-content-muted" />
                      {fmtTime(apt.appointment_time)}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-content-body">
                      <Clock className="h-4 w-4 text-content-muted" />
                      {apt.duration_minutes} min
                    </div>
                  </div>

                  {apt.notes && (
                    <div className="mb-4 rounded-xl bg-surface-subtle p-3 text-sm leading-relaxed text-content-body">
                      {apt.notes}
                    </div>
                  )}

                  {(canConfirm || canComplete || canCancel) && (
                    <div className="flex flex-wrap gap-2 border-t border-edge-base pt-4">
                      {canConfirm && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => updateStatus(apt.id, "confirmed")}
                          className="gap-1.5 bg-green-600 hover:bg-green-700"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {t("appointments.confirm")}
                        </Button>
                      )}
                      {canComplete && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => updateStatus(apt.id, "completed")}
                          className="gap-1.5"
                        >
                          <CalendarCheck className="h-3.5 w-3.5" />
                          {t("appointments.complete")}
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => updateStatus(apt.id, "cancelled")}
                          className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10"
                        >
                          <X className="h-3.5 w-3.5" />
                          {t("appointments.cancel")}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Booking Modal */}
      {showBookModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setShowBookModal(false)}
        >
          <Card
            className="w-full max-w-lg overflow-hidden rounded-b-none border-edge-base bg-surface-card shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-edge-base p-4">
              <h3 className="text-base font-bold text-content-strong">{t("appointments.new")}</h3>
              <button
                onClick={() => setShowBookModal(false)}
                className="text-content-muted transition-colors hover:text-content-strong"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4">
              {bookingSuccess ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                    <Check className="h-7 w-7 text-green-500" />
                  </div>
                  <p className="text-sm font-semibold text-content-strong">{t("appointments.bookSuccess")}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {bookingError && (
                    <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{bookingError}</div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-content-muted">
                      {isProfessional ? t("appointments.selectClient") : t("appointments.selectProfessional")}
                    </label>
                    {contactsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-content-muted">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("loading")}
                      </div>
                    ) : contacts.length === 0 ? (
                      <p className="rounded-lg bg-surface-subtle px-3 py-3 text-sm text-content-muted">
                        {t("appointments.noContacts")}
                      </p>
                    ) : (
                      <select
                        className={selectCls}
                        value={bookForm.otherId}
                        onChange={(e) => setBookForm((f) => ({ ...f, otherId: e.target.value }))}
                      >
                        <option value="">{t("appointments.selectContact")}</option>
                        {contacts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.full_name}
                            {c.is_professional ? ` · ${c.professional_role ?? t("appointments.professional")}` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-content-muted">{t("appointments.date")}</label>
                      <Input
                        type="date"
                        value={bookForm.date}
                        onChange={(e) => setBookForm((f) => ({ ...f, date: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-content-muted">{t("appointments.time")}</label>
                      <Input
                        type="time"
                        value={bookForm.time}
                        onChange={(e) => setBookForm((f) => ({ ...f, time: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-content-muted">{t("appointments.duration")}</label>
                    <select
                      className={selectCls}
                      value={bookForm.duration}
                      onChange={(e) => setBookForm((f) => ({ ...f, duration: e.target.value }))}
                    >
                      <option value="30">30 min</option>
                      <option value="60">60 min</option>
                      <option value="90">90 min</option>
                      <option value="120">120 min</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-content-muted">{t("appointments.notes")}</label>
                    <AutoTextarea
                      className={taCls}
                      minRows={3}
                      placeholder={t("appointments.notesPlaceholder")}
                      value={bookForm.notes}
                      onChange={(e) => setBookForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {!bookingSuccess && (
              <div className="flex items-center justify-end gap-2 border-t border-edge-base p-4">
                <Button variant="outline" onClick={() => setShowBookModal(false)}>
                  {t("cancel")}
                </Button>
                <Button
                  onClick={submitBooking}
                  disabled={bookingSaving || !bookForm.otherId || !bookForm.date}
                  className="gap-2"
                >
                  {bookingSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CalendarCheck className="h-4 w-4" />
                  )}
                  {t("appointments.confirm")}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
