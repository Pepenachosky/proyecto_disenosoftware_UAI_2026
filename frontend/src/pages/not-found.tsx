import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../components/empty-state";

/** Página 404 para cualquier ruta no definida en app.tsx. */
export function NotFound() {
  const { t } = useTranslation();
  return (
    <main className="wrap">
      <EmptyState heading icon={<SearchX size={40} aria-hidden="true" />}>{t("common.notFound")}</EmptyState>
    </main>
  );
}
