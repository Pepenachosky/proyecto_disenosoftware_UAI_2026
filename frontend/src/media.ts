// Media queries de CSS desde React, con los mismos cortes que las hojas de estilo.
import { useEffect, useState } from "react";

/** Teléfono. */
export const NARROW = "(width < 640px)";
/** Teléfono o tableta: todo lo que no es escritorio. */
export const BELOW_DESKTOP = "(width < 900px)";

/** true mientras la media query se cumpla; se actualiza al cambiar el tamaño de la ventana. */
export function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== "undefined" && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    // Sincroniza por si la query cambió entre el render y el efecto (o cambió `query`).
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
