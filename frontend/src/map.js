import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const statusEl = document.getElementById("map-status");
const map = L.map("map").setView([20, 0], 2);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

function popupFor(c) {
  const el = document.createElement("div");
  el.className = "map-popup";
  const img = document.createElement("img");
  img.src = c.photo_url;
  img.alt = "Check-in photo";
  img.loading = "lazy";
  const place = document.createElement("strong");
  place.textContent = c.nickname || c.city || `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`;
  const time = document.createElement("div");
  time.textContent = new Date(c.created_at).toLocaleString();
  el.append(img, place, time);
  return el;
}

async function load() {
  try {
    const res = await fetch(`${API_BASE}/api/checkins/map`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const checkins = await res.json();
    if (!checkins.length) {
      statusEl.textContent = "No check-ins yet.";
      return;
    }
    const points = checkins.map((c) => {
      L.marker([c.lat, c.lng]).addTo(map).bindPopup(popupFor(c), { minWidth: 200 });
      return [c.lat, c.lng];
    });
    map.fitBounds(points, { padding: [40, 40], maxZoom: 14 });
    const places = new Set(checkins.map((c) => c.nickname || c.city).filter(Boolean));
    statusEl.textContent = `${checkins.length} check-in${checkins.length === 1 ? "" : "s"}${
      places.size ? ` · ${places.size} place${places.size === 1 ? "" : "s"}` : ""
    }`;
  } catch (err) {
    statusEl.textContent = "Failed to load check-ins.";
    statusEl.classList.add("error");
  }
}

load();
