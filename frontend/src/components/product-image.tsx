import { useState } from "react";

const PLACEHOLDER = "/placeholder.png";

type Props = {
  src: string | null;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
};

// Muestra la imagen del producto; si no hay o falla al cargar, usa el placeholder.
export function ProductImage({ src, alt, className, width, height, loading }: Props) {
  // Se guarda cuál src falló (no un booleano): un src nuevo se reintenta y el
  // placeholder nunca entra en un ciclo de errores.
  const [failed, setFailed] = useState<string | null>(null);
  const shown = src != null && src !== failed ? src : PLACEHOLDER;
  return (
    <img
      className={className}
      src={shown}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      onError={() => {
        if (shown !== PLACEHOLDER) setFailed(shown);
      }}
    />
  );
}
