import type { ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

// `heading`: el texto es el h1 de la página (404, producto no encontrado);
// si no, es un párrafo bajo el título que ya tiene la página.
export function EmptyState(
  { icon, children, heading = false }: { icon: ReactNode; children: ReactNode; heading?: boolean },
) {
  const { t } = useTranslation();
  const Text = heading ? "h1" : "p";
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">{icon}</span>
      <Text className="empty-text">{children}</Text>
      <Link to="/" className="btn-primary">{t("common.backToProducts")}</Link>
    </div>
  );
}
