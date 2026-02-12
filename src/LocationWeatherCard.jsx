import React, { useEffect, useState } from "react";

export default function LocationWeatherCard() {
  const [isSupported, setIsSupported] = useState(true);

  // overall status
  const [status, setStatus] = useState("idle"); // idle | requesting | success | error
  const [error, setError] = useState(null);

  // display-only info
  const [areaName, setAreaName] = useState("—");
  const [tempC, setTempC] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setIsSupported(false);
      setStatus("error");
      setError("Geolocation is not supported in this browser.");
    }
  }, []);

  // Pick a SHORT area label from Nominatim address object
  const buildShortAreaName = (address) => {
    if (!address) return "Unknown area";

    // Most useful "smallest" area fields (vary by country/city)
    const local =
      address.neighbourhood ||
      address.quarter ||
      address.suburb ||
      address.city_district ||
      address.borough ||
      address.town ||
      address.village ||
      address.city ||
      address.county ||
      address.state;

    const cityLike =
      address.city ||
      address.town ||
      address.village ||
      address.county ||
      address.state;

    // Avoid repeating the same string twice
    if (local && cityLike && local !== cityLike) return `${local}, ${cityLike}`;
    return local || cityLike || "Unknown area";
  };

  const reverseGeocodeArea = async (lat, lng) => {
    const url =
      "https://nominatim.openstreetmap.org/reverse?" +
      new URLSearchParams({
        format: "jsonv2",
        lat: String(lat),
        lon: String(lng),
        zoom: "14", // more "area-like", less house-level
        addressdetails: "1",
      });

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Area lookup failed (${res.status})`);

    const data = await res.json();
    return buildShortAreaName(data.address);
  };

  const fetchCurrentTempC = async (lat, lng) => {
    // Open-Meteo: current temperature (no API key)
    const url =
      "https://api.open-meteo.com/v1/forecast?" +
      new URLSearchParams({
        latitude: String(lat),
        longitude: String(lng),
        current: "temperature_2m",
        timezone: "auto",
      });

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Weather fetch failed (${res.status})`);

    const data = await res.json();
    const t = data?.current?.temperature_2m;
    if (typeof t !== "number") throw new Error("Weather data missing temperature.");
    return t;
  };

  const getLocationAndWeather = () => {
    setStatus("requesting");
    setError(null);
    setAreaName("—");
    setTempC(null);
    setUpdatedAt(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        try {
          // Run both requests in parallel
          const [area, temp] = await Promise.all([
            reverseGeocodeArea(lat, lng),
            fetchCurrentTempC(lat, lng),
          ]);

          setAreaName(area);
          setTempC(temp);
          setUpdatedAt(Date.now());
          setStatus("success");
        } catch (e) {
          setStatus("error");
          setError(e?.message || "Failed to load area/weather.");
        }
      },
      (err) => {
        setStatus("error");
        setError(`${err.message} (code ${err.code})`);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  const badgeStyle = () => {
    const base = { ...styles.badge };
    if (status === "success")
      return { ...base, background: "#e7f7ed", color: "#137a3d", borderColor: "#bfe8cf" };
    if (status === "requesting")
      return { ...base, background: "#fff7e6", color: "#8a5a00", borderColor: "#ffe0a3" };
    if (status === "error")
      return { ...base, background: "#fdeaea", color: "#a11b1b", borderColor: "#f6c1c1" };
    return { ...base, background: "#eef2ff", color: "#2b3a8a", borderColor: "#cdd6ff" };
  };

  const tempText =
    typeof tempC === "number" ? `${tempC.toFixed(1)}°C` : status === "requesting" ? "…" : "—";

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.title}>Area & Weather</h2>
            <p style={styles.sub}>Shows your area name and current temperature.</p>
          </div>
          <span style={badgeStyle()}>{status.toUpperCase()}</span>
        </div>

        {!isSupported && (
          <div style={styles.alertError}>Your browser doesn’t support geolocation.</div>
        )}

        {error && <div style={styles.alertError}>{error}</div>}

        <div style={styles.bigInfo}>
          <div style={styles.infoBlock}>
            <div style={styles.infoLabel}>Area</div>
            <div style={styles.infoValue}>{areaName}</div>
          </div>

          <div style={styles.infoBlock}>
            <div style={styles.infoLabel}>Current Temperature</div>
            <div style={styles.infoValue}>{tempText}</div>
          </div>
        </div>

        {updatedAt && (
          <div style={styles.updated}>
            Updated: {new Date(updatedAt).toLocaleString()}
          </div>
        )}

        <div style={styles.actions}>
          <button
            style={{
              ...styles.button,
              opacity: status === "requesting" || !isSupported ? 0.6 : 1,
              cursor: status === "requesting" || !isSupported ? "not-allowed" : "pointer",
            }}
            onClick={getLocationAndWeather}
            disabled={status === "requesting" || !isSupported}
          >
            {status === "requesting" ? "Loading..." : "Get Area + Weather"}
          </button>
        </div>

        <div style={styles.hint}>
          <b>Note:</b> Geolocation usually requires <b>HTTPS</b> (or <b>localhost</b>).
          Also, don’t spam refresh—Nominatim is for light usage.
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f6f7fb",
    padding: 20,
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
  },
  card: {
    width: "min(720px, 100%)",
    background: "#fff",
    border: "1px solid #e6e8f0",
    borderRadius: 16,
    boxShadow: "0 10px 30px rgba(16,24,40,0.08)",
    padding: 20,
  },
  headerRow: { display: "flex", justifyContent: "space-between", gap: 16 },
  title: { margin: 0, fontSize: 22 },
  sub: { margin: "6px 0 0 0", color: "#5b6270", fontSize: 13 },
  badge: {
    alignSelf: "start",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid",
    letterSpacing: 0.5,
  },
  alertError: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    background: "#fdeaea",
    border: "1px solid #f6c1c1",
    color: "#a11b1b",
    fontSize: 13,
  },
  bigInfo: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 16,
  },
  infoBlock: {
    border: "1px solid #eceef5",
    borderRadius: 12,
    padding: 14,
    background: "#fafbff",
  },
  infoLabel: { fontSize: 12, color: "#6b7280", marginBottom: 6 },
  infoValue: { fontSize: 18, fontWeight: 800, color: "#111827", lineHeight: 1.3 },
  updated: { marginTop: 10, fontSize: 12, color: "#6b7280" },
  actions: { display: "flex", gap: 10, alignItems: "center", marginTop: 16 },
  button: {
    border: "none",
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 700,
    background: "#111827",
    color: "#fff",
  },
  hint: {
    marginTop: 14,
    fontSize: 12,
    color: "#5b6270",
    lineHeight: 1.5,
    background: "#f3f6ff",
    border: "1px solid #dfe7ff",
    borderRadius: 12,
    padding: 12,
  },
};