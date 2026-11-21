import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useConsent } from "../consent.tsx";

// Aviso de consentimiento: no bloquea la página ni atrapa el foco.
// Rechazar y Aceptar tienen el mismo estilo: ninguno empuja al otro.
export function ConsentBanner() {
  const { t } = useTranslation();
  const { decision, bannerOpen, accept, reject, close } = useConsent();
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (bannerOpen) firstRef.current?.focus();
  }, [bannerOpen]);

  if (!bannerOpen) return null;
  return (
    <section className="consent-banner glass" role="dialog" aria-labelledby="consent-title">
      <div className="consent-head">
        <h2 id="consent-title">{t("consent.title")}</h2>
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
        <button ref={firstRef} type="button" className="consent-choice" onClick={() => void reject()}>
          {t("consent.reject")}
        </button>
        <button type="button" className="consent-choice" onClick={accept}>
          {t("consent.accept")}
        </button>
      </div>
    </section>
  );
}
