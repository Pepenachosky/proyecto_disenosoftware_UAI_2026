import { BrowserRouter, Route, Routes } from "react-router";
import { AuthProvider } from "./auth";
import { SavedProvider } from "./saved";
import { NavBar } from "./components/nav-bar";
import { Catalog } from "./pages/catalog";
import { ProductPage } from "./pages/product";
import { SavedPage } from "./pages/saved-page";
import "./app.css";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SavedProvider>
          <NavBar />
          <Routes>
            <Route path="/" element={<Catalog />} />
            <Route path="/producto/:slug" element={<ProductPage />} />
            <Route path="/guardados" element={<SavedPage />} />
            <Route path="*" element={<p>Página no encontrada</p>} />
          </Routes>
        </SavedProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
