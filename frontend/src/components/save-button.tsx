import { useTranslation } from "react-i18next";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useAuth } from "../auth";
import { useSaved } from "../saved";
import { LoginButton } from "./login-button";

// Botón Guardar/Guardado del panel de cotización. Sin sesión muestra el inicio de sesión.
export function SaveButton({ groupId }: { groupId: number }) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const { ids, toggle, loading: savedLoading, pending } = useSaved();
  // Mientras se resuelve la sesión se muestra deshabilitado, sin saltar al botón de Google.
  if (loading) {
    return (
      <button type="button" className="save-button" disabled>
        <Bookmark size={18} aria-hidden="true" />
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
    // Bloqueado mientras cargan los guardados o hay un cambio en curso para este producto.
    <button
      type="button"
      className={saved ? "save-button on" : "save-button"}
      aria-pressed={saved}
      disabled={savedLoading || pending.has(groupId)}
      onClick={() => void toggle(groupId)}
    >
      {saved ? <BookmarkCheck size={18} aria-hidden="true" /> : <Bookmark size={18} aria-hidden="true" />}
      {saved ? t("saved.savedState") : t("saved.save")}
    </button>
  );
}
