import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { googleIdentity } from "../google";
import { useLanguage } from "../language.tsx";
import { useConsent } from "../consent.tsx";

type Props = { size?: "medium" | "large"; type?: "standard" | "icon" };

// Sin consentimiento aceptado no se carga el script de Google (deja cookies):
// en su lugar se explica por qué y se ofrece volver a abrir el aviso.
export function LoginButton(
  { hideWithoutConsent = false, ...props }: Props & { hideWithoutConsent?: boolean },
) {
  const { t } = useTranslation();
  const { decision, reopen } = useConsent();
  if (decision === "aceptado") return <GoogleButton {...props} />;
  if (hideWithoutConsent) return null;
  return (
    <div className="login-consent">
      <p>{t("consent.loginNeedsConsent")}</p>
      <button type="button" onClick={reopen}>{t("consent.review")}</button>
    </div>
  );
}

function GoogleButton({ size = "large", type = "standard" }: Props) {
  const { lang } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const draw = () => {
      void googleIdentity().then((id) => {
        const el = ref.current;
        if (cancelled || !id || !el) return;
        el.replaceChildren();
        id.renderButton(el, {
          type,
          theme: media.matches ? "filled_black" : "outline",
          size,
          text: "signin_with",
          shape: type === "icon" ? "circle" : "pill",
          logo_alignment: "left",
          locale: lang,
        });
      }).catch((e) => console.warn("No se pudo dibujar el botón de Google:", e));
    };
    draw();
    media.addEventListener("change", draw);
    return () => {
      cancelled = true;
      media.removeEventListener("change", draw);
    };
  }, [size, type, lang]);

  return <div className="google-button" ref={ref} />;
}
