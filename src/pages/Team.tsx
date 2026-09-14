import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, MessageCircle, Calendar, Star, MapPin, Search, Award, X, CheckCircle2, UserCircle } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationsContext";
import { InviteModal } from "../components/InviteModal";
import { useI18n } from "../context/I18nContext";
import { AutoTextarea } from "../components/ui/textarea";

interface Professional {
  id: string;
  full_name: string;
  professional_role: string;
  specialty: string;
  credentials: string;
  location_city: string;
  bio: string;
  available_for_booking: boolean;
  rating_avg: number;
  rating_count: number;
  avatar_url: string | null;
}

const roleColors: Record<string, { bg: string; text: string }> = {
  "Nutricionista": { bg: "bg-rose-50", text: "text-rose-700" },
  "Personal Trainer": { bg: "bg-primary-50", text: "text-primary-700" },
  "Médico do Esporte": { bg: "bg-green-50", text: "text-green-700" },
  "Fisioterapeuta": { bg: "bg-teal-50", text: "text-teal-700" },
  "Psicóloga(o)": { bg: "bg-violet-50", text: "text-violet-700" },
  "Endocrinologista": { bg: "bg-amber-50", text: "text-amber-700" },
  "Coach de Saúde": { bg: "bg-cyan-50", text: "text-cyan-700" },
};

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function Team() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [selectedPro, setSelectedPro] = useState<Professional | null>(null);

  useEffect(() => {
    loadProfessionals();
  }, []);

  async function loadProfessionals() {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, professional_role, specialty, credentials, location_city, bio, available_for_booking, rating_avg, rating_count, avatar_url")
      .eq("is_professional", true)
      .order("rating_avg", { ascending: false });
    if (data) setProfessionals(data as Professional[]);
    setLoading(false);
  }

  const [inviteTarget, setInviteTarget] = useState<{ id: string; name: string } | null>(null);
  const [bookingTarget, setBookingTarget] = useState<Professional | null>(null);
  const [bookingForm, setBookingForm] = useState({ date: "", time: "09:00", duration: "60", notes: "" });
  const [bookingSaving, setBookingSaving] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  function startConversation(pro: Professional) {
    setInviteTarget({ id: pro.id, name: pro.full_name });
  }

  function openBooking(pro: Professional) {
    setBookingTarget(pro);
    setBookingForm({ date: "", time: "09:00", duration: "60", notes: "" });
    setBookingSuccess(false);
  }

  const [bookingError, setBookingError] = useState("");

  async function submitBooking() {
    if (!bookingTarget || !bookingForm.date || !user) return;
    setBookingSaving(true);
    setBookingError("");
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        professional_id: bookingTarget.id,
        appointment_date: bookingForm.date,
        appointment_time: bookingForm.time,
        duration_minutes: parseInt(bookingForm.duration) || 60,
        notes: bookingForm.notes || null,
      })
      .select()
      .single();
    setBookingSaving(false);
    if (error) {
      setBookingError(error.message);
      return;
    }
    if (data) {
      const { data: meProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const myName = meProfile?.full_name || "Um cliente";
      await supabase.from("notifications").insert({
        user_id: bookingTarget.id,
        type: "appointment",
        title: t("appointments.notifTitle"),
        body: t("appointments.notifBody", { name: myName, date: bookingForm.date, time: bookingForm.time }),
        read: false,
      });
      setBookingSuccess(true);
      setTimeout(() => { setBookingTarget(null); setBookingSuccess(false); }, 2000);
    }
  }

  const filtered = professionals.filter((p) => {
    const matchesSearch = !search.trim() ||
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.professional_role?.toLowerCase().includes(search.toLowerCase()) ||
      p.specialty?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !roleFilter || p.professional_role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const uniqueRoles = [...new Set(professionals.map((p) => p.professional_role).filter(Boolean))];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("team.title")}</h1>
          <p className="mt-0.5 text-sm text-slate-500">{t("team.subtitle")}</p>
        </div>
      </header>

      {/* Search and filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="flex h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder={t("team.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setRoleFilter(null)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              !roleFilter ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t("all")}
          </button>
          {uniqueRoles.map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role === roleFilter ? null : role)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                role === roleFilter ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <UserPlus className="mb-3 h-12 w-12 text-slate-200" />
            <h3 className="text-base font-semibold text-slate-700">
              {professionals.length === 0 ? "Nenhum profissional cadastrado ainda" : t("team.noResults")}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {professionals.length === 0 ? "Profissionais aparecerão aqui quando se cadastrarem" : "Tente outro termo de busca"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((pro) => {
            const color = roleColors[pro.professional_role ?? ""] ?? { bg: "bg-slate-50", text: "text-slate-700" };
            return (
              <Card
                key={pro.id}
                className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
                onClick={() => setSelectedPro(pro)}
              >
                <CardContent className="p-5">
                  <div className="mb-3 flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      {pro.avatar_url ? (
                        <AvatarImage src={pro.avatar_url} alt={pro.full_name} />
                      ) : (
                        <AvatarFallback className={`text-sm font-bold ${color.bg} ${color.text}`}>
                          {initials(pro.full_name)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">{pro.full_name}</p>
                        {pro.available_for_booking && (
                          <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600">
                            Disponível
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{pro.professional_role}</p>
                    </div>
                  </div>

                  {pro.specialty && (
                    <p className="mb-2 text-xs text-slate-600">
                      <span className="font-medium">Especialidade:</span> {pro.specialty}
                    </p>
                  )}

                  {pro.credentials && (
                    <div className="mb-2 flex items-center gap-1 text-xs text-slate-500">
                      <Award className="h-3 w-3" />
                      {pro.credentials}
                    </div>
                  )}

                  {pro.location_city && (
                    <div className="mb-3 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3 w-3" />
                      {pro.location_city}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-medium text-slate-700">{pro.rating_avg > 0 ? pro.rating_avg : "Novo"}</span>
                      {pro.rating_count > 0 && (
                        <span className="text-xs text-slate-400">({pro.rating_count})</span>
                      )}
                    </div>
                    <Button size="sm" className="h-7 gap-1.5 px-3 text-xs" onClick={() => openBooking(pro)}>
                      <Calendar className="h-3 w-3" />
                      {t("team.book")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Invite (email verification) modal triggered from the professional card */}
      <InviteModal
        open={!!inviteTarget}
        onClose={() => setInviteTarget(null)}
        hintName={inviteTarget?.name}
        expectedUserId={inviteTarget?.id}
      />

      {/* Booking modal */}
      {bookingTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setBookingTarget(null)}>
          <div className="w-full max-w-md rounded-t-2xl bg-surface-card p-6 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-content-strong">{t("appointments.bookWith")} {bookingTarget.full_name}</h2>
                <p className="text-sm text-content-muted">{bookingTarget.professional_role}</p>
              </div>
              <button onClick={() => setBookingTarget(null)} className="text-content-muted hover:text-content-body">
                <X className="h-5 w-5" />
              </button>
            </div>
            {bookingSuccess ? (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 className="mb-3 h-12 w-12 text-green-500" />
                <p className="text-base font-semibold text-content-strong">{t("appointments.bookSuccess")}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {bookingError && (
                  <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{bookingError}</div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-content-body">{t("appointments.date")}</label>
                    <input type="date" min={new Date().toISOString().slice(0, 10)} value={bookingForm.date} onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })} className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-content-body">{t("appointments.time")}</label>
                    <input type="time" value={bookingForm.time} onChange={(e) => setBookingForm({ ...bookingForm, time: e.target.value })} className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-content-body">{t("appointments.duration")}</label>
                  <select value={bookingForm.duration} onChange={(e) => setBookingForm({ ...bookingForm, duration: e.target.value })} className="mt-1 flex h-10 w-full rounded-lg border border-edge-base bg-surface-card px-3 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100">
                    <option value="30">30</option>
                    <option value="60">60</option>
                    <option value="90">90</option>
                    <option value="120">120</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-content-body">{t("appointments.notes")}</label>
                  <AutoTextarea minRows={3} placeholder={t("appointments.notesPlaceholder")} value={bookingForm.notes} onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })} className="mt-1 flex w-full rounded-lg border border-edge-base bg-surface-card px-3 py-2 text-sm text-content-strong focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100" />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setBookingTarget(null)}>{t("cancel")}</Button>
                  <Button className="flex-1" onClick={submitBooking} disabled={bookingSaving || !bookingForm.date}>{bookingSaving ? t("loading") : t("add")}</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Professional detail modal */}
      {selectedPro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Avatar className="h-14 w-14">
                  {selectedPro.avatar_url ? (
                    <AvatarImage src={selectedPro.avatar_url} alt={selectedPro.full_name} />
                  ) : (
                    <AvatarFallback className={`text-base font-bold ${roleColors[selectedPro.professional_role ?? ""]?.bg ?? "bg-slate-50"} ${roleColors[selectedPro.professional_role ?? ""]?.text ?? "text-slate-700"}`}>
                      {initials(selectedPro.full_name)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedPro.full_name}</h2>
                  <p className="text-sm text-slate-500">{selectedPro.professional_role}</p>
                  {selectedPro.available_for_booking && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600">
                      Disponível para agendamento
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedPro(null)} className="text-slate-400 hover:text-slate-600">
                <span className="text-lg">&times;</span>
              </button>
            </div>

            <div className="space-y-3">
              {selectedPro.specialty && (
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Especialidade</p>
                  <p className="text-sm font-medium text-slate-900">{selectedPro.specialty}</p>
                </div>
              )}
              {selectedPro.credentials && (
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                  <Award className="h-4 w-4 text-slate-500" />
                  <div>
                    <p className="text-xs text-slate-500">Registro Profissional</p>
                    <p className="text-sm font-medium text-slate-900">{selectedPro.credentials}</p>
                  </div>
                </div>
              )}
              {selectedPro.location_city && (
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  <p className="text-sm text-slate-700">{selectedPro.location_city}</p>
                </div>
              )}
              {selectedPro.bio && (
                <div className="rounded-xl border border-slate-100 p-3">
                  <p className="text-xs text-slate-500 mb-1">Sobre</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{selectedPro.bio}</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-medium text-slate-900">{selectedPro.rating_avg > 0 ? selectedPro.rating_avg : "Novo"}</span>
                  {selectedPro.rating_count > 0 && (
                    <span className="text-xs text-slate-400">({selectedPro.rating_count} avaliações)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 gap-2" onClick={() => startConversation(selectedPro)}>
                  <MessageCircle className="h-4 w-4" />
                  {t("team.message")}
                </Button>
                <Button className="flex-1 gap-2" disabled={!selectedPro.available_for_booking} onClick={() => openBooking(selectedPro)}>
                  <Calendar className="h-4 w-4" />
                  {t("team.book")}
                </Button>
              </div>
              <Button variant="ghost" className="w-full gap-2 text-sm" onClick={() => { navigate(`/professional/${selectedPro.id}`); setSelectedPro(null); }}>
                <UserCircle className="h-4 w-4" />
                Ver Perfil Completo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
