// Empty string = same-origin relative fetches, which is correct once the
// backend serves this built frontend itself. Set VITE_API_BASE_URL only for
// local dev where frontend (Vite) and backend run on different ports.
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const loginScreen = document.getElementById("login-screen");
const checkinScreen = document.getElementById("checkin-screen");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const loginStatus = document.getElementById("login-status");

const locationStatus = document.getElementById("location-status");
const captureLocationBtn = document.getElementById("capture-location-btn");
const nearbyChips = document.getElementById("nearby-chips");
const showNamePlaceBtn = document.getElementById("show-name-place-btn");
const namePlaceRow = document.getElementById("name-place-row");
const newLocationName = document.getElementById("new-location-name");
const saveLocationBtn = document.getElementById("save-location-btn");
const locationError = document.getElementById("location-error");
const photoInput = document.getElementById("photo");
const previewImg = document.getElementById("preview-img");
const previewBg = document.getElementById("preview-bg");
const previewPlaceholder = document.getElementById("preview-placeholder");
const submitBtn = document.getElementById("submit-btn");
const submitStatus = document.getElementById("submit-status");

let capturedPosition = null;
let previewUrl = null;
let selectedNickname = null;

function setStatus(el, message, kind, baseClass = "status") {
  el.textContent = message;
  el.className = `${baseClass}${kind ? " " + kind : ""}`;
}

function updateSubmitEnabled() {
  submitBtn.disabled = !(capturedPosition && photoInput.files.length);
}

function showCheckinScreen() {
  loginScreen.hidden = true;
  checkinScreen.hidden = false;
  // Auto-capture on arrival so Hugh doesn't have to tap a button first —
  // the manual "Capture location" button stays as a retry/refresh option.
  captureLocation();
}

async function checkSession() {
  const res = await fetch(`${API_BASE}/api/session`, { credentials: "include" });
  const { authenticated } = await res.json();
  if (authenticated) {
    showCheckinScreen();
  }
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
    showCheckinScreen();
  } catch (err) {
    setStatus(loginStatus, "Network error logging in", "error");
  }
});

function captureLocation() {
  if (!("geolocation" in navigator)) {
    setStatus(locationStatus, "Geolocation not supported on this browser", "error", "status-line");
    return;
  }
  setStatus(locationStatus, "Requesting location permission...", null, "status-line");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      capturedPosition = position;
      const { latitude, longitude, accuracy } = position.coords;
      setStatus(
        locationStatus,
        `📍 ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)}m)`,
        "success",
        "status-line"
      );
      updateSubmitEnabled();
      showNamePlaceBtn.hidden = false;
      refreshNearbyLocations(latitude, longitude);
    },
    (err) => {
      // Visible fallback rather than failing silently, per the project plan.
      setStatus(
        locationStatus,
        `Location permission denied or unavailable: ${err.message}`,
        "error",
        "status-line"
      );
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

captureLocationBtn.addEventListener("click", captureLocation);

function selectNickname(name, chipEls) {
  selectedNickname = selectedNickname === name ? null : name;
  chipEls.forEach((chip) => {
    chip.classList.toggle("selected", chip.dataset.name === selectedNickname);
  });
}

async function refreshNearbyLocations(lat, lng) {
  selectedNickname = null;
  nearbyChips.innerHTML = "";
  nearbyChips.hidden = true;

  try {
    const res = await fetch(
      `${API_BASE}/api/locations/nearby?lat=${lat}&lng=${lng}`,
      { credentials: "include" }
    );
    if (!res.ok) return;
    const nearby = await res.json();
    if (!nearby.length) return;

    const chipEls = nearby.map((loc) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = loc.name;
      chip.dataset.name = loc.name;
      return chip;
    });
    chipEls.forEach((chip) => {
      chip.addEventListener("click", () => selectNickname(chip.dataset.name, chipEls));
      nearbyChips.appendChild(chip);
    });
    nearbyChips.hidden = false;
  } catch (err) {
    // Non-critical — just means no nickname suggestions this time.
    console.error("Failed to load nearby locations:", err);
  }
}

showNamePlaceBtn.addEventListener("click", () => {
  showNamePlaceBtn.hidden = true;
  namePlaceRow.hidden = false;
  newLocationName.focus();
});

saveLocationBtn.addEventListener("click", async () => {
  const name = newLocationName.value.trim();
  setStatus(locationError, "", null, "status-line");
  if (!name) {
    setStatus(locationError, "Enter a name first", "error", "status-line");
    return;
  }
  if (!capturedPosition) {
    setStatus(locationError, "Capture location first", "error", "status-line");
    return;
  }

  const { latitude, longitude } = capturedPosition.coords;
  saveLocationBtn.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, lat: latitude, lng: longitude }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setStatus(locationError, error || "Failed to save location", "error", "status-line");
      return;
    }
    newLocationName.value = "";
    namePlaceRow.hidden = true;
    showNamePlaceBtn.hidden = false;
    await refreshNearbyLocations(latitude, longitude);
    // The place Hugh just named is obviously the one he means right now.
    const chip = nearbyChips.querySelector(`[data-name="${CSS.escape(name)}"]`);
    if (chip) selectNickname(name, [...nearbyChips.children]);
  } catch (err) {
    setStatus(locationError, "Network error saving location", "error", "status-line");
  } finally {
    saveLocationBtn.disabled = false;
  }
});

photoInput.addEventListener("change", () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  if (photoInput.files.length) {
    previewUrl = URL.createObjectURL(photoInput.files[0]);
    previewImg.src = previewUrl;
    previewBg.src = previewUrl;
    previewImg.hidden = false;
    previewBg.hidden = false;
    previewPlaceholder.hidden = true;
  } else {
    previewImg.hidden = true;
    previewBg.hidden = true;
    previewPlaceholder.hidden = false;
  }
  updateSubmitEnabled();
});

submitBtn.addEventListener("click", async () => {
  if (!capturedPosition || !photoInput.files.length) return;

  submitBtn.disabled = true;
  setStatus(submitStatus, "Submitting check-in...", null, "status-line");

  const { latitude, longitude, accuracy } = capturedPosition.coords;
  const form = new FormData();
  form.append("lat", String(latitude));
  form.append("lng", String(longitude));
  form.append("accuracy_m", String(accuracy));
  if (selectedNickname) form.append("nickname", selectedNickname);
  form.append("photo", photoInput.files[0]);

  try {
    const res = await fetch(`${API_BASE}/api/checkins`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setStatus(submitStatus, error || "Check-in failed", "error", "status-line");
      updateSubmitEnabled();
      return;
    }
    setStatus(submitStatus, "✅ Checked in! Check the timeline.", "success", "status-line");
    photoInput.value = "";
    previewImg.hidden = true;
    previewBg.hidden = true;
    previewPlaceholder.hidden = false;
    capturedPosition = null;
    updateSubmitEnabled();
    namePlaceRow.hidden = true;
    newLocationName.value = "";
    captureLocation(); // ready for the next check-in without another tap
  } catch (err) {
    setStatus(submitStatus, "Network error submitting check-in", "error", "status-line");
    updateSubmitEnabled();
  }
});

checkSession();
