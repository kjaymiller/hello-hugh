// Empty string = same-origin relative fetches, which is correct once the
// backend serves this built frontend itself. Set VITE_API_BASE_URL only for
// local dev where frontend (Vite) and backend run on different ports.
const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const list = document.getElementById("list");
const status = document.getElementById("status");

function render(checkins) {
  if (!checkins.length) {
    status.textContent = "No check-ins yet.";
    return;
  }
  status.textContent = "";
  list.innerHTML = checkins
    .map(
      (c) => `
      <div class="card checkin">
        <img src="${c.photo_url}" alt="Check-in photo" loading="lazy" />
        <div class="meta">
          <div>${new Date(c.created_at).toLocaleString()}</div>
          <div>${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}${c.accuracy_m ? ` (±${Math.round(c.accuracy_m)}m)` : ""}</div>
        </div>
      </div>`
    )
    .join("");
}

async function load() {
  try {
    const res = await fetch(`${API_BASE}/api/checkins`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    render(await res.json());
  } catch (err) {
    status.textContent = "Failed to load check-ins.";
    status.className = "status error";
  }
}

load();
