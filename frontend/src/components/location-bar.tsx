import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react";
import { useUserLocation } from "../location";

export function LocationBar() {
  const { t } = useTranslation();
  const { location, requestGps } = useUserLocation();

  if (location.estado === "inicial") return null;
  if (location.estado === "buscando") {
    return <p className="location-bar"><MapPin size={16} aria-hidden="true" /> {t("location.searching")}</p>;
  }
  if (location.estado === "gps") {
    return <p className="location-bar"><MapPin size={16} aria-hidden="true" /> {t("location.using")}</p>;
  }

  return (
    <div className="location-bar">
      <p>
        <MapPin size={16} aria-hidden="true" /> {t("location.prompt")}{" "}
        <button type="button" className="link-button" onClick={requestGps}>
          {t("location.useMine")}
        </button>
      </p>
      <small>{t("location.blockedHint")}</small>
    </div>
  );
}
