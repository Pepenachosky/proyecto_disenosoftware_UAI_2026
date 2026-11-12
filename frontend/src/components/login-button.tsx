import { useEffect, useRef } from "react";
import { googleIdentity } from "../google";

export function LoginButton({ size = "large" }: { size?: "medium" | "large" }) {
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
          type: "standard",
          theme: media.matches ? "filled_black" : "outline",
          size,
          text: "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
          locale: "es",
        });
      }).catch((e) => console.warn("No se pudo dibujar el botón de Google:", e));
    };
    draw();
    media.addEventListener("change", draw);
    return () => {
      cancelled = true;
      media.removeEventListener("change", draw);
    };
  }, [size]);

  return <div className="google-button" ref={ref} />;
}
