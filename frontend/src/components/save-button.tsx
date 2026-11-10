import { useAuth } from "../auth";
import { useSaved } from "../saved";
import { LoginButton } from "./login-button";

export function SaveButton({ groupId }: { groupId: number }) {
  const { user, loading } = useAuth();
  const { ids, toggle, loading: savedLoading } = useSaved();
  if (loading) {
    return (
      <button type="button" className="save-button" disabled>
        ☆ Guardar para comparar
      </button>
    );
  }
  if (!user) return <LoginButton label="Inicia sesión para guardar" />;
  const saved = ids.has(groupId);
  return (
    <button
      type="button"
      className={saved ? "save-button on" : "save-button"}
      aria-pressed={saved}
      disabled={savedLoading}
      onClick={() => void toggle(groupId)}
    >
      {saved ? "★ Guardado" : "☆ Guardar para comparar"}
    </button>
  );
}
