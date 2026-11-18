import { SearchX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../components/empty-state";

export function NotFound() {
  const { t } = useTranslation();
  return (
    <main className="wrap">
      <EmptyState heading icon={<SearchX size={40} aria-hidden="true" />}>{t("common.notFound")}</EmptyState>
    </main>
  );
}
