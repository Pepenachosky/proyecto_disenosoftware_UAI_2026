import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react";
import { useUserLocation } from "../location";

// Aviso de ubicación sobre la lista de tiendas de la ficha de producto. Refleja el
// estado de useUserLocation; si no hay ubicación ofrece pedirla de nuevo y explica
// cómo desbloquear el permiso del navegador. Sin ubicación no se muestran distancias.
export function LocationBar() {
  const { t } = useTranslation();
  const { location, requestGps } = useUserLocation();

  // Antes de la primera petición de ubicación no se muestra nada.
  if (location.estado === "inicial") return null;
  if (location.estado === "buscando") {
    return <p className="location-bar glass"><MapPin size={16} aria-hidden="true" />{t("location.searching")}</p>;
  }
  if (location.estado === "gps") {
    return <p className="location-bar glass"><MapPin size={16} aria-hidden="true" />{t("location.using")}</p>;
  }

  return (
    <div className="location-bar glass">
      <p>
        <MapPin size={16} aria-hidden="true" /><span>{t("location.prompt")}</span>
        <button type="button" className="link-button" onClick={requestGps}>
          {t("location.useMine")}
        </button>
      </p>
      <small>{t("location.blockedHint")}</small>
    </div>
  );
}
