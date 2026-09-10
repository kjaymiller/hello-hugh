// Empty string = same-origin relative fetches, which is correct once the
// backend serves this built frontend itself. Set VITE_API_BASE_URL only for
// local dev where frontend (Vite) and backend run on different ports.
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const loginCard = document.getElementById("login-card");
const checkinCard = document.getElementById("checkin-card");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const loginStatus = document.getElementById("login-status");

const locationStatus = document.getElementById("location-status");
const captureLocationBtn = document.getElementById("capture-location-btn");
const photoInput = document.getElementById("photo");
const submitBtn = document.getElementById("submit-btn");
const submitStatus = document.getElementById("submit-status");

let capturedPosition = null;

function setStatus(el, message, kind) {
  el.textContent = message;
  el.className = `status${kind ? " " + kind : ""}`;
}

function updateSubmitEnabled() {
  submitBtn.disabled = !(capturedPosition && photoInput.files.length);
}

async function checkSession() {
  const res = await fetch(`${API_BASE}/api/session`, { credentials: "include" });
  const { authenticated } = await res.json();
  if (authenticated) {
    loginCard.hidden = true;
    checkinCard.hidden = false;
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
    loginCard.hidden = true;
    checkinCard.hidden = false;
  } catch (err) {
    setStatus(loginStatus, "Network error logging in", "error");
  }
});

captureLocationBtn.addEventListener("click", () => {
  if (!("geolocation" in navigator)) {
    setStatus(locationStatus, "Geolocation not supported on this browser", "error");
    return;
  }
  setStatus(locationStatus, "Requesting location permission...");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      capturedPosition = position;
      const { latitude, longitude, accuracy } = position.coords;
      setStatus(
        locationStatus,
        `Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)}m)`,
        "success"
      );
      updateSubmitEnabled();
    },
    (err) => {
      // Visible fallback rather than failing silently, per the project plan.
      setStatus(locationStatus, `Location permission denied or unavailable: ${err.message}`, "error");
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
});

photoInput.addEventListener("change", updateSubmitEnabled);

submitBtn.addEventListener("click", async () => {
  if (!capturedPosition || !photoInput.files.length) return;

  submitBtn.disabled = true;
  setStatus(submitStatus, "Submitting check-in...");

  const { latitude, longitude, accuracy } = capturedPosition.coords;
  const form = new FormData();
  form.append("lat", String(latitude));
  form.append("lng", String(longitude));
  form.append("accuracy_m", String(accuracy));
  form.append("photo", photoInput.files[0]);

  try {
    const res = await fetch(`${API_BASE}/api/checkins`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      setStatus(submitStatus, error || "Check-in failed", "error");
      updateSubmitEnabled();
      return;
    }
    setStatus(submitStatus, "Checked in! It should show up on the timeline now.", "success");
    photoInput.value = "";
    capturedPosition = null;
    setStatus(locationStatus, "Location: not captured yet");
    updateSubmitEnabled();
  } catch (err) {
    setStatus(submitStatus, "Network error submitting check-in", "error");
    updateSubmitEnabled();
  }
});

checkSession();
