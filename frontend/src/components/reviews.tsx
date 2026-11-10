import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth";
import { deleteReview, fetchReviews, upsertReview, type Review } from "../data";
import { LoginButton } from "./login-button";
import { Stars } from "./stars";

const avgFormat = new Intl.NumberFormat("es-CL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function Reviews({ groupId }: { groupId: number }) {
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
    if (rating === 0 || busy) return;
    void run(() => upsertReview(groupId, rating, comment.trim(), mine?.id));
  }

  function onDelete() {
    if (!mine || !window.confirm("¿Borrar tu reseña?")) return;
    void run(() => deleteReview(mine.id));
  }

  let summary;
  if (!reviews || reviews.length === 0) summary = null;
  else {
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    summary = (
      <p className="reviews-summary">
        {avgFormat.format(Math.round(avg * 10) / 10)} ★ · {reviews.length}{" "}
        {reviews.length === 1 ? "reseña" : "reseñas"}
      </p>
    );
  }

  return (
    <section className="product-section reviews">
      <h2>Reseñas</h2>

      {current?.error ? (
        <p className="error">Error: {current.error}</p>
      ) : !reviews ? (
        <p className="muted">Cargando reseñas…</p>
      ) : reviews.length === 0 ? (
        <p className="empty">Aún no hay reseñas</p>
      ) : (
        summary
      )}

      {!user ? (
        <LoginButton label="Iniciar sesión con Google para comentar" />
      ) : reviews ? (
        <form className="review-form" onSubmit={onSubmit}>
          <span className="review-form-title">{mine ? "Tu reseña" : "Escribe una reseña"}</span>
          <Stars value={rating} onChange={setRating} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Comentario (opcional)"
            aria-label="Comentario"
          />
          <div className="review-actions">
            <button type="submit" disabled={busy || rating === 0}>
              {mine ? "Guardar cambios" : "Publicar"}
            </button>
            {mine && (
              <button type="button" className="danger" disabled={busy} onClick={onDelete}>
                Borrar
              </button>
            )}
          </div>
          {formError && <p className="error">Error: {formError}</p>}
        </form>
      ) : null}

      {reviews && reviews.length > 0 && (
        <ul className="review-list">
          {reviews.map((r) => (
            <li key={r.id} className="review">
              <div className="review-head">
                <Stars value={r.rating} />
                <strong className="review-author">{r.author_name}</strong>
                <span className="review-date">
                  {new Date(r.created_at).toLocaleDateString("es-CL")}
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
