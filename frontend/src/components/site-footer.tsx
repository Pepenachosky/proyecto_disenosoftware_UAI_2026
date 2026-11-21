import { Link } from "react-router";
import { useTranslation } from "react-i18next";

export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="site-footer">
      <Link to="/privacidad">{t("footer.privacy")}</Link>
    </footer>
  );
}
