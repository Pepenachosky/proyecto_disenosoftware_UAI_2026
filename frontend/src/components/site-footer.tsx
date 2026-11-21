import { Link } from "react-router";
import { useTranslation } from "react-i18next";

// Pie de página global (app.tsx) con el enlace a la política de privacidad y cookies.
export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="site-footer">
      <Link to="/privacidad">{t("footer.privacy")}</Link>
    </footer>
  );
}
