import { BrowserRouter, Route, Routes } from "react-router";
import { ConsentProvider } from "./consent";
import { AuthProvider } from "./auth";
import { LanguageProvider } from "./language";
import { SavedProvider } from "./saved";
import { LocationProvider } from "./location";
import { NavBar } from "./components/nav-bar";
import { SiteFooter } from "./components/site-footer";
import { ConsentBanner } from "./components/consent-banner";
import { Catalog } from "./pages/catalog";
import { ProductPage } from "./pages/product";
import { NotFound } from "./pages/not-found";
import { SavedPage } from "./pages/saved-page";
import { PrivacyPage } from "./pages/privacy";
import "./app.css";

export default function App() {
  return (
    <BrowserRouter>
      <ConsentProvider>
        <AuthProvider>
          <LanguageProvider>
            <SavedProvider>
              <LocationProvider>
                <NavBar />
                <Routes>
                  <Route path="/" element={<Catalog />} />
                  <Route path="/producto/:slug" element={<ProductPage />} />
                  <Route path="/guardados" element={<SavedPage />} />
                  <Route path="/privacidad" element={<PrivacyPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <SiteFooter />
                <ConsentBanner />
              </LocationProvider>
            </SavedProvider>
          </LanguageProvider>
        </AuthProvider>
      </ConsentProvider>
    </BrowserRouter>
  );
}
