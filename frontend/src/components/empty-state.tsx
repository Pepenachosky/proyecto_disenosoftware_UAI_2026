import type { ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

export function EmptyState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">{icon}</span>
      <p className="empty-text">{children}</p>
      <Link to="/" className="btn-primary">{t("common.backToProducts")}</Link>
    </div>
  );
}
