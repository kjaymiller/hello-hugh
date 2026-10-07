import L from "./leaflet-setup.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const loginScreen = document.getElementById("login-screen");
const form = document.getElementById("backdate-form");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const loginStatus = document.getElementById("login-status");
const photoInput = document.getElementById("photo");
const previewImg = document.getElementById("preview-img");
const takenAtInput = document.getElementById("taken-at");
const placeSearch = document.getElementById("place-search");
const placeSearchBtn = document.getElementById("place-search-btn");
const savedLocation = document.getElementById("saved-location");
const locationStatus = document.getElementById("location-status");
const submitBtn = document.getElementById("submit-btn");
const submitStatus = document.getElementById("submit-status");

let map = null;
let marker = null;
let picked = null; // { lat, lng }
let nickname = null;
let previewUrl = null;

function setStatus(el, message, kind, baseClass = "status") {
  el.textContent = message;
  el.className = `${baseClass}${kind ? " " + kind : ""}`;
}

function updateSubmitEnabled() {
  submitBtn.disabled = !(picked && photoInput.files.length && takenAtInput.value);
}

function pick(lat, lng, name = null) {
  picked = { lat, lng };
  nickname = name;
  if (marker) marker.setLatLng([lat, lng]);
  else marker = L.marker([lat, lng]).addTo(map);
  setStatus(
    locationStatus,
    `📍 ${name ? name + " · " : ""}${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    "success",
    "status-line"
  );
  updateSubmitEnabled();
}

function initMap() {
  map = L.map("picker-map").setView([33.749, -84.388], 4);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  map.on("click", (e) => {
    savedLocation.value = "";
    pick(e.latlng.lat, e.latlng.lng);
  });
}

async function loadSavedLocations() {
  try {
    const res = await fetch(`${API_BASE}/api/locations`, { credentials: "include" });
    if (!res.ok) return;
    const locations = await res.json();
    if (!locations.length) return;
    savedLocation.innerHTML = '<option value="">Or pick a saved place…</option>';
    locations.forEach((loc) => {
      const opt = document.createElement("option");
      opt.value = JSON.stringify(loc);
      opt.textContent = loc.name;
      savedLocation.appendChild(opt);
    });
    savedLocation.hidden = false;
  } catch (err) {
    console.error("Failed to load saved locations:", err);
  }
}

savedLocation.addEventListener("change", () => {
  if (!savedLocation.value) return;
  const loc = JSON.parse(savedLocation.value);
  pick(loc.lat, loc.lng, loc.name);
  map.setView([loc.lat, loc.lng], 14);
});

async function searchPlace() {
  const q = placeSearch.value.trim();
  if (!q) return;
  setStatus(locationStatus, "Searching...", null, "status-line");
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("q", q);
    const res = await fetch(url);
    const [hit] = await res.json();
    if (!hit) {
      setStatus(locationStatus, "No match found. Try tapping the map instead.", "error", "status-line");
      return;
    }
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    savedLocation.value = "";
    pick(lat, lng);
    map.setView([lat, lng], 13);
  } catch (err) {
    setStatus(locationStatus, "Search failed. Try tapping the map instead.", "error", "status-line");
  }
}

placeSearchBtn.addEventListener("click", searchPlace);
placeSearch.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    searchPlace();
  }
});

photoInput.addEventListener("change", () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  const file = photoInput.files[0];
  if (file) {
    previewUrl = URL.createObjectURL(file);
    previewImg.src = previewUrl;
    previewImg.hidden = false;
    // Default the date to the photo's file date — usually right for a
    // photo picked from the library — but never override what Hugh typed.
    if (!takenAtInput.value && file.lastModified) {
      takenAtInput.value = toLocalInputValue(new Date(file.lastModified));
    }
  } else {
    previewImg.hidden = true;
  }
  updateSubmitEnabled();
});
takenAtInput.addEventListener("input", updateSubmitEnabled);

function toLocalInputValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function showForm() {
  loginScreen.hidden = true;
  form.hidden = false;
  takenAtInput.max = toLocalInputValue(new Date());
  // Leaflet needs a visible container to measure, so init after un-hiding.
  if (!map) initMap();
  loadSavedLocations();
}

async function checkSession() {
  const res = await fetch(`${API_BASE}/api/session`, { credentials: "include" });
  const { authenticated } = await res.json();
  if (authenticated) showForm();
}

loginBtn.addEventListener("click", async () => {
  setStatus(loginStatus, "Logging in...");
  try {
    const res = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password: passwordInput.value }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setStatus(loginStatus, error || "Login failed", "error");
      return;
    }
    showForm();
  } catch (err) {
    setStatus(loginStatus, "Network error logging in", "error");
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (submitBtn.disabled) return;
  submitBtn.disabled = true;
  setStatus(submitStatus, "Saving...", null, "status-line");

  const body = new FormData();
  body.append("lat", String(picked.lat));
  body.append("lng", String(picked.lng));
  // datetime-local is wall-clock time in the browser's zone; send an
  // unambiguous instant.
  body.append("taken_at", new Date(takenAtInput.value).toISOString());
  if (nickname) body.append("nickname", nickname);
  body.append("photo", photoInput.files[0]);

  try {
    const res = await fetch(`${API_BASE}/api/checkins`, {
      method: "POST",
      credentials: "include",
      body,
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setStatus(submitStatus, error || "Failed to save", "error", "status-line");
      updateSubmitEnabled();
      return;
    }
    setStatus(submitStatus, "✅ Added! See it on the map.", "success", "status-line");
    photoInput.value = "";
    previewImg.hidden = true;
    takenAtInput.value = "";
    updateSubmitEnabled();
  } catch (err) {
    setStatus(submitStatus, "Network error saving check-in", "error", "status-line");
    updateSubmitEnabled();
  }
});

checkSession();
