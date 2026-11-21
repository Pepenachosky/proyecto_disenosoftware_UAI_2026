import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useConsent } from "../consent.tsx";

// Aviso de consentimiento: no bloquea la página ni atrapa el foco.
// Rechazar y Aceptar tienen el mismo estilo: ninguno empuja al otro.
// Se monta una vez en app.tsx; está abierto mientras no haya decisión o tras «Revisar preferencias».
export function ConsentBanner() {
  const { t } = useTranslation();
  const { decision, bannerOpen, busy, focusSignal, accept, reject, close } = useConsent();
  const firstRef = useRef<HTMLButtonElement>(null);

  // Al abrirse, y cada vez que se pulsa «Revisar preferencias» (aunque ya estuviera abierto).
  useEffect(() => {
    if (bannerOpen) firstRef.current?.focus();
  }, [bannerOpen, focusSignal]);

  if (!bannerOpen) return null;
  // role="dialog" sin aria-modal: es un aviso no modal y el resto de la página sigue usable.
  return (
    <section className="consent-banner glass" role="dialog" aria-labelledby="consent-title">
      <div className="consent-head">
        <h2 id="consent-title">{t("consent.title")}</h2>
        {/* Sin decisión previa no hay botón de cerrar: la primera vez hay que elegir. */}
        {decision !== null && (
          <button type="button" className="consent-close" aria-label={t("common.close")} onClick={close}>
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>
      <p>
        {t("consent.text")} <Link to="/privacidad">{t("consent.policyLink")}</Link>
      </p>
      <div className="consent-actions">
        {/* busy: rechazar tras haber aceptado cierra la sesión y recarga; mientras tanto ambos botones quedan bloqueados. */}
        <button ref={firstRef} type="button" className="consent-choice" disabled={busy} onClick={() => void reject()}>
          {t("consent.reject")}
        </button>
        <button type="button" className="consent-choice" disabled={busy} onClick={accept}>
          {t("consent.accept")}
        </button>
      </div>
    </section>
  );
}
