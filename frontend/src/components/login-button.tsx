import { useAuth } from "../auth";

export function LoginButton({ label = "Iniciar sesión con Google" }: { label?: string }) {
  const { signIn } = useAuth();
  return (
    <button type="button" className="login-button" onClick={() => void signIn().catch((e) => alert(e.message))}>
      {label}
    </button>
  );
}
