import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Star } from "lucide-react";
import type { FormEvent } from "react";
import { useAuth } from "../auth";
import { deleteReview, fetchReviews, upsertReview, type Review } from "../data";
import { LoginButton } from "./login-button";
import { useLanguage } from "../language.tsx";
import { Stars } from "./stars";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function Reviews({ groupId }: { groupId: number }) {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "long" }), [locale]);
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  const [list, setList] = useState<{ key: string; reviews: Review[] | null; error: string | null } | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const key = `${groupId}:${version}`;
  useEffect(() => {
    let active = true;
    fetchReviews(groupId)
      .then((reviews) => active && setList({ key, reviews, error: null }))
      .catch((e) => active && setList({ key, reviews: null, error: message(e) }));
    return () => {
      active = false;
    };
  }, [groupId, key]);

  // Mientras se recarga se sigue mostrando la lista anterior del mismo producto.
  const current = list && list.key.startsWith(`${groupId}:`) ? list : null;
  // Tras publicar o borrar, el formulario sigue ocupado hasta que llega la lista nueva.
  const locked = busy || list?.key !== key;
  const reviews = current?.reviews ?? null;
  const mine = user && reviews ? (reviews.find((r) => r.user_id === user.id) ?? null) : null;

  // Precarga el formulario con la reseña propia cuando cambia (patrón "ajustar estado al renderizar").
  const formKey = user && reviews ? `${user.id}:${mine?.id ?? "new"}:${mine?.updated_at ?? ""}` : null;
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  if (formKey !== syncedKey) {
    setSyncedKey(formKey);
    setRating(mine?.rating ?? 0);
    setComment(mine?.comment ?? "");
    setFormError(null);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFormError(null);
    try {
      await action();
      setVersion((v) => v + 1);
    } catch (e) {
      setFormError(message(e));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (rating === 0 || locked) return;
    void run(() => upsertReview(groupId, rating, comment.trim(), mine?.id));
  }

  function onDelete() {
    if (!mine || locked || !window.confirm(t("reviews.confirmDelete"))) return;
    void run(() => deleteReview(mine.id));
  }

  let summary;
  if (!reviews || reviews.length === 0) summary = null;
  else {
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    summary = (
      <p className="reviews-summary">
        <Star size={18} aria-hidden="true" fill="currentColor" />{" "}
        {t("reviews.summary", {
          count: reviews.length,
          avg: new Intl.NumberFormat(locale, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(Math.round(avg * 10) / 10),
        })}
      </p>
    );
  }

  return (
    <section className="product-section reviews">
      <h2>{t("reviews.title")}</h2>

      {current?.error ? (
        <p className="error">{t("common.error", { message: current.error })}</p>
      ) : !reviews ? (
        <p className="muted">{t("reviews.loading")}</p>
      ) : reviews.length === 0 ? (
        <p className="empty">{t("reviews.empty")}</p>
      ) : (
        summary
      )}

      {!user ? (
        <>
          <p>{t("reviews.loginPrompt")}</p>
          <LoginButton />
        </>
      ) : reviews ? (
        <form className="review-form" onSubmit={onSubmit}>
          <span className="review-form-title">{mine ? t("reviews.yourReview") : t("reviews.writeReview")}</span>
          <Stars value={rating} onChange={setRating} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={t("reviews.commentPlaceholder")}
            aria-label={t("reviews.commentLabel")}
          />
          <div className="review-actions">
            <button type="submit" disabled={locked || rating === 0}>
              {mine ? t("reviews.saveChanges") : t("reviews.publish")}
            </button>
            {mine && (
              <button type="button" className="danger" disabled={locked} onClick={onDelete}>
                {t("reviews.delete")}
              </button>
            )}
          </div>
          {formError && <p className="error">{t("common.error", { message: formError })}</p>}
        </form>
      ) : null}

      {reviews && reviews.length > 0 && (
        <ul className="review-list">
          {reviews.map((r) => (
            <li key={r.id} className="review">
              <div className="review-head">
                <Stars value={r.rating} />
                <strong className="review-author">{r.author_name === "Usuario" ? t("reviews.anonymous") : r.author_name}</strong>
                <span className="review-date">
                  {dateFmt.format(new Date(r.created_at))}
                </span>
              </div>
              {r.comment && <p className="review-comment">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
