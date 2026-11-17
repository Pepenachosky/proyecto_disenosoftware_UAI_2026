import { Link, NavLink } from "react-router";
import { useTranslation } from "react-i18next";
import { Bookmark, LayoutGrid, LogOut } from "lucide-react";
import { useAuth } from "../auth";
import { useSaved } from "../saved";
import { NARROW, useMediaQuery } from "../media";
import { LoginButton } from "./login-button";
import { LanguageSwitch } from "./language-switch";

export function NavBar() {
  const { user, loading, signOut } = useAuth();
  const { ids } = useSaved();
  const { t } = useTranslation();
  const narrow = useMediaQuery(NARROW);
  return (
    <nav className="nav-bar glass">
      <Link to="/" className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">{t("common.appTitle")}</span>
      </Link>
      <NavLink to="/" end>
        <LayoutGrid size={18} aria-hidden="true" />
        <span className="nav-label">{t("nav.products")}</span>
      </NavLink>
      <NavLink to="/guardados">
        <Bookmark size={18} aria-hidden="true" />
        <span className="nav-label">{t("nav.saved", { count: ids.size })}</span>
        <span className="nav-count" aria-hidden="true">{ids.size}</span>
      </NavLink>
      <div className="nav-user">
        <LanguageSwitch />
        {loading ? null : user ? (
          <>
            <span className="nav-name">{user.name || t("nav.user")}</span>
            {narrow ? (
              <button
                type="button"
                className="nav-icon-button"
                aria-label={t("nav.signOut")}
                onClick={() => void signOut()}
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" onClick={() => void signOut()}>{t("nav.signOut")}</button>
            )}
          </>
        ) : (
          <LoginButton size="medium" type={narrow ? "icon" : "standard"} />
        )}
      </div>
    </nav>
  );
}
