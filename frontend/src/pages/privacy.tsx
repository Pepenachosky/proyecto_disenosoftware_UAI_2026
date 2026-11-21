import { useTranslation } from "react-i18next";
import { useConsent } from "../consent.tsx";
import { useLanguage } from "../language.tsx";
import { CONSENT_KEY, CONSENT_VERSION } from "../lib/consent.ts";
import { STORAGE_KEY } from "../lib/locale.ts";
import { CONTACT_EMAIL, POLICY_UPDATED } from "../lib/privacy-policy.ts";

function Mail() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}

export function PrivacyPage() {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const { decision, accept, reject } = useConsent();
  // Mediodía UTC: la fecha no cambia de día por la zona horaria.
  const date = new Date(`${POLICY_UPDATED}T12:00:00Z`).toLocaleDateString(locale, { dateStyle: "long" });

  const rows = [
    { name: CONSENT_KEY, ...t("privacy.storage.consent", { returnObjects: true }) },
    { name: STORAGE_KEY, ...t("privacy.storage.lang", { returnObjects: true }) },
    { name: "sb-…-auth-token", ...t("privacy.storage.session", { returnObjects: true }) },
    t("privacy.storage.google", { returnObjects: true }),
  ];

  return (
    <main className="wrap privacy">
      <h1>{t("privacy.title")}</h1>
      <p className="muted">{t("privacy.meta", { version: CONSENT_VERSION, date })}</p>
      <p>{t("privacy.intro")}</p>

      <h2>{t("privacy.controller.title")}</h2>
      <p>{t("privacy.controller.text")}</p>
      <p>{t("privacy.controller.contact")} <Mail /></p>

      <h2>{t("privacy.data.title")}</h2>
      <ul>
        <li>{t("privacy.data.account")}</li>
        <li>{t("privacy.data.profile")}</li>
        <li>{t("privacy.data.reviews")}</li>
        <li>{t("privacy.data.saved")}</li>
        <li>{t("privacy.data.location")}</li>
      </ul>

      <h2>{t("privacy.storage.title")}</h2>
      <p>{t("privacy.storage.intro")}</p>
      <div className="table-scroll">
        <table className="storage-table">
          <thead>
            <tr>
              <th scope="col">{t("privacy.storage.colName")}</th>
              <th scope="col">{t("privacy.storage.colWhere")}</th>
              <th scope="col">{t("privacy.storage.colPurpose")}</th>
              <th scope="col">{t("privacy.storage.colWhen")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="mono" data-label={t("privacy.storage.colName")}>{r.name}</td>
                <td data-label={t("privacy.storage.colWhere")}>{r.where}</td>
                <td data-label={t("privacy.storage.colPurpose")}>{r.purpose}</td>
                <td data-label={t("privacy.storage.colWhen")}>{r.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>{t("privacy.storage.googleNote")}</p>

      <h2>{t("privacy.third.title")}</h2>
      <ul>
        <li>{t("privacy.third.supabase")}</li>
        <li>{t("privacy.third.google")}</li>
        <li>{t("privacy.third.vercel")}</li>
        <li>{t("privacy.third.stores")}</li>
      </ul>
      <h3>{t("privacy.third.transfersTitle")}</h3>
      <p>{t("privacy.third.transfers")}</p>

      <h2>{t("privacy.legal.title")}</h2>
      <ul>
        <li>{t("privacy.legal.consent")}</li>
        <li>{t("privacy.legal.service")}</li>
      </ul>

      <h2>{t("privacy.retention.title")}</h2>
      <ul>
        <li>{t("privacy.retention.account")}</li>
        <li>{t("privacy.retention.browser")}</li>
      </ul>

      <h2>{t("privacy.rights.title")}</h2>
      <p>{t("privacy.rights.text")}</p>
      <p>{t("privacy.rights.how")} <Mail /></p>

      <h2 id="tu-eleccion">{t("privacy.choice.title")}</h2>
      <p role="status">
        {decision === "aceptado"
          ? t("privacy.choice.accepted")
          : decision === "rechazado"
            ? t("privacy.choice.rejected")
            : t("privacy.choice.undecided")}
      </p>
      <p className="muted">{t("privacy.choice.hint")}</p>
      <div className="consent-actions privacy-actions" role="group" aria-labelledby="tu-eleccion">
        <button
          type="button"
          className="consent-choice"
          aria-pressed={decision === "rechazado"}
          onClick={() => void reject()}
        >
          {t("consent.reject")}
        </button>
        <button
          type="button"
          className="consent-choice"
          aria-pressed={decision === "aceptado"}
          onClick={accept}
        >
          {t("consent.accept")}
        </button>
      </div>

      <h2>{t("privacy.changes.title")}</h2>
      <p>{t("privacy.changes.text")}</p>
    </main>
  );
}
