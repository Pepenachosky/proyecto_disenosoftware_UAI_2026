import { NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth";
import { useSaved } from "../saved";
import { LoginButton } from "./login-button";
import { LanguageSwitch } from "./language-switch";

export function NavBar() {
  const { user, loading, signOut } = useAuth();
  const { ids } = useSaved();
  const { t } = useTranslation();
  return (
    <nav className="nav-bar">
      <NavLink to="/" end>{t("nav.products")}</NavLink>
      <NavLink to="/guardados">{t("nav.saved", { count: ids.size })}</NavLink>
      <div className="nav-user">
        <LanguageSwitch />
        {loading ? null : user ? (
          <>
            <span className="nav-name">{user.name || t("nav.user")}</span>
            <button type="button" onClick={() => void signOut()}>{t("nav.signOut")}</button>
          </>
        ) : (
          <LoginButton size="medium" />
        )}
      </div>
    </nav>
  );
}
