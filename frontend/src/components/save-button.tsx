import { useAuth } from "../auth";
import { useSaved } from "../saved";
import { LoginButton } from "./login-button";

export function SaveButton({ groupId }: { groupId: number }) {
  const { user, loading } = useAuth();
  const { ids, toggle, loading: savedLoading, pending } = useSaved();
  if (loading) {
    return (
      <button type="button" className="save-button" disabled>
        ☆ Guardar para comparar
      </button>
    );
  }
  if (!user) {
    return (
      <div>
        <p>Inicia sesión para guardar</p>
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
      {saved ? "★ Guardado" : "☆ Guardar para comparar"}
    </button>
  );
}
