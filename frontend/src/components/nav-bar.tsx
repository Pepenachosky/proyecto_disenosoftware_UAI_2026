import { NavLink } from "react-router";
import { useAuth } from "../auth";
import { useSaved } from "../saved";
import { LoginButton } from "./login-button";

export function NavBar() {
  const { user, loading, signOut } = useAuth();
  const { ids } = useSaved();
  return (
    <nav className="nav-bar">
      <NavLink to="/" end>Productos</NavLink>
      <NavLink to="/guardados">Guardados ({ids.size})</NavLink>
      <div className="nav-user">
        {loading ? null : user ? (
          <>
            <span className="nav-name">{user.name}</span>
            <button type="button" onClick={() => void signOut()}>Salir</button>
          </>
        ) : (
          <LoginButton />
        )}
      </div>
    </nav>
  );
}
