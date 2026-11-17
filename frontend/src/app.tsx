import { BrowserRouter, Route, Routes } from "react-router";
import { AuthProvider } from "./auth";
import { LanguageProvider } from "./language";
import { SavedProvider } from "./saved";
import { LocationProvider } from "./location";
import { NavBar } from "./components/nav-bar";
import { Catalog } from "./pages/catalog";
import { ProductPage } from "./pages/product";
import { NotFound } from "./pages/not-found";
import { SavedPage } from "./pages/saved-page";
import "./app.css";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <SavedProvider>
            <LocationProvider>
              <NavBar />
              <Routes>
                <Route path="/" element={<Catalog />} />
                <Route path="/producto/:slug" element={<ProductPage />} />
                <Route path="/guardados" element={<SavedPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </LocationProvider>
          </SavedProvider>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
