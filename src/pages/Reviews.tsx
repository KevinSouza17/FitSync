import { useEffect, useState } from "react";
import { Star, Trash2, Loader2, Send, Check } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import { supabase } from "../lib/supabase";
import { AutoTextarea } from "../components/ui/textarea";
import type { SiteReview } from "../lib/types";
import { cn } from "../lib/utils";

interface ReviewWithProfile extends SiteReview {
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "hoje";
  if (days < 7) return `${days}d atrás`;
  if (days < 30) return `${Math.floor(days / 7)}sem atrás`;
  if (days < 365) return `${Math.floor(days / 30)}m atrás`;
  return `${Math.floor(days / 365)}a atrás`;
}

function StarRow({ value, onChange, size = "h-8 w-8" }: { value: number; onChange?: (v: number) => void; size?: string }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange?.(s)}
          disabled={!onChange}
          className={cn("transition-transform", onChange && "hover:scale-110")}
        >
          <Star
            className={cn(size, s <= value ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-200")}
          />
        </button>
      ))}
    </div>
  );
}

export function Reviews() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [reviews, setReviews] = useState<ReviewWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myReview, setMyReview] = useState<SiteReview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadReviews();
    const channel = supabase
      .channel("reviews-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_reviews" }, () => loadReviews())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function loadReviews() {
    const { data } = await supabase
      .from("site_reviews")
      .select("*, profiles:user_id(full_name, avatar_url)")
      .order("created_at", { ascending: false });
    const list = (data as ReviewWithProfile[]) || [];
    setReviews(list);
    const mine = list.find((r) => r.user_id === user?.id);
    if (mine) {
      setMyReview(mine as SiteReview);
      setRating(mine.rating);
      setComment(mine.comment);
    }
    setLoading(false);
  }

  async function submitReview() {
    if (!user || rating === 0) { setError(t("reviews.yourRating")); return; }
    setSubmitting(true);
    setError("");
    if (myReview) {
      await supabase.from("site_reviews").delete().eq("id", myReview.id);
    }
    const { data } = await supabase
      .from("site_reviews")
      .insert({ rating, comment: comment.trim() })
      .select()
      .single();
    if (data) {
      setMyReview(data as SiteReview);
      await loadReviews();
    }
    setSubmitting(false);
  }

  async function deleteReview() {
    if (!myReview) return;
    await supabase.from("site_reviews").delete().eq("id", myReview.id);
    setMyReview(null);
    setRating(0);
    setComment("");
    await loadReviews();
  }

  const avg = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const taCls = "w-full rounded-xl border border-edge-base bg-surface-base px-4 py-3 text-sm text-content-strong placeholder:text-content-muted focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-bold text-content-strong">{t("reviews.title")}</h1>
        <p className="mt-0.5 text-sm text-content-muted">{t("reviews.subtitle")}</p>
      </header>

      {/* Average summary */}
      {reviews.length > 0 && (
        <Card>
          <CardContent className="flex items-center gap-5 p-5">
            <div className="flex flex-col items-center">
              <span className="text-4xl font-black text-content-strong">{avg.toFixed(1)}</span>
              <StarRow value={Math.round(avg)} size="h-4 w-4" />
              <span className="mt-1 text-xs text-content-muted">{t("reviews.totalReviews").replace("{count}", String(reviews.length))}</span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = reviews.filter((r) => r.rating === star).length;
                const pct = reviews.length ? (count / reviews.length) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="flex w-6 items-center gap-0.5 text-xs text-content-muted">
                      {star}<Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-subtle">
                      <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right text-xs text-content-muted">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review form */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-content-strong">
              {myReview ? t("reviews.update") : t("reviews.yourRating")}
            </h3>
            {myReview && (
              <Button variant="ghost" size="sm" onClick={deleteReview} className="gap-1.5 text-red-500 hover:text-red-600">
                <Trash2 className="h-3.5 w-3.5" />{t("reviews.delete")}
              </Button>
            )}
          </div>
          <StarRow value={rating} onChange={setRating} />
          <AutoTextarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("reviews.commentPlaceholder")}
            minRows={3}
            className={taCls}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end">
            <Button onClick={submitReview} disabled={submitting || rating === 0} className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : myReview ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {myReview ? t("reviews.update") : t("reviews.submit")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reviews list */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Star className="mb-3 h-12 w-12 text-slate-200" />
            <h3 className="text-base font-semibold text-content-body">{t("reviews.noReviews")}</h3>
            <p className="mt-1 text-sm text-content-muted">{t("reviews.noReviewsSub")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((r) => {
            const name = r.profiles?.full_name || "Usuário";
            const isMine = r.user_id === user?.id;
            return (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        {r.profiles?.avatar_url ? (
                          <AvatarImage src={r.profiles.avatar_url} alt={name} />
                        ) : (
                          <AvatarFallback className="bg-primary-50 text-sm font-bold text-primary-600">{initials(name)}</AvatarFallback>
                        )}
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold text-content-strong">
                          {name}{isMine && <span className="ml-1.5 text-xs font-normal text-primary-500">(você)</span>}
                        </p>
                        <StarRow value={r.rating} size="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <span className="text-xs text-content-muted">{timeAgo(r.created_at)}</span>
                  </div>
                  {r.comment && <p className="mt-3 text-sm leading-relaxed text-content-body">{r.comment}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
