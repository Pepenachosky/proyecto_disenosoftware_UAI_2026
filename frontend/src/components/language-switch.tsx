import { useTranslation } from "react-i18next";
import { useLanguage } from "../language.tsx";
import { LANGS } from "../lib/locale.ts";

// Dos botones ES / EN; el activo queda marcado con aria-pressed.
export function LanguageSwitch() {
  const { t } = useTranslation();
  const { lang, setLang } = useLanguage();
  return (
    <div className="lang-switch" role="group" aria-label={t("nav.language")}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
