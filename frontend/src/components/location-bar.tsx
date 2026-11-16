import { useUserLocation } from "../location";

export function LocationBar() {
  const { location, requestGps } = useUserLocation();

  if (location.estado === "inicial") return null;
  if (location.estado === "buscando") {
    return <p className="location-bar">📍 Buscando tu ubicación…</p>;
  }
  if (location.estado === "gps") {
    return <p className="location-bar">📍 Usando tu ubicación</p>;
  }

  return (
    <div className="location-bar">
      <p>
        📍 Activa tu ubicación para ver la distancia a cada tienda ·{" "}
        <button type="button" className="link-button" onClick={requestGps}>
          Usar mi ubicación
        </button>
      </p>
      <small>Si la bloqueaste, permítela en la configuración del navegador.</small>
    </div>
  );
}
