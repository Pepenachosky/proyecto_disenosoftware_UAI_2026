import { useTranslation } from "react-i18next";
import { useAuth } from "../auth";
import { useSaved } from "../saved";
import { LoginButton } from "./login-button";

export function SaveButton({ groupId }: { groupId: number }) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const { ids, toggle, loading: savedLoading, pending } = useSaved();
  if (loading) {
    return (
      <button type="button" className="save-button" disabled>
        {t("saved.save")}
      </button>
    );
  }
  if (!user) {
    return (
      <div>
        <p>{t("common.loginToSave")}</p>
        <LoginButton />
      </div>
    );
  }
  const saved = ids.has(groupId);
  return (
    <button
      type="button"
      className={saved ? "save-button on" : "save-button"}
      aria-pressed={saved}
      disabled={savedLoading || pending.has(groupId)}
      onClick={() => void toggle(groupId)}
    >
      {saved ? t("saved.savedState") : t("saved.save")}
    </button>
  );
}
