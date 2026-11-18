import { useEffect, useRef } from "react";
import { googleIdentity } from "../google";
import { useLanguage } from "../language.tsx";

export function LoginButton(
  { size = "large", type = "standard" }: { size?: "medium" | "large"; type?: "standard" | "icon" },
) {
  const { lang } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const draw = () => {
      void googleIdentity().then((id) => {
        const el = ref.current;
        if (cancelled || !id || !el) return;
        el.replaceChildren();
        id.renderButton(el, {
          type,
          theme: media.matches ? "filled_black" : "outline",
          size,
          text: "signin_with",
          shape: type === "icon" ? "circle" : "pill",
          logo_alignment: "left",
          locale: lang,
        });
      }).catch((e) => console.warn("No se pudo dibujar el botón de Google:", e));
    };
    draw();
    media.addEventListener("change", draw);
    return () => {
      cancelled = true;
      media.removeEventListener("change", draw);
    };
  }, [size, type, lang]);

  return <div className="google-button" ref={ref} />;
}
