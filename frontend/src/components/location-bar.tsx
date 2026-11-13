import { useState } from "react";
import { REGIONES } from "../data/comunas";
import { useUserLocation } from "../location";

export function LocationBar() {
  const { location, requestGps, chooseComuna } = useUserLocation();
  const [cambiando, setCambiando] = useState(false);
  const [region, setRegion] = useState("");

  if (location.estado === "inicial") return null;
  if (location.estado === "buscando") {
    return <p className="location-bar">📍 Buscando tu ubicación…</p>;
  }

  if (location.estado !== "elegir" && !cambiando) {
    const texto =
      location.estado === "gps" ? "Usando tu ubicación" : `Comuna: ${location.comuna}`;
    return (
      <p className="location-bar">
        📍 {texto} ·{" "}
        <button type="button" className="link-button" onClick={() => setCambiando(true)}>
          Cambiar
        </button>
      </p>
    );
  }

  const comunas = REGIONES.find((r) => r.name === region)?.comunas ?? [];
  return (
    <div className="location-bar">
      <p>Para ver la distancia a cada tienda, usa tu ubicación o elige tu comuna:</p>
      <div className="location-form">
        <select aria-label="Región" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">Región</option>
          {REGIONES.map((r) => (
            <option key={r.name} value={r.name}>{r.name}</option>
          ))}
        </select>
        <select
          aria-label="Comuna"
          value=""
          disabled={!region}
          onChange={(e) => {
            if (!e.target.value) return;
            chooseComuna(region, e.target.value);
            setCambiando(false);
          }}
        >
          <option value="">Comuna</option>
          {comunas.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            requestGps();
            setCambiando(false);
          }}
        >
          Usar mi ubicación
        </button>
        {cambiando && (
          <button type="button" onClick={() => setCambiando(false)}>
            Cancelar
          </button>
        )}
      </div>
      <small>La distancia se mide desde el centro de la comuna.</small>
    </div>
  );
}
